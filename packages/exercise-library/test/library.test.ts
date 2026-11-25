import { describe, expect, it } from 'vitest';
import {
  ExerciseDefinitionError,
  ExerciseNotApprovedError,
  approvalStatus,
  getApprovedExercise,
  getExercise,
  listExercises,
  validateDefinition,
} from '@kine/exercise-library';
import { getCue } from '@kine/shared';

describe('exercise library', () => {
  it('loads and validates all shipped definitions', () => {
    expect(listExercises()).toHaveLength(8);
  });

  it('gives every exercise a unique id', () => {
    const ids = listExercises().map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('references only cues that exist in the catalogue', () => {
    for (const def of listExercises()) {
      expect(() => getCue(def.camera.setupCueKey)).not.toThrow();
      for (const rule of def.formRules) {
        expect(() => getCue(rule.cueKey)).not.toThrow();
      }
    }
  });

  it('gives a helpful error for an unknown exercise', () => {
    expect(() => getExercise('nope')).toThrow(/Available:/);
  });
});

describe('clinical approval gate', () => {
  it('currently ships every exercise as draft', () => {
    // Flips as clinicians review each one. If this test fails because
    // `draft` is empty, delete it and celebrate.
    expect(approvalStatus().draft.length).toBeGreaterThan(0);
  });

  it('refuses to serve a draft exercise to a patient', () => {
    const draftId = approvalStatus().draft[0]!;
    expect(() => getApprovedExercise(draftId)).toThrow(ExerciseNotApprovedError);
  });
});

describe('validateDefinition', () => {
  const base = () => structuredClone(getExercise('seated_knee_extension'));

  it('accepts a good definition', () => {
    expect(() => validateDefinition(base())).not.toThrow();
  });

  it('rejects a hysteresis band of zero width', () => {
    const d = base();
    d.rep.exitDeg = d.rep.enterDeg;
    expect(() => validateDefinition(d)).toThrow(ExerciseDefinitionError);
  });

  it('rejects a rom goal on the wrong side of the movement', () => {
    const d = base();
    d.rom.goalPeakDeg = 100; // below minAcceptable for an increasing exercise
    expect(() => validateDefinition(d)).toThrow(/further along the movement direction/);
  });

  it('rejects a duration range that cannot be satisfied', () => {
    const d = base();
    d.rep.maxDurationMs = d.rep.minDurationMs - 1;
    expect(() => validateDefinition(d)).toThrow(/maxDurationMs/);
  });

  it('rejects a form rule pointing at a cue that does not exist', () => {
    const d = base();
    d.formRules[0]!.cueKey = 'cue.invented_by_an_engineer';
    expect(() => validateDefinition(d)).toThrow(/not in the cue catalogue/);
  });

  it('rejects duplicate form rule ids', () => {
    const d = base();
    d.formRules[1]!.id = d.formRules[0]!.id;
    expect(() => validateDefinition(d)).toThrow(/duplicate form rule/);
  });

  it('rejects an unknown body part', () => {
    const d = base();
    (d.requiredParts as string[])[0] = 'elbowish';
    expect(() => validateDefinition(d)).toThrow(/unknown body part/);
  });

  it('collects several problems into one error message', () => {
    const d = base();
    d.rep.exitDeg = d.rep.enterDeg;
    (d.requiredParts as string[])[0] = 'elbowish';
    try {
      validateDefinition(d);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as Error).message).toMatch(/hysteresis band/);
      expect((e as Error).message).toMatch(/unknown body part/);
    }
  });
});
