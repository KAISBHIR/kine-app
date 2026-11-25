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
 *
 * EVERY visible string in the app must come from here (or from the cue
 * catalogue). A hardcoded literal in a template — even one line — means an
 * English or Arabic speaker hits French mid-flow the moment they reach that
 * screen, which is worse than not translating at all: it looks broken rather
 * than unfinished.
 */

type Key =
  | 'lang.prompt'
  | 'lang.fr'
  | 'lang.ar'
  | 'lang.en'
  | 'profile.eyebrow'
  | 'profile.title'
  | 'profile.lead'
  | 'profile.name'
  | 'profile.namePlaceholder'
  | 'profile.age'
  | 'profile.area'
  | 'profile.prescriber'
  | 'profile.continue'
  | 'profile.back'
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
  | 'home.videoConsent'
  | 'home.videoConsentHint'
  | 'home.advanced'
  | 'home.editProfile'
  | 'home.setupHint'
  | 'banner.prototype'
  | 'session.finish'
  | 'app.name'
  | 'app.tag'
  | 'profile.optional'
  | 'areaHint.shoulder'
  | 'areaHint.knee'
  | 'areaHint.hip'
  | 'areaHint.ankle'
  | 'areaHint.back'
  | 'areaHint.other'
  | 'position.seated'
  | 'position.standing'
  | 'position.lying'
  | 'status.showUpperBody'
  | 'home.setupHintSeated'
  | 'home.programTitle'
  | 'home.repsEach'
  | 'home.language'
  | 'session.exerciseOf'
  | 'session.skip'
  | 'between.eyebrow'
  | 'between.countdown'
  | 'between.go'
  | 'done.perExercise'
  | 'done.repsShort'
  | 'done.notDone'
  | 'done.titleNone'
  | 'advanced.eyebrow'
  | 'advanced.title'
  | 'advanced.lead'
  | 'advanced.exercise'
  | 'advanced.reps'
  | 'advanced.start'
  | 'advanced.calibrate'
  | 'advanced.back'
  | 'status.preparing'
  | 'status.stepBack'
  | 'status.holdStill'
  | 'status.ready'
  | 'status.calibrateReady'
  | 'status.lost'
  | 'status.cameraError'
  | 'error.cameraDenied'
  | 'error.cameraNotFound'
  | 'error.insecureContext'
  | 'record.start'
  | 'record.stop'
  | 'record.notePrompt'
  | 'debug.label'
  | 'done.eyebrow'
  | 'done.title'
  | 'done.reps'
  | 'done.quality'
  | 'done.duration'
  | 'done.romLabel'
  | 'done.romDisclaimer'
  | 'done.cuesTitle'
  | 'done.again'
  | 'replay.title'
  | 'replay.hint'
  | 'replay.play'
  | 'replay.pause'
  | 'video.title'
  | 'video.hint'
  | 'video.share'
  | 'video.download'
  | 'cal.eyebrow'
  | 'cal.title'
  | 'cal.restAngle'
  | 'cal.peakAngle'
  | 'cal.movements'
  | 'cal.impossible'
  | 'cal.verdictOk'
  | 'cal.verdictBad'
  | 'cal.warningsTitle'
  | 'cal.definitionLabel'
  | 'cal.copy'
  | 'cal.copied'
  | 'cal.copyDenied'
  | 'cal.download'
  | 'cal.back'
  | 'nav.back';

type Dict = Record<Key, string>;

const STRINGS: Record<Locale, Dict> = {
  fr: {
    'lang.prompt': 'Choisissez votre langue',
    'lang.fr': 'Français',
    'lang.ar': 'العربية',
    'lang.en': 'English',

    'profile.eyebrow': 'Avant de commencer',
    'profile.title': "Bienvenue",
    'profile.lead': "Indiquez votre prénom pour commencer.",
    'profile.name': 'Votre prénom',
    'profile.namePlaceholder': 'Ex. Fatima',
    'profile.age': 'Âge',
    'profile.area': 'Zone de rééducation',
    'profile.prescriber': 'Qui a prescrit ce programme ?',
    'profile.continue': 'Continuer',
    'profile.back': 'Retour',
    'area.knee': 'Genou',
    'area.hip': 'Hanche',
    'area.ankle': 'Cheville',
    'area.back': 'Dos',
    'area.shoulder': "Épaule et bras",
    'area.other': 'Autre',
    'prescriber.physio': 'Kinésithérapeute',
    'prescriber.doctor': 'Médecin',
    'prescriber.center': 'Centre de rééducation',
    'prescriber.other': 'Autre',

    'home.greeting': 'Bonjour {name}',
    'home.ready': 'Votre séance est prête',
    'home.sessionInfo': '{count} exercices · environ {minutes} min',
    'home.start': 'Commencer la séance',
    'home.videoConsent': 'Enregistrer une vidéo pour mon kiné',
    'home.videoConsentHint':
      'Optionnel. Sans cette option, seul le squelette (aucune image de vous) est conservé.',
    'home.advanced': 'Options avancées',
    'home.editProfile': 'Modifier le profil',
    'home.setupHint':
      'Posez le téléphone debout, à environ 2 mètres. Tout votre corps doit être visible à l’écran.',
    'banner.prototype': 'Prototype — définitions non validées cliniquement',
    'done.titleNone': 'Séance arrêtée.',
    'session.finish': 'Terminer',
    'app.name': "Kiné à domicile",
    'app.tag': "Prototype",
    'profile.optional': "(facultatif)",
    'areaHint.shoulder': "Exercices assis",
    'areaHint.knee': "Assis, debout, allongé",
    'areaHint.hip': "Debout et allongé",
    'areaHint.ankle': "Assis et debout",
    'areaHint.back': "Principalement assis",
    'areaHint.other': "Exercices assis",
    'position.seated': "Assis",
    'position.standing': "Debout",
    'position.lying': "Allongé",
    'status.showUpperBody': "Asseyez-vous face au téléphone, le haut du corps visible",
    'home.setupHintSeated': "Posez le téléphone debout sur une table, à 1,5 – 2 mètres, et asseyez-vous face à lui. Vos bras et le haut de votre corps doivent être visibles.",
    'home.programTitle': "Programme du jour",
    'home.repsEach': "{reps} répétitions",
    'home.language': "Langue",
    'session.exerciseOf': "Exercice {n}/{total}",
    'session.skip': "Suivant",
    'between.eyebrow': "Bien joué — exercice suivant",
    'between.countdown': "Reprise automatique dans {s} s",
    'between.go': "Je suis prêt",
    'done.perExercise': "Détail par exercice",
    'done.repsShort': "rép.",
    'done.notDone': "non réalisé",

    'advanced.eyebrow': 'Options avancées',
    'advanced.title': 'Choisir un exercice',
    'advanced.lead': 'Posez le téléphone sur une table, à environ deux mètres.',
    'advanced.exercise': 'Exercice',
    'advanced.reps': 'Répétitions',
    'advanced.start': 'Commencer',
    'advanced.calibrate': 'Calibrer cet exercice',
    'advanced.back': 'Retour',

    'status.preparing': 'Préparation…',
    'status.stepBack': 'Reculez, je dois voir tout votre corps',
    'status.holdStill': 'Ne bougez pas…',
    'status.ready': 'Prêt',
    'status.calibrateReady': 'Faites 5 à 8 répétitions à votre rythme',
    'status.lost': 'Je ne vous vois plus',
    'status.cameraError': 'Erreur caméra : {message}',

    'error.cameraDenied':
      'Accès à la caméra refusé. Autorisez la caméra dans les réglages du navigateur.',
    'error.cameraNotFound': 'Aucune caméra détectée sur cet appareil.',
    'error.insecureContext': 'La caméra exige HTTPS. Ouvrez la page en https ou sur localhost.',

    'record.start': 'Enregistrer',
    'record.stop': 'Arrêter',
    'record.notePrompt': 'Note pour cet enregistrement ?',
    'debug.label': 'Détails',

    'done.eyebrow': 'Séance terminée',
    'done.title': 'Belle séance.',
    'done.reps': 'répétitions',
    'done.quality': 'qualité',
    'done.duration': 'durée',
    'done.romLabel': 'Amplitude estimée',
    'done.romDisclaimer': 'Valeur indicative issue de la caméra — ce n’est pas une mesure clinique.',
    'done.cuesTitle': 'Rappels donnés',
    'done.again': 'Nouvelle séance',

    'replay.title': 'Revoir la séance',
    'replay.hint': 'Rejoue le squelette enregistré — aucune image de vous n’est stockée.',
    'replay.play': 'Lecture',
    'replay.pause': 'Pause',

    'video.title': 'Vidéo de la séance',
    'video.hint': 'Enregistrée avec votre accord, pour votre kinésithérapeute.',
    'video.share': 'Partager avec mon kiné',
    'video.download': 'Télécharger',

    'cal.eyebrow': 'Calibration',
    'cal.title': 'Ajusté à vous.',
    'cal.restAngle': 'angle au repos',
    'cal.peakAngle': 'angle max',
    'cal.movements': 'mouvements',
    'cal.impossible': 'Calibration impossible.',
    'cal.verdictOk':
      'Vérifié : avec ces valeurs, le moteur compte {reps} répétitions, soit exactement ce que contient l’enregistrement.',
    'cal.verdictBad':
      'À revoir : le moteur compte {reps} répétitions alors que l’enregistrement en contient {expected}. Recommencez l’enregistrement avant d’utiliser ces valeurs.',
    'cal.warningsTitle': 'Remarques',
    'cal.definitionLabel': 'Définition calibrée',
    'cal.copy': 'Copier',
    'cal.copied': 'Copié',
    'cal.copyDenied': 'Copie refusée par le navigateur. Utilisez « Télécharger ».',
    'cal.download': 'Télécharger',
    'cal.back': 'Retour',

    'nav.back': '← Retour',
  },

  ar: {
    'lang.prompt': 'اختر لغتك',
    'lang.fr': 'Français',
    'lang.ar': 'العربية',
    'lang.en': 'English',

    'profile.eyebrow': 'قبل البدء',
    'profile.title': "مرحباً بك",
    'profile.lead': "اكتب اسمك الأول للبدء.",
    'profile.name': 'اسمك',
    'profile.namePlaceholder': 'مثال: فاطمة',
    'profile.age': 'العمر',
    'profile.area': 'منطقة إعادة التأهيل',
    'profile.prescriber': 'من وصف هذا البرنامج؟',
    'profile.continue': 'متابعة',
    'profile.back': 'رجوع',
    'area.knee': 'الركبة',
    'area.hip': 'الورك',
    'area.ankle': 'الكاحل',
    'area.back': 'الظهر',
    'area.shoulder': "الكتف والذراع",
    'area.other': 'أخرى',
    'prescriber.physio': 'أخصائي علاج طبيعي',
    'prescriber.doctor': 'طبيب',
    'prescriber.center': 'مركز إعادة تأهيل',
    'prescriber.other': 'أخرى',

    'home.greeting': 'مرحباً {name}',
    'home.ready': 'جلستك جاهزة',
    'home.sessionInfo': '{count} تمارين · حوالي {minutes} دقيقة',
    'home.start': 'ابدأ الجلسة',
    'home.videoConsent': 'تسجيل فيديو لأخصائي العلاج الطبيعي',
    'home.videoConsentHint': 'اختياري. بدون هذا الخيار، يُحفظ الهيكل العظمي فقط (لا صورة لك).',
    'home.advanced': 'خيارات متقدمة',
    'home.editProfile': 'تعديل الملف الشخصي',
    'home.setupHint': 'ضع الهاتف واقفاً على بعد مترين تقريباً. يجب أن يظهر جسمك بالكامل على الشاشة.',
    'banner.prototype': 'نموذج أولي — التمارين لم يُصادق عليها سريرياً بعد',
    'done.titleNone': 'تم إيقاف الجلسة.',
    'session.finish': 'إنهاء',
    'app.name': "العلاج الطبيعي في المنزل",
    'app.tag': "نموذج أولي",
    'profile.optional': "(اختياري)",
    'areaHint.shoulder': "تمارين في وضعية الجلوس",
    'areaHint.knee': "جلوس، وقوف، استلقاء",
    'areaHint.hip': "وقوف واستلقاء",
    'areaHint.ankle': "جلوس ووقوف",
    'areaHint.back': "غالباً في وضعية الجلوس",
    'areaHint.other': "تمارين في وضعية الجلوس",
    'position.seated': "جلوس",
    'position.standing': "وقوف",
    'position.lying': "استلقاء",
    'status.showUpperBody': "اجلس مقابل الهاتف بحيث يظهر الجزء العلوي من جسمك",
    'home.setupHintSeated': "ضع الهاتف واقفاً على طاولة على بعد متر ونصف إلى مترين، واجلس مقابله. يجب أن تظهر ذراعاك والجزء العلوي من جسمك.",
    'home.programTitle': "برنامج اليوم",
    'home.repsEach': "{reps} تكرارات",
    'home.language': "اللغة",
    'session.exerciseOf': "التمرين {n}/{total}",
    'session.skip': "التالي",
    'between.eyebrow': "أحسنت — التمرين التالي",
    'between.countdown': "استئناف تلقائي خلال {s} ث",
    'between.go': "أنا جاهز",
    'done.perExercise': "تفاصيل كل تمرين",
    'done.repsShort': "تكرار",
    'done.notDone': "لم يُنجز",

    'advanced.eyebrow': 'خيارات متقدمة',
    'advanced.title': 'اختر تمريناً',
    'advanced.lead': 'ضع الهاتف على طاولة، على بعد مترين تقريباً.',
    'advanced.exercise': 'التمرين',
    'advanced.reps': 'التكرارات',
    'advanced.start': 'ابدأ',
    'advanced.calibrate': 'معايرة هذا التمرين',
    'advanced.back': 'رجوع',

    'status.preparing': 'التحضير…',
    'status.stepBack': 'تراجع قليلاً، يجب أن أرى جسمك بالكامل',
    'status.holdStill': 'لا تتحرك…',
    'status.ready': 'جاهز',
    'status.calibrateReady': 'قم بـ 5 إلى 8 تكرارات بوتيرتك الخاصة',
    'status.lost': 'لم أعد أراك',
    'status.cameraError': 'خطأ في الكاميرا: {message}',

    'error.cameraDenied': 'تم رفض الوصول إلى الكاميرا. فعّل الكاميرا من إعدادات المتصفح.',
    'error.cameraNotFound': 'لم يتم العثور على كاميرا على هذا الجهاز.',
    'error.insecureContext': 'تتطلب الكاميرا HTTPS. افتح الصفحة عبر https أو على localhost.',

    'record.start': 'تسجيل',
    'record.stop': 'إيقاف',
    'record.notePrompt': 'ملاحظة حول هذا التسجيل؟',
    'debug.label': 'تفاصيل',

    'done.eyebrow': 'انتهت الجلسة',
    'done.title': 'جلسة رائعة.',
    'done.reps': 'تكرارات',
    'done.quality': 'الجودة',
    'done.duration': 'المدة',
    'done.romLabel': 'مدى الحركة المقدَّر',
    'done.romDisclaimer': 'قيمة تقريبية من الكاميرا — وليست قياساً طبياً.',
    'done.cuesTitle': 'الملاحظات المُعطاة',
    'done.again': 'جلسة جديدة',

    'replay.title': 'إعادة مشاهدة الجلسة',
    'replay.hint': 'إعادة تشغيل الهيكل العظمي المسجَّل — لا تُحفظ أي صورة لك.',
    'replay.play': 'تشغيل',
    'replay.pause': 'إيقاف مؤقت',

    'video.title': 'فيديو الجلسة',
    'video.hint': 'سُجِّل بموافقتك، لأخصائي العلاج الطبيعي.',
    'video.share': 'مشاركة مع أخصائي العلاج الطبيعي',
    'video.download': 'تنزيل',

    'cal.eyebrow': 'المعايرة',
    'cal.title': 'مُعايَر خصيصاً لك.',
    'cal.restAngle': 'زاوية الراحة',
    'cal.peakAngle': 'أقصى زاوية',
    'cal.movements': 'الحركات',
    'cal.impossible': 'تعذّرت المعايرة.',
    'cal.verdictOk': 'تم التحقق: بهذه القيم، يحسب المحرك {reps} تكراراً، وهو بالضبط ما يحتويه التسجيل.',
    'cal.verdictBad':
      'يلزم إعادة النظر: يحسب المحرك {reps} تكراراً بينما يحتوي التسجيل على {expected}. أعد التسجيل قبل استخدام هذه القيم.',
    'cal.warningsTitle': 'ملاحظات',
    'cal.definitionLabel': 'التعريف المُعايَر',
    'cal.copy': 'نسخ',
    'cal.copied': 'تم النسخ',
    'cal.copyDenied': 'رفض المتصفح النسخ. استخدم «تنزيل».',
    'cal.download': 'تنزيل',
    'cal.back': 'رجوع',

    'nav.back': '→ رجوع',
  },

  en: {
    'lang.prompt': 'Choose your language',
    'lang.fr': 'Français',
    'lang.ar': 'العربية',
    'lang.en': 'English',

    'profile.eyebrow': 'Before we start',
    'profile.title': "Welcome",
    'profile.lead': "Enter your first name to begin.",
    'profile.name': 'Your first name',
    'profile.namePlaceholder': 'e.g. Sarah',
    'profile.age': 'Age',
    'profile.area': 'Rehabilitation area',
    'profile.prescriber': 'Who prescribed this programme?',
    'profile.continue': 'Continue',
    'profile.back': 'Back',
    'area.knee': 'Knee',
    'area.hip': 'Hip',
    'area.ankle': 'Ankle',
    'area.back': 'Back',
    'area.shoulder': "Shoulder and arm",
    'area.other': 'Other',
    'prescriber.physio': 'Physiotherapist',
    'prescriber.doctor': 'Doctor',
    'prescriber.center': 'Rehabilitation centre',
    'prescriber.other': 'Other',

    'home.greeting': 'Hello {name}',
    'home.ready': 'Your session is ready',
    'home.sessionInfo': '{count} exercises · about {minutes} min',
    'home.start': 'Start session',
    'home.videoConsent': 'Record a video for my physiotherapist',
    'home.videoConsentHint': 'Optional. Without this, only the skeleton (no image of you) is kept.',
    'home.advanced': 'Advanced options',
    'home.editProfile': 'Edit profile',
    'home.setupHint': 'Stand the phone upright about 2 metres away. Your whole body should be visible on screen.',
    'banner.prototype': 'Prototype — exercises not yet clinically validated',
    'done.titleNone': 'Session stopped.',
    'session.finish': 'Finish',
    'app.name': "Home physio",
    'app.tag': "Prototype",
    'profile.optional': "(optional)",
    'areaHint.shoulder': "Seated exercises",
    'areaHint.knee': "Seated, standing, lying",
    'areaHint.hip': "Standing and lying",
    'areaHint.ankle': "Seated and standing",
    'areaHint.back': "Mostly seated",
    'areaHint.other': "Seated exercises",
    'position.seated': "Seated",
    'position.standing': "Standing",
    'position.lying': "Lying down",
    'status.showUpperBody': "Sit facing the phone with your upper body in view",
    'home.setupHintSeated': "Stand the phone on a table 1.5–2 metres away and sit facing it. Your arms and upper body should be visible.",
    'home.programTitle': "Today's programme",
    'home.repsEach': "{reps} repetitions",
    'home.language': "Language",
    'session.exerciseOf': "Exercise {n}/{total}",
    'session.skip': "Next",
    'between.eyebrow': "Well done — next exercise",
    'between.countdown': "Starting automatically in {s}s",
    'between.go': "I'm ready",
    'done.perExercise': "By exercise",
    'done.repsShort': "reps",
    'done.notDone': "not done",

    'advanced.eyebrow': 'Advanced options',
    'advanced.title': 'Choose an exercise',
    'advanced.lead': 'Place the phone on a table, about two metres away.',
    'advanced.exercise': 'Exercise',
    'advanced.reps': 'Repetitions',
    'advanced.start': 'Start',
    'advanced.calibrate': 'Calibrate this exercise',
    'advanced.back': 'Back',

    'status.preparing': 'Getting ready…',
    'status.stepBack': 'Step back — I need to see your whole body',
    'status.holdStill': 'Hold still…',
    'status.ready': 'Ready',
    'status.calibrateReady': 'Do 5 to 8 repetitions at your own pace',
    'status.lost': "I can't see you anymore",
    'status.cameraError': 'Camera error: {message}',

    'error.cameraDenied': 'Camera access denied. Allow the camera in your browser settings.',
    'error.cameraNotFound': 'No camera was found on this device.',
    'error.insecureContext': 'The camera requires HTTPS. Open this page over https or on localhost.',

    'record.start': 'Record',
    'record.stop': 'Stop',
    'record.notePrompt': 'Note for this recording?',
    'debug.label': 'Details',

    'done.eyebrow': 'Session complete',
    'done.title': 'Nice work.',
    'done.reps': 'repetitions',
    'done.quality': 'quality',
    'done.duration': 'duration',
    'done.romLabel': 'Estimated range',
    'done.romDisclaimer': 'An estimate from the camera — not a clinical measurement.',
    'done.cuesTitle': 'Reminders given',
    'done.again': 'New session',

    'replay.title': 'Watch the session again',
    'replay.hint': 'Replays the recorded skeleton — no image of you is ever stored.',
    'replay.play': 'Play',
    'replay.pause': 'Pause',

    'video.title': 'Session video',
    'video.hint': 'Recorded with your consent, for your physiotherapist.',
    'video.share': 'Share with my physiotherapist',
    'video.download': 'Download',

    'cal.eyebrow': 'Calibration',
    'cal.title': 'Tuned to you.',
    'cal.restAngle': 'resting angle',
    'cal.peakAngle': 'peak angle',
    'cal.movements': 'movements',
    'cal.impossible': 'Calibration could not be completed.',
    'cal.verdictOk':
      'Verified: with these values, the engine counts {reps} repetitions — exactly what the recording contains.',
    'cal.verdictBad':
      'Needs another try: the engine counts {reps} repetitions, but the recording contains {expected}. Record again before using these values.',
    'cal.warningsTitle': 'Notes',
    'cal.definitionLabel': 'Calibrated definition',
    'cal.copy': 'Copy',
    'cal.copied': 'Copied',
    'cal.copyDenied': 'The browser refused the copy. Use "Download" instead.',
    'cal.download': 'Download',
    'cal.back': 'Back',

    'nav.back': '← Back',
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
