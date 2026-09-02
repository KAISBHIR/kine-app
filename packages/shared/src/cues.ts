/**
 * THE CUE CATALOGUE.
 *
 * Every sentence the application is permitted to say to a patient lives here,
 * and nowhere else. No component may hardcode patient-facing copy.
 *
 * Each entry carries its own clinical review status. `assertPatientSafe()`
 * refuses to serve a `draft` cue in a patient-facing build, which is how the
 * "what is the app allowed to tell a patient?" decision is enforced in code
 * rather than in a document nobody reads.
 *
 * OWNER: clinical advisors. Engineers propose, clinicians approve.
 */

export type Locale = 'fr' | 'ar' | 'en';

export const LOCALES: Locale[] = ['fr', 'ar', 'en'];

export const RTL_LOCALES: ReadonlySet<Locale> = new Set<Locale>(['ar']);

export type ReviewStatus = 'draft' | 'clinically_approved';

export interface Cue {
  /** Stable key referenced by exercise definitions and UI code. */
  key: string;
  fr: string;
  ar: string;
  en: string;
  status: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  /** Audio clip basename per locale, e.g. "cue.good" -> fr/cue.good.mp3 */
  audio?: boolean;
  /** Guidance for the clinician reviewing this string. */
  note?: string;
}

function cue(
  key: string,
  fr: string,
  ar: string,
  en: string,
  extra: Partial<Cue> = {},
): Cue {
  return { key, fr, ar, en, status: 'draft', audio: true, ...extra };
}

export const CUES: Cue[] = [
  // --- Session framing ---------------------------------------------------
  cue('cue.session_ready', 'Votre séance est prête.', 'جلستك جاهزة.', 'Your session is ready.'),
  cue('cue.get_ready', 'Préparez-vous.', 'استعد.', 'Get ready.'),
  cue('cue.start', 'Commencez.', 'ابدأ.', 'Start.'),
  cue('cue.rest', 'Reposez-vous.', 'استرح.', 'Rest.'),
  cue('cue.next_exercise', 'Exercice suivant.', 'التمرين التالي.', 'Next exercise.'),
  cue('cue.set_complete', 'Série terminée.', 'انتهت المجموعة.', 'Set complete.'),
  cue('cue.session_complete', 'Séance terminée. Bravo.', 'انتهت الجلسة. أحسنت.', 'Session complete. Well done.'),

  // --- Camera setup ------------------------------------------------------
  cue(
    'cue.setup_distance',
    'Reculez jusqu’à ce que je voie tout votre corps.',
    'تراجع إلى الخلف حتى أرى جسمك بالكامل.',
    'Step back until I can see your whole body.',
  ),
  cue(
    'cue.setup_side_view',
    'Tournez-vous de côté par rapport au téléphone.',
    'استدر بحيث يكون جانبك نحو الهاتف.',
    'Turn so your side faces the phone.',
  ),
  cue('cue.setup_ready', 'Parfait, je vous vois.', 'ممتاز، أراك الآن.', 'Perfect, I can see you.'),
  cue(
    'cue.setup_lighting',
    'La pièce est un peu sombre. Allumez une lumière si possible.',
    'الإضاءة خافتة قليلاً. أضئ النور إن أمكن.',
    'The room is a little dark. Turn on a light if you can.',
  ),

  // --- Tracking loss -----------------------------------------------------
  cue(
    'cue.cannot_see_leg',
    'Je ne vois plus votre jambe.',
    'لم أعد أرى ساقك.',
    'I can no longer see your leg.',
  ),
  cue(
    'cue.cannot_see_body',
    'Je ne vous vois plus. Replacez-vous devant le téléphone.',
    'لم أعد أراك. عد أمام الهاتف من فضلك.',
    'I can no longer see you. Please move back in front of the phone.',
  ),
  cue('cue.tracking_restored', 'C’est bon, je vous revois.', 'جيد، أراك من جديد.', 'Good, I can see you again.'),

  // --- Encouragement (fires on a good rep) -------------------------------
  cue('cue.good', 'Bien.', 'جيد.', 'Good.'),
  cue('cue.excellent', 'Excellent.', 'ممتاز.', 'Excellent.'),
  cue('cue.keep_going', 'Continuez.', 'واصل.', 'Keep going.'),
  cue('cue.two_more', 'Encore deux.', 'اثنان بعد.', 'Two more.'),
  cue('cue.last_one', 'Dernière.', 'الأخيرة.', 'Last one.'),

  // --- Form correction ---------------------------------------------------
  // These are the highest-risk strings in the product. They must be
  // encouraging, never alarming, and never imply a clinical judgement.
  cue(
    'cue.extend_further',
    'Essayez de tendre la jambe un peu plus.',
    'حاول مدّ ساقك أكثر قليلاً.',
    'Try extending your leg a little further.',
    { note: 'Fires on a partial rep. Must not sound like failure.' },
  ),
  cue(
    'cue.keep_back_against_chair',
    'Gardez le dos contre la chaise.',
    'أبقِ ظهرك مسنداً إلى الكرسي.',
    'Keep your back against the chair.',
  ),
  cue('cue.slow_down', 'Ralentissez.', 'تمهّل.', 'Slow down.'),
  cue(
    'cue.control_the_return',
    'Redescendez lentement.',
    'انزل ببطء.',
    'Lower slowly.',
  ),
  cue(
    'cue.keep_hips_down',
    'Gardez les hanches posées.',
    'أبقِ وركيك ثابتين على المقعد.',
    'Keep your hips down.',
  ),
  cue('cue.stand_tall', 'Restez bien droit.', 'قف مستقيماً.', 'Stand tall.'),
  cue(
    'cue.keep_knee_straight',
    'Gardez le genou tendu.',
    'أبقِ ركبتك مستقيمة.',
    'Keep your knee straight.',
  ),

  // --- Safety ------------------------------------------------------------
  // Reviewed with clinicians FIRST. The app never diagnoses and never
  // characterises a symptom.
  cue(
    'cue.safety_preamble',
    'Arrêtez l’exercice en cas de douleur forte, de vertige, de douleur dans la poitrine ou de difficulté à respirer.',
    'توقف عن التمرين إذا شعرت بألم شديد أو دوخة أو ألم في الصدر أو صعوبة في التنفس.',
    'Stop the exercise if you feel severe pain, dizziness, chest pain, or difficulty breathing.',
    { audio: false },
  ),
  cue(
    'cue.how_are_you_feeling',
    'Comment vous sentez-vous ?',
    'كيف تشعر؟',
    'How are you feeling?',
  ),
  cue(
    'cue.session_stopped',
    'Séance arrêtée. Reposez-vous.',
    'تم إيقاف الجلسة. استرح.',
    'Session stopped. Please rest.',
  ),
  cue(
    'cue.contact_clinician',
    'Votre kinésithérapeute a été informé de votre demande.',
    'تم إبلاغ أخصائي العلاج الطبيعي بطلبك.',
    'Your physiotherapist has been notified of your request.',
    { audio: false },
  ),
];

/** Spoken counting, 1..15. Kept separate: these are pure numerals, not clinical copy. */
export const COUNT_CUES: Record<Locale, string[]> = {
  fr: ['un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
       'onze', 'douze', 'treize', 'quatorze', 'quinze'],
  ar: ['واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
       'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر'],
  en: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
       'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen'],
};

const BY_KEY = new Map(CUES.map((c) => [c.key, c]));

export function getCue(key: string): Cue {
  const c = BY_KEY.get(key);
  if (!c) throw new Error(`Unknown cue key "${key}". Add it to the cue catalogue first.`);
  return c;
}

export function say(key: string, locale: Locale): string {
  return getCue(key)[locale];
}

export function countWord(n: number, locale: Locale): string {
  return COUNT_CUES[locale][n - 1] ?? String(n);
}

/**
 * Hard gate for patient-facing builds. Call this at app startup.
 * Throws if any cue that could reach a patient is still unreviewed.
 */
export function assertPatientSafe(): void {
  const unapproved = CUES.filter((c) => c.status !== 'clinically_approved');
  if (unapproved.length > 0) {
    throw new Error(
      `${unapproved.length} cue(s) are not clinically approved and cannot ship to patients:\n` +
        unapproved.map((c) => `  - ${c.key}`).join('\n'),
    );
  }
}

export function reviewProgress(): { approved: number; total: number } {
  return {
    approved: CUES.filter((c) => c.status === 'clinically_approved').length,
    total: CUES.length,
  };
}
