/**
 * The patient's local profile.
 *
 * There is no backend yet, so this lives in localStorage on the patient's own
 * device — it never leaves it. That is a real limitation (no clinician
 * dashboard can see it, it doesn't follow the patient to a new phone) and a
 * deliberate one for a prototype: it means there is nothing to build a login
 * system for yet, and nothing sensitive sitting on a server.
 */

export type RehabArea = 'shoulder' | 'knee' | 'hip' | 'ankle' | 'back' | 'other';

export const DEFAULT_AREA: RehabArea = 'shoulder';
export type Prescriber = 'physio' | 'doctor' | 'center' | 'other';

export interface PatientProfile {
  name: string;
  age: number | null;
  area: RehabArea;
  prescriber: Prescriber;
}

const STORAGE_KEY = 'kine.profile.v1';

export function loadProfile(): PatientProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PatientProfile>;
    if (!p.name || !p.area || !p.prescriber) return null;
    return {
      name: p.name,
      age: typeof p.age === 'number' ? p.age : null,
      area: p.area,
      prescriber: p.prescriber,
    };
  } catch {
    return null;
  }
}

export function saveProfile(profile: PatientProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

/**
 * A day's programme for a rehab area: an ordered list of the shipped
 * exercises.
 *
 * This is a placeholder standing in for a clinician-assigned programme (see
 * README — a clinician prescribes, the app coaches). It exists so the demo has
 * a sensible, realistic session on the home screen, not as a substitute for
 * clinical assignment.
 *
 * Order matters for the patient, not just the muscles: seated → standing →
 * lying, so nobody gets up off the floor to sit back down on a chair.
 */
export interface ProgramItem {
  exerciseId: string;
  targetReps: number;
}

const UPPER_BODY_SEATED = ['seated_shoulder_abduction', 'seated_overhead_reach', 'seated_elbow_flexion'];

const AREA_TO_PROGRAM: Record<RehabArea, string[]> = {
  // Entirely seated, arms only: the default, and the easiest to try out.
  shoulder: UPPER_BODY_SEATED,
  knee: ['seated_knee_extension', 'sit_to_stand', 'straight_leg_raise'],
  hip: ['sit_to_stand', 'standing_hip_abduction', 'straight_leg_raise'],
  ankle: ['seated_knee_extension', 'sit_to_stand', 'heel_raises'],
  back: ['seated_overhead_reach', 'seated_shoulder_abduction', 'seated_knee_extension'],
  other: UPPER_BODY_SEATED,
};

/** Where the patient is for an exercise — shown on Home so nobody is surprised. */
export type Position = 'seated' | 'standing' | 'lying';

const POSITION: Record<string, Position> = {
  seated_shoulder_abduction: 'seated',
  seated_overhead_reach: 'seated',
  seated_elbow_flexion: 'seated',
  seated_knee_extension: 'seated',
  sit_to_stand: 'standing',
  standing_hip_abduction: 'standing',
  heel_raises: 'standing',
  straight_leg_raise: 'lying',
};

export function exercisePosition(exerciseId: string): Position {
  return POSITION[exerciseId] ?? 'seated';
}

export const DEFAULT_TARGET_REPS = 10;

export function programForArea(area: RehabArea): ProgramItem[] {
  return AREA_TO_PROGRAM[area].map((exerciseId) => ({
    exerciseId,
    targetReps: DEFAULT_TARGET_REPS,
  }));
}
