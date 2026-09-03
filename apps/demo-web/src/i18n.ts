import { LOCALES, RTL_LOCALES, type Locale } from '@kine/shared';

/**
 * UI chrome strings — labels, headings, button text.
 *
 * Deliberately separate from packages/shared/src/cues.ts. The cue catalogue is
 * clinically-reviewed spoken/written guidance said TO a patient during an
 * exercise; it has a review workflow because a wrong sentence there is a
 * safety issue. This file is interface chrome ("Continuer", "Nom") — normal
 * product copy, no clinical review needed. Keeping them apart means the cue
 * catalogue's review process never gets diluted by menu labels.
 */

type Key =
  | 'lang.prompt'
  | 'lang.fr'
  | 'lang.ar'
  | 'lang.en'
  | 'profile.title'
  | 'profile.lead'
  | 'profile.name'
  | 'profile.namePlaceholder'
  | 'profile.age'
  | 'profile.area'
  | 'profile.prescriber'
  | 'profile.continue'
  | 'area.knee'
  | 'area.hip'
  | 'area.ankle'
  | 'area.back'
  | 'area.shoulder'
  | 'area.other'
  | 'prescriber.physio'
  | 'prescriber.doctor'
  | 'prescriber.center'
  | 'prescriber.other'
  | 'home.greeting'
  | 'home.ready'
  | 'home.sessionInfo'
  | 'home.start'
  | 'home.changeExercise'
  | 'home.advanced'
  | 'home.videoConsent'
  | 'home.videoConsentHint'
  | 'home.editProfile'
  | 'replay.title'
  | 'replay.hint'
  | 'replay.play'
  | 'replay.pause'
  | 'video.title'
  | 'video.hint'
  | 'video.share'
  | 'video.download'
  | 'video.unsupported'
  | 'nav.back';

type Dict = Record<Key, string>;

const STRINGS: Record<Locale, Dict> = {
  fr: {
    'lang.prompt': 'Choisissez votre langue',
    'lang.fr': 'Français',
    'lang.ar': 'العربية',
    'lang.en': 'English',
    'profile.title': 'Faisons connaissance',
    'profile.lead': 'Quelques informations avant de commencer.',
    'profile.name': 'Votre prénom',
    'profile.namePlaceholder': 'Ex. Fatima',
    'profile.age': 'Âge',
    'profile.area': 'Zone de rééducation',
    'profile.prescriber': 'Qui a prescrit ce programme ?',
    'profile.continue': 'Continuer',
    'area.knee': 'Genou',
    'area.hip': 'Hanche',
    'area.ankle': 'Cheville',
    'area.back': 'Dos',
    'area.shoulder': 'Épaule',
    'area.other': 'Autre',
    'prescriber.physio': 'Kinésithérapeute',
    'prescriber.doctor': 'Médecin',
    'prescriber.center': 'Centre de rééducation',
    'prescriber.other': 'Autre',
    'home.greeting': 'Bonjour {name}',
    'home.ready': 'Votre séance est prête',
    'home.sessionInfo': '{count} exercice · environ {minutes} min',
    'home.start': 'Commencer la séance',
    'home.changeExercise': 'Changer d’exercice',
    'home.advanced': 'Options avancées',
    'home.videoConsent': 'Enregistrer une vidéo pour mon kiné',
    'home.videoConsentHint':
      'Optionnel. Sans cette option, seul le squelette (aucune image de vous) est conservé.',
    'home.editProfile': 'Modifier le profil',
    'replay.title': 'Revoir la séance',
    'replay.hint': 'Rejoue le squelette enregistré — aucune image de vous n’est stockée.',
    'replay.play': 'Lecture',
    'replay.pause': 'Pause',
    'video.title': 'Vidéo de la séance',
    'video.hint': 'Enregistrée avec votre accord, pour votre kinésithérapeute.',
    'video.share': 'Partager avec mon kiné',
    'video.download': 'Télécharger',
    'video.unsupported': 'Enregistrement vidéo non pris en charge par ce navigateur.',
    'nav.back': 'Retour',
  },
  ar: {
    'lang.prompt': 'اختر لغتك',
    'lang.fr': 'Français',
    'lang.ar': 'العربية',
    'lang.en': 'English',
    'profile.title': 'لنتعرف عليك',
    'profile.lead': 'بعض المعلومات قبل البدء.',
    'profile.name': 'اسمك',
    'profile.namePlaceholder': 'مثال: فاطمة',
    'profile.age': 'العمر',
    'profile.area': 'منطقة إعادة التأهيل',
    'profile.prescriber': 'من وصف هذا البرنامج؟',
    'profile.continue': 'متابعة',
    'area.knee': 'الركبة',
    'area.hip': 'الورك',
    'area.ankle': 'الكاحل',
    'area.back': 'الظهر',
    'area.shoulder': 'الكتف',
    'area.other': 'أخرى',
    'prescriber.physio': 'أخصائي علاج طبيعي',
    'prescriber.doctor': 'طبيب',
    'prescriber.center': 'مركز إعادة تأهيل',
    'prescriber.other': 'أخرى',
    'home.greeting': 'مرحباً {name}',
    'home.ready': 'جلستك جاهزة',
    'home.sessionInfo': '{count} تمرين · حوالي {minutes} دقيقة',
    'home.start': 'ابدأ الجلسة',
    'home.changeExercise': 'تغيير التمرين',
    'home.advanced': 'خيارات متقدمة',
    'home.videoConsent': 'تسجيل فيديو لأخصائي العلاج الطبيعي',
    'home.videoConsentHint':
      'اختياري. بدون هذا الخيار، يُحفظ الهيكل العظمي فقط (لا صورة لك).',
    'home.editProfile': 'تعديل الملف الشخصي',
    'replay.title': 'إعادة مشاهدة الجلسة',
    'replay.hint': 'إعادة تشغيل الهيكل العظمي المسجَّل — لا تُحفظ أي صورة لك.',
    'replay.play': 'تشغيل',
    'replay.pause': 'إيقاف مؤقت',
    'video.title': 'فيديو الجلسة',
    'video.hint': 'سُجِّل بموافقتك، لأخصائي العلاج الطبيعي.',
    'video.share': 'مشاركة مع أخصائي العلاج الطبيعي',
    'video.download': 'تنزيل',
    'video.unsupported': 'تسجيل الفيديو غير مدعوم في هذا المتصفح.',
    'nav.back': 'رجوع',
  },
  en: {
    'lang.prompt': 'Choose your language',
    'lang.fr': 'Français',
    'lang.ar': 'العربية',
    'lang.en': 'English',
    'profile.title': "Let's get to know you",
    'profile.lead': 'A few details before we start.',
    'profile.name': 'Your first name',
    'profile.namePlaceholder': 'e.g. Sarah',
    'profile.age': 'Age',
    'profile.area': 'Rehabilitation area',
    'profile.prescriber': 'Who prescribed this programme?',
    'profile.continue': 'Continue',
    'area.knee': 'Knee',
    'area.hip': 'Hip',
    'area.ankle': 'Ankle',
    'area.back': 'Back',
    'area.shoulder': 'Shoulder',
    'area.other': 'Other',
    'prescriber.physio': 'Physiotherapist',
    'prescriber.doctor': 'Doctor',
    'prescriber.center': 'Rehabilitation centre',
    'prescriber.other': 'Other',
    'home.greeting': 'Hello {name}',
    'home.ready': 'Your session is ready',
    'home.sessionInfo': '{count} exercise · about {minutes} min',
    'home.start': 'Start session',
    'home.changeExercise': 'Change exercise',
    'home.advanced': 'Advanced options',
    'home.videoConsent': 'Record a video for my physiotherapist',
    'home.videoConsentHint':
      'Optional. Without this, only the skeleton (no image of you) is kept.',
    'home.editProfile': 'Edit profile',
    'replay.title': 'Watch the session again',
    'replay.hint': 'Replays the recorded skeleton — no image of you is ever stored.',
    'replay.play': 'Play',
    'replay.pause': 'Pause',
    'video.title': 'Session video',
    'video.hint': 'Recorded with your consent, for your physiotherapist.',
    'video.share': 'Share with my physiotherapist',
    'video.download': 'Download',
    'video.unsupported': 'Video recording is not supported by this browser.',
    'nav.back': 'Back',
  },
};

const STORAGE_KEY = 'kine.locale.v1';

let current: Locale = 'fr';

export function getLocale(): Locale {
  return current;
}

export function loadStoredLocale(): Locale | null {
  const v = localStorage.getItem(STORAGE_KEY);
  return v && (LOCALES as string[]).includes(v) ? (v as Locale) : null;
}

/** Sets the active locale, persists it, and flips document dir/lang for RTL. */
export function setLocale(locale: Locale): void {
  current = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
  document.documentElement.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

export function t(key: Key, vars?: Record<string, string | number>): string {
  let s = STRINGS[current][key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

/** Applies t() to every element carrying a data-i18n key. Call after any locale change. */
export function applyI18n(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = el.dataset.i18n as Key;
    el.textContent = t(key);
  }
  for (const el of root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]')) {
    const key = el.dataset.i18nPlaceholder as Key;
    el.placeholder = t(key);
  }
}
