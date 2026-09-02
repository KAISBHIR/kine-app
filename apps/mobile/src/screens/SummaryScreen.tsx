import { StyleSheet, View } from 'react-native';
import { exerciseName, getCue, type Locale, type SessionSummary } from '@kine/shared';
import { getExercise } from '@kine/exercise-library';
import { Body, Button, Caption, Card, Heading, Screen, Stat, Title } from '../components';
import { spacing } from '../theme';

export interface SummaryScreenProps {
  summary: SessionSummary;
  locale: Locale;
  onDone: () => void;
}

/**
 * What the patient sees at the end.
 *
 * Note what is NOT here: variance, confidence intervals, raw joint angles.
 * The clinician's dashboard gets those. The patient gets encouragement and one
 * honest number, labelled as an estimate.
 */
export function SummaryScreen({ summary, locale, onDone }: SummaryScreenProps) {
  const def = getExercise(summary.exerciseId);
  const cueEntries = Object.entries(summary.cues);

  return (
    <Screen scroll>
      <Title>Séance terminée</Title>
      <Body muted>{exerciseName(def.nameKey, locale)}</Body>

      <View style={s.stats}>
        <Stat value={String(summary.reps)} label="répétitions" />
        <Stat
          value={summary.quality === null ? '—' : `${summary.quality}%`}
          label="qualité du mouvement"
        />
        <Stat value={formatDuration(summary.durationMs)} label="durée" />
      </View>

      <Card>
        <Heading>Amplitude estimée</Heading>
        <Body>
          {summary.bestPeakDeg === null ? '—' : `${Math.round(summary.bestPeakDeg)}°`}
        </Body>
        {/*
          This wording is not decoration. An angle inferred from one 2D camera
          moves with camera position, clothing and lighting. Presenting it as a
          measurement is how you lose a physiotherapist's trust permanently.
        */}
        <Caption>
          Valeur indicative issue de la caméra. Ce n’est pas une mesure clinique.
        </Caption>
      </Card>

      {summary.partialReps > 0 && (
        <Card>
          <Heading>Mouvements incomplets</Heading>
          <Body muted>
            {summary.partialReps} mouvement{summary.partialReps > 1 ? 's' : ''} n’a pas
            atteint l’amplitude visée.
          </Body>
        </Card>
      )}

      {cueEntries.length > 0 && (
        <Card>
          <Heading>Rappels donnés</Heading>
          {cueEntries.map(([ruleId, count]) => (
            <Body key={ruleId} muted>
              {cueTextForRule(summary.exerciseId, ruleId, locale)} × {count}
            </Body>
          ))}
        </Card>
      )}

      <View style={s.spacer} />
      <Button label="Terminer" onPress={onDone} />
    </Screen>
  );
}

function cueTextForRule(exerciseId: string, ruleId: string, locale: Locale): string {
  const rule = getExercise(exerciseId).formRules.find((r) => r.id === ruleId);
  if (!rule) return ruleId;
  return getCue(rule.cueKey)[locale];
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const s = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm },
  spacer: { flex: 1, minHeight: spacing.lg },
});
