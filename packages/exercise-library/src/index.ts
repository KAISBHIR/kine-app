import type { ExerciseDefinition } from '@kine/movement-engine';
import { validateDefinition } from './validate.js';

import seatedKneeExtension from '../definitions/seated_knee_extension.json';
import sitToStand from '../definitions/sit_to_stand.json';
import straightLegRaise from '../definitions/straight_leg_raise.json';
import heelRaises from '../definitions/heel_raises.json';
import standingHipAbduction from '../definitions/standing_hip_abduction.json';

const RAW: unknown[] = [
  seatedKneeExtension,
  sitToStand,
  straightLegRaise,
  heelRaises,
  standingHipAbduction,
];

const ALL: ExerciseDefinition[] = RAW.map(validateDefinition);
const BY_ID = new Map(ALL.map((d) => [d.id, d]));

export function listExercises(): ExerciseDefinition[] {
  return [...ALL];
}

export function getExercise(id: string): ExerciseDefinition {
  const d = BY_ID.get(id);
  if (!d) {
    throw new Error(
      `Unknown exercise "${id}". Available: ${[...BY_ID.keys()].join(', ')}`,
    );
  }
  return d;
}

export class ExerciseNotApprovedError extends Error {
  constructor(id: string) {
    super(
      `Exercise "${id}" has clinical.status "draft" and must not be served to a patient. ` +
        `A clinician must review it and set status to "clinically_approved".`,
    );
    this.name = 'ExerciseNotApprovedError';
  }
}

/**
 * The gate. Patient-facing code paths call THIS, never getExercise().
 *
 * An unreviewed exercise is a set of numbers an engineer guessed. Serving one
 * to a patient is the single failure mode that would justify every worry a
 * physiotherapist has about software like this, so it is blocked in code
 * rather than in a policy document.
 */
export function getApprovedExercise(id: string): ExerciseDefinition {
  const d = getExercise(id);
  if (d.clinical.status !== 'clinically_approved') throw new ExerciseNotApprovedError(id);
  return d;
}

export function approvalStatus(): { approved: string[]; draft: string[] } {
  return {
    approved: ALL.filter((d) => d.clinical.status === 'clinically_approved').map((d) => d.id),
    draft: ALL.filter((d) => d.clinical.status !== 'clinically_approved').map((d) => d.id),
  };
}

export { validateDefinition, ExerciseDefinitionError } from './validate.js';
