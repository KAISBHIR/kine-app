import {
  landmarkIndex,
  type Frame,
  type FormCueEvent,
  type Landmark,
  type Side,
} from '@kine/shared';
import { segmentTiltFromVerticalDeg } from './math';
import { jointAngle, point } from './signal';
import type { FormRuleSpec } from './definition';

export interface FormContext {
  frame: Frame;
  side: Side;
  /** Rate of change of the primary signal, degrees per second. */
  velocityDegPerSec: number;
  /** Landmarks captured at the moment the current rep started. */
  repStartLandmarks: Landmark[] | null;
}

interface RuleState {
  violatingSince: number | null;
  lastFiredAt: number;
}

/**
 * Evaluates declarative form rules.
 *
 * Two dampers matter more than the rules themselves:
 *
 *   debounceMs — the violation must persist before we say anything, so a
 *                single noisy frame never triggers a correction.
 *   cooldownMs — a rule cannot fire again immediately, so a patient who
 *                genuinely cannot keep their back flat is told once, not
 *                thirty times.
 *
 * Bias the whole layer toward silence. A missed cue costs nothing. A wrong cue
 * costs the patient's trust, and they will not give it back.
 */
export class FormRuleEvaluator {
  private readonly state = new Map<string, RuleState>();

  constructor(private readonly rules: FormRuleSpec[]) {
    for (const r of rules) {
      this.state.set(r.id, { violatingSince: null, lastFiredAt: -Infinity });
    }
  }

  evaluate(ctx: FormContext): FormCueEvent[] {
    const events: FormCueEvent[] = [];
    const t = ctx.frame.t;

    for (const rule of this.rules) {
      const st = this.state.get(rule.id);
      if (!st) continue;

      const violating = this.isViolating(rule, ctx);

      if (!violating) {
        st.violatingSince = null;
        continue;
      }

      st.violatingSince ??= t;
      const heldFor = t - st.violatingSince;
      const sinceLastFire = t - st.lastFiredAt;

      if (heldFor >= rule.debounceMs && sinceLastFire >= rule.cooldownMs) {
        st.lastFiredAt = t;
        st.violatingSince = null;
        events.push({
          kind: 'formCue',
          ruleId: rule.id,
          severity: rule.severity,
          cueKey: rule.cueKey,
        });
      }
    }

    return events;
  }

  reset(): void {
    for (const st of this.state.values()) {
      st.violatingSince = null;
      st.lastFiredAt = -Infinity;
    }
  }

  private isViolating(rule: FormRuleSpec, ctx: FormContext): boolean {
    const { frame, side } = ctx;

    switch (rule.type) {
      case 'segmentTilt': {
        const a = point(frame, rule.from, side);
        const b = point(frame, rule.to, side);
        if (!a || !b) return false;
        return segmentTiltFromVerticalDeg(a, b) > rule.maxDeg;
      }

      case 'jointAngle': {
        const angle = jointAngle(frame, rule.joint, side);
        if (angle === null) return false;
        if (rule.minDeg !== undefined && angle < rule.minDeg) return true;
        if (rule.maxDeg !== undefined && angle > rule.maxDeg) return true;
        return false;
      }

      case 'velocity':
        return Math.abs(ctx.velocityDegPerSec) > rule.maxDegPerSec;

      case 'landmarkDrift': {
        if (!ctx.repStartLandmarks) return false;
        const idx = landmarkIndex(rule.part, side);
        const now = frame.landmarks[idx];
        const base = ctx.repStartLandmarks[idx];
        if (!now || !base) return false;
        const delta = rule.axis === 'x' ? now.x - base.x : now.y - base.y;
        return Math.abs(delta) > rule.maxDelta;
      }
    }
  }
}
