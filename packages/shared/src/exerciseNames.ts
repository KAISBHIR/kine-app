import type { Locale } from './cues';

/**
 * Display + spoken names for exercises. Kept beside the cue catalogue because
 * they are read aloud ("Exercice suivant : extension du genou") and therefore
 * go through the same clinical review as any other patient-facing string.
 */
export const EXERCISE_NAMES: Record<string, Record<Locale, string>> = {
  'exercise.seated_shoulder_abduction': {
    fr: 'Élévation latérale des bras',
    ar: 'رفع الذراعين جانبياً',
    en: 'Side arm raises',
  },
  'exercise.seated_overhead_reach': {
    fr: 'Bras tendus vers le haut',
    ar: 'مدّ الذراعين إلى الأعلى',
    en: 'Overhead reach',
  },
  'exercise.seated_elbow_flexion': {
    fr: 'Flexion des coudes',
    ar: 'ثني المرفقين',
    en: 'Elbow bends',
  },
  'exercise.seated_knee_extension': {
    fr: 'Extension du genou assis',
    ar: 'بسط الركبة في وضعية الجلوس',
    en: 'Seated knee extension',
  },
  'exercise.sit_to_stand': {
    fr: 'Passage assis-debout',
    ar: 'الانتقال من الجلوس إلى الوقوف',
    en: 'Sit to stand',
  },
  'exercise.straight_leg_raise': {
    fr: 'Élévation jambe tendue',
    ar: 'رفع الساق الممدودة',
    en: 'Straight leg raise',
  },
  'exercise.heel_raises': {
    fr: 'Élévations sur la pointe des pieds',
    ar: 'الوقوف على أطراف الأصابع',
    en: 'Heel raises',
  },
  'exercise.standing_hip_abduction': {
    fr: 'Abduction de hanche debout',
    ar: 'تبعيد الورك في وضعية الوقوف',
    en: 'Standing hip abduction',
  },
};

export function exerciseName(key: string, locale: Locale): string {
  const entry = EXERCISE_NAMES[key];
  if (!entry) throw new Error(`Unknown exercise name key "${key}"`);
  return entry[locale];
}
