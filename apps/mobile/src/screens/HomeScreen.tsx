import { StyleSheet, View } from 'react-native';
import { exerciseName, type Locale } from '@kine/shared';
import type { ExerciseDefinition } from '@kine/movement-engine';
import { Body, Button, Caption, Card, Heading, Screen, Title } from '../components';
import { colors, spacing, type } from '../theme';
import { Text } from 'react-native';

export interface HomeScreenProps {
  patientName: string;
  locale: Locale;
  program: ExerciseDefinition[];
  targetReps: number;
  onStart: () => void;
}

/**
 * One screen, one decision: start the session.
 *
 * Everything else is deliberately absent. The patient is an older adult who
 * wants to do their exercises, not navigate an app. Additions here need to earn
 * their place against that.
 */
export function HomeScreen({
  patientName,
  locale,
  program,
  targetReps,
  onStart,
}: HomeScreenProps) {
  const estimatedMinutes = Math.max(1, Math.round((program.length * targetReps * 5) / 60));

  return (
    <Screen scroll>
      <View style={s.header}>
        <Title>Bonjour {patientName}</Title>
        <Body muted>Votre séance de rééducation est prête.</Body>
      </View>

      <Card>
        <Heading>Aujourd’hui</Heading>
        <View style={s.metaRow}>
          <Text style={s.meta}>{program.length} exercices</Text>
          <Text style={s.metaDot}>•</Text>
          <Text style={s.meta}>environ {estimatedMinutes} min</Text>
        </View>

        <View style={s.list}>
          {program.map((def, i) => (
            <View key={def.id} style={s.listItem}>
              <Text style={s.listIndex}>{i + 1}</Text>
              <View style={s.listBody}>
                <Text style={s.listName}>{exerciseName(def.nameKey, locale)}</Text>
                <Caption>{targetReps} répétitions</Caption>
              </View>
            </View>
          ))}
        </View>
      </Card>

      <View style={s.spacer} />

      <Button label="Commencer la séance" onPress={onStart} />

      <Caption>
        Arrêtez l’exercice en cas de douleur forte, de vertige, de douleur dans la poitrine
        ou de difficulté à respirer.
      </Caption>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { ...type.body, color: colors.textMuted },
  metaDot: { ...type.body, color: colors.border },
  list: { marginTop: spacing.md, gap: spacing.md },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  listIndex: {
    ...type.label,
    color: colors.onAccent,
    backgroundColor: colors.accent,
    width: 36,
    height: 36,
    borderRadius: 18,
    textAlign: 'center',
    lineHeight: 36,
    overflow: 'hidden',
  },
  listBody: { flex: 1 },
  listName: { ...type.body, color: colors.text, fontWeight: '600' },
  spacer: { flex: 1, minHeight: spacing.lg },
});
