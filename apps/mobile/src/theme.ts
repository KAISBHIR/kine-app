/**
 * Design tokens.
 *
 * These encode the accessibility floor the product has to meet, because the
 * primary user is an older adult holding a phone at arm's length in a living
 * room, often without their reading glasses:
 *
 *   - body text starts at 20px, never below 17
 *   - every tappable target is at least 68px tall
 *   - text/background pairs clear 4.5:1 contrast
 *   - nothing is communicated by colour alone; state always has a word too
 *
 * The designer refines these values. They should not relax the floors.
 */

export const colors = {
  bg: '#0F172A',
  surface: '#1E293B',
  surfaceAlt: '#334155',
  border: '#475569',

  text: '#F8FAFC',
  textMuted: '#CBD5E1',

  accent: '#22C55E',
  onAccent: '#052E16',

  warn: '#FBBF24',
  onWarn: '#422006',

  danger: '#EF4444',
  onDanger: '#FFFFFF',

  skeleton: '#38BDF8',
  skeletonActive: '#22C55E',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const type = {
  /** Rep counter. Must be legible from two metres away. */
  display: { fontSize: 88, fontWeight: '800', lineHeight: 92 },
  title: { fontSize: 34, fontWeight: '700', lineHeight: 40 },
  heading: { fontSize: 26, fontWeight: '700', lineHeight: 32 },
  /** Coaching cues. Large on purpose — this is the text that must be read mid-exercise. */
  cue: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  body: { fontSize: 20, fontWeight: '400', lineHeight: 28 },
  label: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  caption: { fontSize: 15, fontWeight: '400', lineHeight: 20 },
} as const;

/** Minimum height for anything a patient has to tap. Do not go below this. */
export const TOUCH_TARGET = 68;
