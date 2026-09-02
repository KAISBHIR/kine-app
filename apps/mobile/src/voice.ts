import * as Speech from 'expo-speech';
import type { Locale } from '@kine/shared';

export type VoicePriority = 'count' | 'cue';

export interface Voice {
  say(text: string, priority?: VoicePriority): void;
  stop(): void;
}

const LOCALE_TAG: Record<Locale, string> = {
  fr: 'fr-FR',
  ar: 'ar',
  en: 'en-GB',
};

/**
 * Speech synthesis. DELIBERATELY TEMPORARY.
 *
 * Ship pre-recorded audio clips instead. The cue set is about thirty fixed
 * strings; a recorded human voice is warmer for an elderly patient, playback is
 * instant, and it removes the per-device lottery over whether an Arabic voice
 * is installed at all — on many Android handsets it is not, and expo-speech
 * will silently say nothing.
 *
 * Keep this behind the `Voice` interface so swapping in clips is a one-line
 * change at the call site.
 */
export class SpeechVoice implements Voice {
  private lastSpokenAt = 0;
  private speaking = false;

  constructor(private readonly locale: Locale = 'fr') {}

  say(text: string, priority: VoicePriority = 'count'): void {
    const now = Date.now();

    // A correction interrupts counting; counting never interrupts anything.
    if (priority === 'cue') {
      Speech.stop();
    } else if (this.speaking || now - this.lastSpokenAt < 250) {
      return;
    }

    this.speaking = true;
    this.lastSpokenAt = now;

    Speech.speak(text, {
      language: LOCALE_TAG[this.locale],
      rate: 0.95,
      pitch: 1,
      onDone: () => {
        this.speaking = false;
      },
      onStopped: () => {
        this.speaking = false;
      },
      onError: () => {
        this.speaking = false;
      },
    });
  }

  stop(): void {
    Speech.stop();
    this.speaking = false;
  }
}
