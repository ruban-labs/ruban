import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import * as React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {Bar, Circle, CircleSnail, Pie} from '@ruban-labs/react-native-progress';
import {Pill, RubanScreen, primitiveStyles} from '../components/RubanPrimitives';
import {radius, spacing, useRubanColors} from '../design/tokens';
import type {TabParamList} from '../navigation/types';
import DesignPlaygroundScreen from './DesignPlaygroundScreen';

type Props = BottomTabScreenProps<TabParamList, 'Playground'>;

function parseProgress(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) {
    return fallback;
  }

  return value !== '0' && value !== 'false';
}

function StepButton({label, onPress}: {label: string; onPress: () => void}): React.ReactElement {
  const colors = useRubanColors();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      activeOpacity={0.74}
      style={[styles.stepButton, {backgroundColor: colors.surfaceRaised, borderColor: colors.border}]}>
      <Text style={[styles.stepButtonText, {color: colors.ink}]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ProgressLabScreen({route}: Props): React.ReactElement {
  const colors = useRubanColors();
  const [barProgress, setBarProgress] = React.useState(() =>
    parseProgress(route.params?.bar, 0.64)
  );
  const [circleProgress, setCircleProgress] = React.useState(() =>
    parseProgress(route.params?.circle, 0.42)
  );
  const [pieProgress, setPieProgress] = React.useState(() =>
    parseProgress(route.params?.pie, 0.76)
  );
  const [indeterminateAnimating, setIndeterminateAnimating] = React.useState(() =>
    parseBoolean(route.params?.indeterminate, true)
  );

  React.useEffect(() => {
    setBarProgress(parseProgress(route.params?.bar, 0.64));
    setCircleProgress(parseProgress(route.params?.circle, 0.42));
    setPieProgress(parseProgress(route.params?.pie, 0.76));
    setIndeterminateAnimating(parseBoolean(route.params?.indeterminate, true));
  }, [route.params]);

  const adjust = (setter: React.Dispatch<React.SetStateAction<number>>, amount: number) => {
    setter(current => Math.min(1, Math.max(0, current + amount)));
  };

  return (
    <RubanScreen testID="screen-lab">
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.eyebrow, {color: colors.accent}]}>COMPONENT / PROGRESS</Text>
          <Text style={[styles.title, {color: colors.ink}]}>Progress</Text>
        </View>
        <Pill tone="success">live</Pill>
      </View>

      <View style={[primitiveStyles.card, styles.labCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
        <View style={styles.labTitleRow}>
          <Text style={[primitiveStyles.cardTitle, {color: colors.ink}]}>Bar</Text>
          <Text testID="lab-bar-value" style={[styles.value, {color: colors.accent}]}>{Math.round(barProgress * 100)}%</Text>
        </View>
        <Bar progress={barProgress} width={280} height={7} borderWidth={0} color={colors.accent} unfilledColor={colors.accentSoft} />
        <View style={styles.controls}>
          <StepButton label="− 10" onPress={() => adjust(setBarProgress, -0.1)} />
          <StepButton label="+ 10" onPress={() => adjust(setBarProgress, 0.1)} />
        </View>
      </View>

      <View style={[primitiveStyles.card, styles.labCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
        <View style={styles.labTitleRow}>
          <Text style={[primitiveStyles.cardTitle, {color: colors.ink}]}>Circle</Text>
          <Text style={[styles.value, {color: colors.accent}]}>{Math.round(circleProgress * 100)}%</Text>
        </View>
        <View style={styles.visualRow}>
          <Circle progress={circleProgress} size={92} thickness={7} showsText color={colors.accent} unfilledColor={colors.accentSoft} borderWidth={0} />
          <Circle progress={circleProgress} size={92} thickness={7} segmentCount={16} color={colors.ink} unfilledColor={colors.border} borderWidth={0} />
        </View>
        <View style={styles.controls}>
          <StepButton label="− 10" onPress={() => adjust(setCircleProgress, -0.1)} />
          <StepButton label="+ 10" onPress={() => adjust(setCircleProgress, 0.1)} />
        </View>
      </View>

      <View style={[primitiveStyles.card, styles.labCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
        <View style={styles.labTitleRow}>
          <Text style={[primitiveStyles.cardTitle, {color: colors.ink}]}>Pie &amp; indeterminate</Text>
          <Text style={[styles.value, {color: colors.accent}]}>{Math.round(pieProgress * 100)}%</Text>
        </View>
        <View style={styles.visualRow}>
          <Pie progress={pieProgress} size={92} color={colors.accent} unfilledColor={colors.accentSoft} borderWidth={0} />
          <CircleSnail animating={indeterminateAnimating} size={82} thickness={7} color={[colors.accent, colors.ink, colors.success]} />
        </View>
        <View style={styles.controls}>
          <StepButton label="− 10" onPress={() => adjust(setPieProgress, -0.1)} />
          <StepButton label="+ 10" onPress={() => adjust(setPieProgress, 0.1)} />
          <StepButton
            label={indeterminateAnimating ? 'Pause' : 'Run'}
            onPress={() => setIndeterminateAnimating(current => !current)}
          />
        </View>
      </View>

      <View style={[styles.linkNote, {backgroundColor: colors.accentSoft}]}>
        <Text style={[styles.linkNoteLabel, {color: colors.accent}]}>REPRODUCE THIS STATE</Text>
        <Text selectable style={[styles.linkText, {color: colors.ink}]}>
          ruban-rn077://lab/progress?bar={barProgress.toFixed(2)}&amp;circle={circleProgress.toFixed(2)}&amp;pie={pieProgress.toFixed(2)}&amp;indeterminate={indeterminateAnimating ? '1' : '0'}
        </Text>
      </View>
    </RubanScreen>
  );
}

export default function LabScreen(props: Props): React.ReactElement {
  if (props.route.params?.tool !== 'progress') {
    const theme = props.route.params?.theme ?? 'light';

    return (
      <DesignPlaygroundScreen
        darkMode={theme === 'dark'}
        onDarkModeChange={enabled =>
          props.navigation.setParams({tool: 'design', theme: enabled ? 'dark' : 'light'})
        }
        onOpenProgress={() =>
          props.navigation.navigate('Playground', {
            tool: 'progress',
            bar: '0.64',
            circle: '0.42',
            pie: '0.76',
            indeterminate: '1',
          })
        }
      />
    );
  }

  return <ProgressLabScreen {...props} />;
}

const styles = StyleSheet.create({
  headerRow: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between'},
  eyebrow: {fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 1.5},
  title: {marginTop: 7, fontSize: 35, lineHeight: 40, fontWeight: '700', letterSpacing: -1.2},
  labCard: {marginTop: spacing.lg},
  labTitleRow: {marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  value: {fontSize: 13, lineHeight: 17, fontWeight: '900'},
  visualRow: {minHeight: 108, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around'},
  controls: {marginTop: spacing.lg, flexDirection: 'row'},
  stepButton: {minWidth: 62, minHeight: 38, marginRight: 8, borderWidth: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center'},
  stepButtonText: {fontSize: 12, fontWeight: '800'},
  linkNote: {marginTop: spacing.lg, borderRadius: radius.md, padding: spacing.md},
  linkNoteLabel: {fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.35},
  linkText: {marginTop: 8, fontSize: 11, lineHeight: 17, fontWeight: '600'},
});
