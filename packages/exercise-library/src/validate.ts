import { EXERCISE_NAMES, getCue, isBodyPart, jointChain } from '@kine/shared';
import { repDirection, type ExerciseDefinition } from '@kine/movement-engine';

export class ExerciseDefinitionError extends Error {
  constructor(id: string, problems: string[]) {
    super(`Exercise "${id}" is invalid:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ExerciseDefinitionError';
  }
}

/**
 * Structural and semantic validation of an exercise definition.
 *
 * This runs at load time in every build. Exercise definitions are authored by
 * clinicians, not engineers, and eventually come from a database rather than
 * the repo — a typo in a threshold must fail loudly here rather than silently
 * produce a rep detector that never fires.
 */
export function validateDefinition(raw: unknown): ExerciseDefinition {
  const problems: string[] = [];
  const d = raw as ExerciseDefinition;
  const id = typeof d?.id === 'string' ? d.id : '<missing id>';

  if (!d || typeof d !== 'object') throw new ExerciseDefinitionError(id, ['not an object']);
  if (typeof d.id !== 'string' || !d.id) problems.push('id must be a non-empty string');
  if (typeof d.version !== 'number') problems.push('version must be a number');

  if (!d.nameKey || !EXERCISE_NAMES[d.nameKey]) {
    problems.push(`nameKey "${d.nameKey}" is not in the exercise name catalogue`);
  }

  if (d.clinical?.status !== 'draft' && d.clinical?.status !== 'clinically_approved') {
    problems.push('clinical.status must be "draft" or "clinically_approved"');
  }

  if (!Array.isArray(d.requiredParts) || d.requiredParts.length === 0) {
    problems.push('requiredParts must be a non-empty array');
  } else {
    for (const p of d.requiredParts) {
      if (!isBodyPart(p)) problems.push(`requiredParts contains unknown body part "${p}"`);
    }
  }

  if (d.side !== 'auto' && d.side !== 'left' && d.side !== 'right') {
    problems.push('side must be "auto", "left" or "right"');
  }

  // --- signal ------------------------------------------------------------
  const sig = d.signal;
  if (!sig || typeof sig !== 'object') {
    problems.push('signal is required');
  } else if (sig.type === 'jointAngle') {
    if (!isBodyPart(sig.joint)) {
      problems.push(`signal.joint "${sig.joint}" is not a body part`);
    } else {
      try {
        jointChain(sig.joint);
      } catch {
        problems.push(`signal.joint "${sig.joint}" has no joint chain and cannot form an angle`);
      }
    }
  } else if (sig.type === 'segmentTilt') {
    if (!isBodyPart(sig.from)) problems.push(`signal.from "${sig.from}" is not a body part`);
    if (!isBodyPart(sig.to)) problems.push(`signal.to "${sig.to}" is not a body part`);
  } else {
    problems.push(`signal.type "${(sig as { type: string }).type}" is not supported`);
  }

  // --- rep thresholds ----------------------------------------------------
  const rep = d.rep;
  if (!rep) {
    problems.push('rep block is required');
  } else {
    if (rep.enterDeg === rep.exitDeg) {
      problems.push('rep.enterDeg and rep.exitDeg must differ (they form the hysteresis band)');
    }
    if (!(rep.minDurationMs > 0)) problems.push('rep.minDurationMs must be > 0');
    if (!(rep.maxDurationMs > rep.minDurationMs)) {
      problems.push('rep.maxDurationMs must be greater than rep.minDurationMs');
    }
    if (!(rep.minHoldMs >= 0)) problems.push('rep.minHoldMs must be >= 0');
  }

  // --- range of motion ---------------------------------------------------
  if (!d.rom) {
    problems.push('rom block is required');
  } else if (rep && rep.enterDeg !== rep.exitDeg) {
    const s = repDirection(d) === 'increasing' ? 1 : -1;
    if (!(s * d.rom.goalPeakDeg > s * d.rom.minAcceptablePeakDeg)) {
      problems.push(
        `rom.goalPeakDeg (${d.rom.goalPeakDeg}) must be further along the movement direction ` +
          `than rom.minAcceptablePeakDeg (${d.rom.minAcceptablePeakDeg})`,
      );
    }
  }

  // --- camera ------------------------------------------------------------
  if (!d.camera) {
    problems.push('camera block is required');
  } else {
    if (d.camera.view !== 'side' && d.camera.view !== 'front') {
      problems.push('camera.view must be "side" or "front"');
    }
    assertCue(d.camera.setupCueKey, 'camera.setupCueKey', problems);
  }

  // --- form rules --------------------------------------------------------
  if (!Array.isArray(d.formRules)) {
    problems.push('formRules must be an array (use [] for none)');
  } else {
    const seen = new Set<string>();
    for (const r of d.formRules) {
      if (seen.has(r.id)) problems.push(`duplicate form rule id "${r.id}"`);
      seen.add(r.id);
      assertCue(r.cueKey, `formRules.${r.id}.cueKey`, problems);
      if (r.severity !== 'info' && r.severity !== 'warn') {
        problems.push(`formRules.${r.id}.severity must be "info" or "warn"`);
      }
      if (!(r.debounceMs >= 0)) problems.push(`formRules.${r.id}.debounceMs must be >= 0`);
      if (!(r.cooldownMs >= 0)) problems.push(`formRules.${r.id}.cooldownMs must be >= 0`);
      if (r.type === 'jointAngle' && r.minDeg === undefined && r.maxDeg === undefined) {
        problems.push(`formRules.${r.id} needs at least one of minDeg / maxDeg`);
      }
    }
  }

  if (!d.safety) problems.push('safety block is required');

  if (problems.length > 0) throw new ExerciseDefinitionError(id, problems);
  return d;
}

function assertCue(key: string, field: string, problems: string[]): void {
  if (!key) {
    problems.push(`${field} is required`);
    return;
  }
  try {
    getCue(key);
  } catch {
    problems.push(`${field} references cue "${key}" which is not in the cue catalogue`);
  }
}
