import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import * as React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  ComponentShowcaseScreen,
  ShowcaseChoice,
  ShowcaseControlGroup,
  ShowcaseDataRow,
  ShowcaseDataTable,
  ShowcaseDeepLink,
  ShowcaseSection,
  ShowcaseSpecimen,
  ShowcaseStage,
} from '../../components/showcase/ComponentShowcase';
import {Switch, switchSizes, type SwitchSize} from '../../components/ui/Switch';
import {spacing, useRubanColors} from '../../design/tokens';
import type {RubanThemeMode} from '../../design/theme-colors';
import type {RootStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ComponentDetail'> & {onBack: () => void};
const switchStates = ['off', 'on', 'disabled'] as const;
type SwitchState = (typeof switchStates)[number];

function parseOption<T extends string>(value: string | undefined, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function StateSwitch({state, size = 'md'}: {state: SwitchState; size?: SwitchSize}): React.ReactElement {
  return <Switch checked={state !== 'off'} disabled={state === 'disabled'} size={size} />;
}

export default function SwitchShowcaseScreen({route, navigation, onBack}: Props): React.ReactElement {
  const theme = parseOption<RubanThemeMode>(route.params.theme, ['light', 'dark'], 'light');
  const state = parseOption<SwitchState>(route.params.state, switchStates, 'on');
  const size = parseOption<SwitchSize>(route.params.size, switchSizes, 'md');
  const checked = state !== 'off';
  const disabled = state === 'disabled';
  const deepLink = `ruban-rn066://components/switch?theme=${theme}&state=${state}&size=${size}`;

  return (
    <ComponentShowcaseScreen
      index="05"
      name="Switch"
      category="CONTROL"
      distribution="SOURCE"
      status="PREVIEW"
      theme={theme}
      onThemeChange={nextTheme => navigation.setParams({theme: nextTheme})}
      onBack={onBack}>
      <ShowcaseSection index="01" label="LIVE">
        <ShowcaseStage>
          <View style={styles.liveRow}>
            <Switch
              testID="switch-live"
              accessibilityLabel="Live switch"
              checked={checked}
              disabled={disabled}
              size={size}
              onCheckedChange={nextChecked => navigation.setParams({state: nextChecked ? 'on' : 'off'})}
            />
            <SwitchReadout state={state} />
          </View>
        </ShowcaseStage>
        <ShowcaseControlGroup label="STATE">
          {switchStates.map(option => (
            <ShowcaseChoice
              key={option}
              label={option.toUpperCase()}
              selected={state === option}
              onPress={() => navigation.setParams({state: option})}
            />
          ))}
        </ShowcaseControlGroup>
        <ShowcaseControlGroup label="SIZE">
          {switchSizes.map(option => (
            <ShowcaseChoice
              key={option}
              label={option.toUpperCase()}
              selected={size === option}
              onPress={() => navigation.setParams({size: option})}
            />
          ))}
        </ShowcaseControlGroup>
      </ShowcaseSection>

      <ShowcaseSection index="02" label="STATES">
        <View style={styles.grid}>
          {switchStates.map(option => (
            <ShowcaseSpecimen key={option} label={option.toUpperCase()} style={styles.gridCell}>
              <StateSwitch state={option} size="sm" />
            </ShowcaseSpecimen>
          ))}
        </View>
      </ShowcaseSection>

      <ShowcaseSection index="03" label="SIZES">
        <View style={styles.stack}>
          {switchSizes.map(option => (
            <ShowcaseSpecimen key={option} label={option.toUpperCase()} style={styles.stackItem}>
              <StateSwitch state="on" size={option} />
            </ShowcaseSpecimen>
          ))}
        </View>
      </ShowcaseSection>

      <ShowcaseSection index="04" label="CONTRACT">
        <ShowcaseDataTable>
          <ShowcaseDataRow label="Delivery" value="SOURCE" />
          <ShowcaseDataRow label="Runtime deps" value="ZERO" />
          <ShowcaseDataRow label="Bare React Native" value="YES" />
          <ShowcaseDataRow label="State model" value="CONTROLLED" />
          <ShowcaseDataRow label="Accessibility role" value="SWITCH" />
        </ShowcaseDataTable>
        <ShowcaseDeepLink>{deepLink}</ShowcaseDeepLink>
      </ShowcaseSection>
    </ComponentShowcaseScreen>
  );
}

function SwitchReadout({state}: {state: SwitchState}): React.ReactElement {
  const colors = useRubanColors();
  return (
    <View style={[styles.readout, {borderLeftColor: colors.border}]}>
      <Text style={[styles.readoutLabel, {color: colors.faint}]}>STATE</Text>
      <Text
        accessibilityLabel={`Live switch state ${state.toUpperCase()}`}
        testID="switch-live-state"
        style={[styles.readoutValue, {color: colors.accent}]}>
        {state.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  liveRow: {alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center'},
  readout: {marginLeft: spacing.lg, paddingLeft: spacing.md, borderLeftWidth: 1},
  readoutLabel: {fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 1},
  readoutValue: {marginTop: 5, fontSize: 15, lineHeight: 19, fontWeight: '900'},
  grid: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between'},
  gridCell: {width: '48%', marginBottom: 10},
  stack: {},
  stackItem: {marginBottom: 10},
});
