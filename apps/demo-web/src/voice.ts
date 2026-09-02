import type { Locale } from '@kine/shared';

export type VoicePriority = 'count' | 'cue';

export interface Voice {
  say(text: string, priority?: VoicePriority): void;
  stop(): void;
  readonly available: boolean;
}

const LOCALE_TAG: Record<Locale, string> = {
  fr: 'fr-FR',
  ar: 'ar-SA',
  en: 'en-GB',
};

/**
 * Web Speech synthesis. DELIBERATELY TEMPORARY.
 *
 * Ship pre-recorded audio clips instead: the cue set is about thirty fixed
 * strings, a recorded human voice is warmer for an elderly patient, playback is
 * instant, and it removes the per-device lottery over whether an Arabic voice
 * is installed at all — on many Android handsets it is not.
 *
 * Keep this class behind the `Voice` interface so swapping in clips is a
 * one-line change at the call site.
 */
export class WebSpeechVoice implements Voice {
  private lastSpokenAt = 0;
  private voice: SpeechSynthesisVoice | null = null;

  constructor(private readonly locale: Locale = 'fr') {
    if (this.available) {
      const pick = () => {
        const tag = LOCALE_TAG[this.locale];
        const voices = speechSynthesis.getVoices();
        this.voice =
          voices.find((v) => v.lang === tag) ??
          voices.find((v) => v.lang.startsWith(this.locale)) ??
          null;
      };
      pick();
      speechSynthesis.addEventListener('voiceschanged', pick);
    }
  }

  get available(): boolean {
    return typeof speechSynthesis !== 'undefined';
  }

  say(text: string, priority: VoicePriority = 'count'): void {
    if (!this.available) return;

    const now = performance.now();
    // A correction interrupts counting; counting never interrupts anything.
    if (priority === 'cue') {
      speechSynthesis.cancel();
    } else if (speechSynthesis.speaking || now - this.lastSpokenAt < 250) {
      return;
    }

    const u = new SpeechSynthesisUtterance(text);
    u.lang = LOCALE_TAG[this.locale];
    if (this.voice) u.voice = this.voice;
    u.rate = 0.95;
    u.pitch = 1;
    speechSynthesis.speak(u);
    this.lastSpokenAt = now;
  }

  stop(): void {
    if (this.available) speechSynthesis.cancel();
  }
}
