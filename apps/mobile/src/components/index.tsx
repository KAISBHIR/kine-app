import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOUCH_TARGET, colors, radius, spacing, type } from '../theme';

export function Screen({
  children,
  scroll = false,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inner = <View style={[s.screenInner, style]}>{children}</View>;
  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      {scroll ? <ScrollView contentContainerStyle={s.scroll}>{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={s.title}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={s.heading}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[s.body, muted && s.muted]}>{children}</Text>;
}

export function Caption({ children }: { children: ReactNode }) {
  return <Text style={s.caption}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        variant === 'primary' && s.buttonPrimary,
        variant === 'secondary' && s.buttonSecondary,
        variant === 'danger' && s.buttonDanger,
        pressed && s.buttonPressed,
        disabled && s.buttonDisabled,
      ]}
    >
      <Text
        style={[
          s.buttonLabel,
          variant === 'primary' && { color: colors.onAccent },
          variant === 'danger' && { color: colors.onDanger },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** The rep counter. Sized to be read from across a room. */
export function RepCounter({ done, target }: { done: number; target: number }) {
  return (
    <View
      style={s.counter}
      accessibilityRole="text"
      accessibilityLabel={`${done} répétitions sur ${target}`}
    >
      <Text style={s.counterDone}>{done}</Text>
      <Text style={s.counterTarget}> / {target}</Text>
    </View>
  );
}

/**
 * Status is carried by the WORD, not the colour. A patient with reduced colour
 * vision must get the same information as everyone else.
 */
export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'ok' | 'warn';
}) {
  return (
    <View style={s.pill}>
      <Text
        style={[
          s.pillLabel,
          tone === 'ok' && { color: colors.accent },
          tone === 'warn' && { color: colors.warn },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function CueBanner({ text }: { text: string }) {
  return (
    <View style={s.cue} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Text style={s.cueText}>{text}</Text>
    </View>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenInner: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  scroll: { flexGrow: 1 },

  title: { ...type.title, color: colors.text },
  heading: { ...type.heading, color: colors.text },
  body: { ...type.body, color: colors.text },
  caption: { ...type.caption, color: colors.textMuted },
  muted: { color: colors.textMuted },

  button: {
    minHeight: TOUCH_TARGET,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  buttonDanger: { backgroundColor: colors.danger },
  buttonPressed: { opacity: 0.75 },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { ...type.heading, color: colors.text },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },

  counter: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  counterDone: { ...type.display, color: colors.text },
  counterTarget: { ...type.title, color: colors.textMuted },

  pill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pillLabel: { ...type.label, color: colors.text },

  cue: {
    backgroundColor: 'rgba(15,23,42,0.94)',
    borderLeftWidth: 6,
    borderLeftColor: colors.warn,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cueText: { ...type.cue, color: colors.text, textAlign: 'center' },

  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: { ...type.title, color: colors.text },
  statLabel: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
});
