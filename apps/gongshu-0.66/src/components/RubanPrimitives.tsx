import * as React from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {radius, spacing, useRubanColors} from '../design/tokens';

type ScreenProps = {
  children: React.ReactNode;
  testID?: string;
  contentStyle?: ViewStyle;
  scrollProps?: ScrollViewProps;
};

export function RubanScreen({
  children,
  testID,
  contentStyle,
  scrollProps,
}: ScreenProps): React.ReactElement {
  const colors = useRubanColors();

  useFocusEffect(
    React.useCallback(() => {
      StatusBar.setBarStyle(
        colors.mode === 'dark' ? 'light-content' : 'dark-content',
        true,
      );
    }, [colors.mode]),
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, {backgroundColor: colors.canvas}]}>
      <ScrollView
        {...scrollProps}
        testID={testID}
        style={[styles.scroll, {backgroundColor: colors.canvas}]}
        contentContainerStyle={[styles.content, contentStyle]}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Ruler(): React.ReactElement {
  const colors = useRubanColors();
  const ticks = Array.from({length: 17}, (_, index) => index);

  return (
    <View
      accessibilityElementsHidden
      style={[styles.ruler, {borderColor: colors.border}]}>
      {ticks.map(index => (
        <View
          key={`tick-${index}`}
          style={[
            styles.tick,
            {backgroundColor: index % 4 === 0 ? colors.accent : colors.border},
            index % 4 === 0
              ? styles.tickLong
              : index % 2 === 0
              ? styles.tickMedium
              : styles.tickShort,
          ]}
        />
      ))}
    </View>
  );
}

type PillProps = {
  children: React.ReactNode;
  tone?: 'accent' | 'success' | 'neutral';
};

export function Pill({
  children,
  tone = 'neutral',
}: PillProps): React.ReactElement {
  const colors = useRubanColors();
  const backgroundColor =
    tone === 'accent'
      ? colors.accentSoft
      : tone === 'success'
      ? colors.successSoft
      : colors.surface;
  const textColor =
    tone === 'accent'
      ? colors.accent
      : tone === 'success'
      ? colors.success
      : colors.muted;

  return (
    <View style={[styles.pill, {backgroundColor, borderColor: colors.border}]}>
      <Text style={[styles.pillText, {color: textColor}]}>{children}</Text>
    </View>
  );
}

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  action?: string;
  onAction?: () => void;
};

export function SectionHeading({
  eyebrow,
  title,
  action,
  onAction,
}: SectionHeadingProps): React.ReactElement {
  const colors = useRubanColors();

  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingCopy}>
        {eyebrow ? (
          <Text style={[styles.eyebrow, {color: colors.accent}]}>
            {eyebrow}
          </Text>
        ) : null}
        <Text style={[styles.sectionTitle, {color: colors.ink}]}>{title}</Text>
      </View>
      {action && onAction ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onAction}
          activeOpacity={0.7}>
          <Text style={[styles.actionText, {color: colors.accent}]}>
            {action}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  testID?: string;
};

export function PrimaryButton({
  label,
  onPress,
  testID,
}: PrimaryButtonProps): React.ReactElement {
  const colors = useRubanColors();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      activeOpacity={0.82}
      style={[styles.primaryButton, {backgroundColor: colors.ink}]}>
      <Text style={[styles.primaryButtonText, {color: colors.inverse}]}>
        {label}
      </Text>
      <Text style={[styles.primaryButtonArrow, {color: colors.accent}]}>→</Text>
    </TouchableOpacity>
  );
}

export const primitiveStyles = StyleSheet.create({
  display: {
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.7,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  cardBody: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 21,
  },
});

const styles = StyleSheet.create({
  safeArea: {flex: 1},
  scroll: {flex: 1},
  content: {
    paddingHorizontal: 22,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  ruler: {
    height: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  tick: {width: StyleSheet.hairlineWidth},
  tickLong: {height: 10},
  tickMedium: {height: 7},
  tickShort: {height: 4},
  pill: {
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionHeading: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sectionHeadingCopy: {flex: 1, paddingRight: spacing.md},
  eyebrow: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    marginTop: 4,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  actionText: {fontSize: 13, lineHeight: 18, fontWeight: '700'},
  primaryButton: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryButtonText: {fontSize: 14, fontWeight: '800', letterSpacing: 0.2},
  primaryButtonArrow: {fontSize: 21, fontWeight: '500'},
});
