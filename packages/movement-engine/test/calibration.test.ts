import { describe, expect, it } from 'vitest';
import {
  ExerciseSession,
  applySuggestion,
  calibrate,
  cleanReps,
  generateKneeExtensionSequence,
  verifyCalibration,
  type CalibrationInput,
} from '@kine/movement-engine';
import { getExercise } from '@kine/exercise-library';

const KNEE = getExercise('seated_knee_extension');

function inputFor(frames: CalibrationInput['frames']): CalibrationInput {
  return {
    frames,
    signal: KNEE.signal,
    requiredParts: KNEE.requiredParts,
    side: KNEE.side,
  };
}

function countReps(frames: CalibrationInput['frames'], def = KNEE): number {
  const s = new ExerciseSession(def);
  for (const f of frames) s.push(f);
  return s.summary().reps;
}

describe('calibrate', () => {
  it('recovers the resting angle and the range that was performed', () => {
    const { frames } = cleanReps(8, 165, 4000, { noise: 0.003, seed: 5 });
    const r = calibrate(inputFor(frames));

    expect(r.restDeg).toBeGreaterThan(86);
    expect(r.restDeg).toBeLessThan(94);
    expect(r.peakDeg).toBeGreaterThan(158);
    expect(r.peakDeg).toBeLessThan(168);
    expect(r.rangeDeg).toBeGreaterThan(65);
    expect(r.direction).toBe('increasing');
  });

  it('finds every repetition in the recording', () => {
    const { frames } = cleanReps(8, 165, 4000, { noise: 0.003, seed: 6 });
    const r = calibrate(inputFor(frames));
    expect(r.cycles.filter((c) => c.complete)).toHaveLength(8);
  });

  it('measures repetition duration close to what was performed', () => {
    const { frames } = cleanReps(6, 165, 6000, { noise: 0.003, seed: 7 });
    const r = calibrate(inputFor(frames));
    // Engine-relevant duration is time spent away from rest, which is shorter
    // than the nominal 6s cycle. It should still land in the right ballpark.
    expect(r.suggested.tempo.idealMs).toBeGreaterThan(3500);
    expect(r.suggested.tempo.idealMs).toBeLessThan(6500);
  });

  it('places the thresholds inside the observed range', () => {
    const { frames } = cleanReps(6, 165, 4000, { noise: 0.003, seed: 8 });
    const r = calibrate(inputFor(frames));

    expect(r.suggested.rep.exitDeg).toBeGreaterThan(r.restDeg);
    expect(r.suggested.rep.enterDeg).toBeGreaterThan(r.suggested.rep.exitDeg);
    expect(r.suggested.rep.enterDeg).toBeLessThan(r.peakDeg);
    expect(r.suggested.rom.minAcceptablePeakDeg).toBeLessThan(r.suggested.rom.goalPeakDeg);
  });

  it('reports tracking quality and frame rate', () => {
    const { frames } = cleanReps(4, 165, 4000, { noise: 0.003, seed: 9 });
    const r = calibrate(inputFor(frames));
    expect(r.trackingQuality).toBeGreaterThan(0.95);
    expect(r.measuredFps).toBeGreaterThan(25);
    expect(r.measuredFps).toBeLessThan(35);
  });
});

describe('calibration round trip', () => {
  it('produces thresholds the engine agrees with', () => {
    const { frames } = cleanReps(8, 165, 4000, { noise: 0.003, seed: 11 });
    const report = calibrate(inputFor(frames));
    const tuned = applySuggestion(KNEE, report.suggested);

    const check = verifyCalibration(frames, tuned, report);
    expect(check.expectedReps).toBe(8);
    expect(check.reps).toBe(8);
    expect(check.agrees).toBe(true);
  });

  /**
   * The reason this feature exists.
   *
   * A patient whose knee only extends to 140° cannot reach the shipped
   * threshold of 150°, so the app counts zero and tells them they did nothing.
   * Calibration fits the thresholds to the body in front of the camera.
   */
  it('rescues a patient whose range is smaller than the shipped default', () => {
    const { frames } = cleanReps(6, 140, 4000, { noise: 0.003, seed: 13 });

    expect(countReps(frames, KNEE)).toBe(0);

    const report = calibrate(inputFor(frames));
    const tuned = applySuggestion(KNEE, report.suggested);

    expect(countReps(frames, tuned)).toBe(6);
    expect(verifyCalibration(frames, tuned, report).agrees).toBe(true);
  });

  it('handles a larger range than the default too', () => {
    const { frames } = cleanReps(5, 178, 4000, { noise: 0.003, seed: 17 });
    const report = calibrate(inputFor(frames));
    const tuned = applySuggestion(KNEE, report.suggested);
    expect(countReps(frames, tuned)).toBe(5);
  });

  it('handles slow repetitions', () => {
    const { frames } = cleanReps(4, 165, 9000, { noise: 0.003, seed: 19 });
    const report = calibrate(inputFor(frames));
    const tuned = applySuggestion(KNEE, report.suggested);
    // The shipped maxDurationMs of 12s is fine here, but the calibrated one
    // must not be tighter than the movement actually performed.
    expect(countReps(frames, tuned)).toBe(4);
  });

  it('leaves cues, form rules and approval status untouched', () => {
    const { frames } = cleanReps(5, 165, 4000, { noise: 0.003, seed: 23 });
    const report = calibrate(inputFor(frames));
    const tuned = applySuggestion(KNEE, report.suggested);

    expect(tuned.formRules).toEqual(KNEE.formRules);
    expect(tuned.camera).toEqual(KNEE.camera);
    expect(tuned.safety).toEqual(KNEE.safety);
    // Calibration never promotes a definition out of draft. Fitting numbers to
    // a movement is not clinical review.
    expect(tuned.clinical.status).toBe('draft');
  });
});

describe('calibration refuses bad recordings', () => {
  it('rejects a recording that is too short', () => {
    const { frames } = cleanReps(1, 165, 4000);
    expect(() => calibrate(inputFor(frames.slice(0, 10)))).toThrow(/Not enough usable frames/);
  });

  it('rejects a recording with no real movement', () => {
    const { frames } = generateKneeExtensionSequence({
      reps: [],
      leadInMs: 8000,
      noise: 0.004,
      seed: 29,
    });
    expect(() => calibrate(inputFor(frames))).toThrow(/too small to calibrate/);
  });

  it('warns when the body was often out of frame', () => {
    const { frames } = generateKneeExtensionSequence({
      reps: Array.from({ length: 8 }, () => ({
        peakDeg: 165,
        durationMs: 4000,
        holdMs: 700,
      })),
      noise: 0.003,
      seed: 31,
      dropouts: [
        [5000, 12000],
        [20000, 26000],
      ],
    });

    const r = calibrate(inputFor(frames));
    expect(r.trackingQuality).toBeLessThan(0.9);
    expect(r.warnings.join(' ')).toMatch(/fully visible/);
  });

  it('warns when there are too few repetitions to time reliably', () => {
    const { frames } = cleanReps(2, 165, 4000, { noise: 0.003, seed: 37 });
    const r = calibrate(inputFor(frames));
    expect(r.warnings.join(' ')).toMatch(/Record at least 5/);
  });
});

describe('calibration on a decreasing-signal exercise', () => {
  const SLR = getExercise('straight_leg_raise');

  it('detects the direction and fits thresholds', () => {
    // Hip angle falls from 175 lying flat to 130 with the leg raised.
    const { frames } = generateKneeExtensionSequence({
      reps: Array.from({ length: 6 }, () => ({
        peakDeg: 130,
        durationMs: 5000,
        holdMs: 800,
      })),
      startDeg: 175,
      noise: 0.003,
      seed: 41,
    });

    // Reuse the knee geometry: only the signal's direction matters here.
    const r = calibrate({
      frames,
      signal: KNEE.signal,
      requiredParts: SLR.requiredParts,
      side: 'auto',
    });

    expect(r.direction).toBe('decreasing');
    expect(r.restDeg).toBeGreaterThan(170);
    expect(r.peakDeg).toBeLessThan(140);
    expect(r.suggested.rep.enterDeg).toBeLessThan(r.suggested.rep.exitDeg);
    expect(r.cycles.filter((c) => c.complete)).toHaveLength(6);
  });
});
