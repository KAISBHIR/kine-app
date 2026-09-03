/**
 * The patient's local profile.
 *
 * There is no backend yet, so this lives in localStorage on the patient's own
 * device — it never leaves it. That is a real limitation (no clinician
 * dashboard can see it, it doesn't follow the patient to a new phone) and a
 * deliberate one for a prototype: it means there is nothing to build a login
 * system for yet, and nothing sensitive sitting on a server.
 */

export type RehabArea = 'knee' | 'hip' | 'ankle' | 'back' | 'shoulder' | 'other';
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
 * Which of the five shipped exercises best matches a rehab area.
 *
 * This is a placeholder standing in for a clinician-assigned programme (see
 * README — a clinician prescribes, the app coaches). It exists so the demo has
 * *something* sensible to put on the home screen rather than an empty state,
 * not as a substitute for clinical assignment.
 */
const AREA_TO_EXERCISE: Record<RehabArea, string> = {
  knee: 'seated_knee_extension',
  hip: 'standing_hip_abduction',
  ankle: 'heel_raises',
  back: 'sit_to_stand',
  shoulder: 'sit_to_stand', // no upper-body exercise shipped yet — closest available
  other: 'straight_leg_raise',
};

export function exerciseForArea(area: RehabArea): string {
  return AREA_TO_EXERCISE[area];
}
