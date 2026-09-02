import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import {
  countWord,
  landmarkIndex,
  say,
  type EngineEvent,
  type Frame,
  type Landmark,
  type Locale,
  type SessionSummary,
} from '@kine/shared';
import { ExerciseSession, type ExerciseDefinition } from '@kine/movement-engine';
import type { PoseSource } from '@kine/pose-source';
import { Button, CueBanner, RepCounter, StatusPill } from '../components';
import { Skeleton } from '../components/Skeleton';
import { createPoseSource, type PoseSourceKind } from '../poseSource';
import { SpeechVoice } from '../voice';
import { colors, spacing } from '../theme';

/** Continuous time the whole body must be visible before the session starts. */
const SETUP_STABLE_MS = 1200;
/** Minimum gap between two "extend a little further" prompts. */
const PARTIAL_CUE_COOLDOWN_MS = 7000;
/** Redraw the overlay at ~20fps. The engine still sees every frame. */
const RENDER_INTERVAL_MS = 50;

interface Status {
  label: string;
  tone: 'neutral' | 'ok' | 'warn';
}

export interface SessionScreenProps {
  def: ExerciseDefinition;
  targetReps: number;
  locale: Locale;
  sourceKind: PoseSourceKind;
  onFinish: (summary: SessionSummary) => void;
}

export function SessionScreen({
  def,
  targetReps,
  locale,
  sourceKind,
  onFinish,
}: SessionScreenProps) {
  useKeepAwake();

  const [reps, setReps] = useState(0);
  const [status, setStatus] = useState<Status>({ label: 'Préparation…', tone: 'neutral' });
  const [cue, setCue] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const voice = useMemo(() => new SpeechVoice(locale), [locale]);
  const session = useMemo(() => new ExerciseSession(def), [def]);

  // Refs for anything the frame callback touches: it fires 30 times a second
  // and must not depend on a re-rendered closure.
  const stageRef = useRef<'setup' | 'active' | 'done'>('setup');
  const setupGoodSince = useRef<number | null>(null);
  const lastPartialCueAt = useRef(-Infinity);
  const lastRenderAt = useRef(0);
  const trackingOk = useRef(true);
  const cueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceRef = useRef<PoseSource | null>(null);
  const finishedRef = useRef(false);

  const showCue = useCallback(
    (cueKey: string) => {
      const text = say(cueKey, locale);
      setCue(text);
      voice.say(text, 'cue');
      if (cueTimer.current) clearTimeout(cueTimer.current);
      cueTimer.current = setTimeout(() => setCue(null), 4000);
    },
    [locale, voice],
  );

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    stageRef.current = 'done';
    sourceRef.current?.stop();
    voice.stop();
    onFinish(session.summary());
  }, [onFinish, session, voice]);

  const handleEvent = useCallback(
    (ev: EngineEvent) => {
      switch (ev.kind) {
        case 'rep':
          setReps(ev.index);
          if (ev.index <= 15) voice.say(countWord(ev.index, locale), 'count');
          if (ev.index >= targetReps) finish();
          break;

        case 'partialRep': {
          const now = Date.now();
          if (now - lastPartialCueAt.current < PARTIAL_CUE_COOLDOWN_MS) break;
          lastPartialCueAt.current = now;
          showCue('cue.extend_further');
          break;
        }

        case 'formCue':
          showCue(ev.cueKey);
          break;

        case 'visibility':
          trackingOk.current = ev.ok;
          if (ev.ok) {
            setStatus({ label: 'Prêt', tone: 'ok' });
            voice.say(say('cue.tracking_restored', locale), 'cue');
          } else {
            const legLost = ev.missing.some((p) => p === 'knee' || p === 'ankle');
            setStatus({ label: 'Je ne vous vois plus', tone: 'warn' });
            voice.say(
              say(legLost ? 'cue.cannot_see_leg' : 'cue.cannot_see_body', locale),
              'cue',
            );
          }
          break;

        case 'phase':
          break;
      }
    },
    [finish, locale, showCue, targetReps, voice],
  );

  const onFrame = useCallback(
    (frame: Frame) => {
      // Throttle only the drawing. The engine sees every frame, because
      // dropping frames changes what it counts.
      const now = Date.now();
      if (now - lastRenderAt.current >= RENDER_INTERVAL_MS) {
        lastRenderAt.current = now;
        setLandmarks(frame.landmarks);
      }

      if (stageRef.current === 'setup') {
        const visible = bodyVisible(frame, def);
        if (!visible) {
          setupGoodSince.current = null;
          setStatus({ label: 'Reculez, je dois voir tout votre corps', tone: 'warn' });
          return;
        }
        setupGoodSince.current ??= frame.t;
        if (frame.t - setupGoodSince.current < SETUP_STABLE_MS) {
          setStatus({ label: 'Ne bougez pas…', tone: 'neutral' });
          return;
        }
        stageRef.current = 'active';
        setStatus({ label: 'Prêt', tone: 'ok' });
        voice.say(say('cue.setup_ready', locale), 'cue');
        return;
      }

      if (stageRef.current !== 'active') return;
      for (const ev of session.push(frame)) handleEvent(ev);
    },
    [def, handleEvent, locale, session, voice],
  );

  useEffect(() => {
    const source = createPoseSource({ kind: sourceKind, reps: targetReps + 2, onEnd: finish });
    sourceRef.current = source;

    const off = source.onFrame(onFrame);
    const offErr = source.onError(() =>
      setStatus({ label: 'Erreur caméra', tone: 'warn' }),
    );

    void source.start().catch(() => {
      setStatus({ label: 'Impossible de démarrer la caméra', tone: 'warn' });
    });

    voice.say(say('cue.setup_distance', locale), 'cue');

    return () => {
      off();
      offErr();
      source.stop();
      voice.stop();
      if (cueTimer.current) clearTimeout(cueTimer.current);
    };
    // Intentionally mounted once per session: re-creating the source mid-session
    // would reset the rep count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const highlight = useMemo(
    () => def.requiredParts.map((p) => landmarkIndex(p, session.side)),
    [def, session.side],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View style={s.root}>
      <View style={s.stage} onLayout={onLayout}>
        {size.width > 0 && landmarks.length > 0 && (
          <Skeleton
            landmarks={landmarks}
            width={size.width}
            height={size.height}
            highlight={highlight}
            degraded={!trackingOk.current}
          />
        )}
      </View>

      <View style={s.hud} pointerEvents="none">
        <RepCounter done={reps} target={targetReps} />
        <StatusPill label={status.label} tone={status.tone} />
      </View>

      {cue !== null && (
        <View style={s.cueSlot} pointerEvents="none">
          <CueBanner text={cue} />
        </View>
      )}

      <View style={s.controls}>
        <Button label="Terminer" variant="danger" onPress={finish} />
      </View>
    </View>
  );
}

/** All required parts visible on at least one side. */
function bodyVisible(frame: Frame, def: ExerciseDefinition): boolean {
  const ok = (side: 'left' | 'right') =>
    def.requiredParts.every(
      (p) => (frame.landmarks[landmarkIndex(p, side)]?.visibility ?? 0) > 0.6,
    );
  return ok('left') || ok('right');
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  stage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  hud: {
    position: 'absolute',
    top: spacing.xxl,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: spacing.sm,
  },
  cueSlot: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 120,
  },
  controls: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
  },
});
