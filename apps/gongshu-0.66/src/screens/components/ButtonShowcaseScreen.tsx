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
import {
  Button,
  buttonSizes,
  buttonVariants,
  type ButtonSize,
  type ButtonVariant,
} from '../../components/ui/Button';
import {spacing, useRubanColors} from '../../design/tokens';
import type {RubanThemeMode} from '../../design/theme-colors';
import type {RootStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ComponentDetail'> & {
  onBack: () => void;
};
const buttonStates = [
  'default',
  'pressed',
  'loading',
  'disabled',
  'full',
] as const;
type ButtonState = (typeof buttonStates)[number];

function parseOption<T extends string>(
  value: string | undefined,
  options: readonly T[],
  fallback: T,
): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function LiveReadout({pressCount}: {pressCount: number}): React.ReactElement {
  const colors = useRubanColors();
  return (
    <View style={[styles.readout, {borderTopColor: colors.border}]}>
      <Text style={[styles.readoutLabel, {color: colors.faint}]}>PRESSES</Text>
      <Text style={[styles.readoutValue, {color: colors.accent}]}>
        {String(pressCount).padStart(2, '0')}
      </Text>
    </View>
  );
}

function StateButton({state}: {state: ButtonState}): React.ReactElement {
  return (
    <Button
      size="sm"
      loading={state === 'loading'}
      disabled={state === 'disabled'}
      fullWidth={state === 'full'}
      testOnly_pressed={state === 'pressed'}>
      {state === 'full' ? 'FULL WIDTH' : 'ACTION'}
    </Button>
  );
}

export default function ButtonShowcaseScreen({
  route,
  navigation,
  onBack,
}: Props): React.ReactElement {
  const theme = parseOption<RubanThemeMode>(
    route.params.theme,
    ['light', 'dark'],
    'light',
  );
  const variant = parseOption<ButtonVariant>(
    route.params.variant,
    buttonVariants,
    'primary',
  );
  const size = parseOption<ButtonSize>(route.params.size, buttonSizes, 'md');
  const state = parseOption<ButtonState>(
    route.params.state,
    buttonStates,
    'default',
  );
  const [pressCount, setPressCount] = React.useState(0);
  const deepLink = `ruban-rn066://components/button?theme=${theme}&variant=${variant}&size=${size}&state=${state}`;

  return (
    <ComponentShowcaseScreen
      index="01"
      name="Button"
      category="ACTION"
      distribution="SOURCE"
      status="PREVIEW"
      theme={theme}
      onThemeChange={nextTheme => navigation.setParams({theme: nextTheme})}
      onBack={onBack}>
      <ShowcaseSection index="01" label="LIVE">
        <ShowcaseStage>
          <View style={styles.liveContent}>
            <Button
              variant={variant}
              size={size}
              loading={state === 'loading'}
              disabled={state === 'disabled'}
              fullWidth={state === 'full'}
              testOnly_pressed={state === 'pressed'}
              onPress={() => setPressCount(current => current + 1)}>
              RUN ACTION
            </Button>
            <LiveReadout pressCount={pressCount} />
          </View>
        </ShowcaseStage>

        <ShowcaseControlGroup label="VARIANT">
          {buttonVariants.map(option => (
            <ShowcaseChoice
              key={option}
              label={option.toUpperCase()}
              selected={variant === option}
              onPress={() => navigation.setParams({variant: option})}
            />
          ))}
        </ShowcaseControlGroup>
        <ShowcaseControlGroup label="SIZE">
          {buttonSizes.map(option => (
            <ShowcaseChoice
              key={option}
              label={option.toUpperCase()}
              selected={size === option}
              onPress={() => navigation.setParams({size: option})}
            />
          ))}
        </ShowcaseControlGroup>
        <ShowcaseControlGroup label="STATE">
          {buttonStates.map(option => (
            <ShowcaseChoice
              key={option}
              label={option.toUpperCase()}
              selected={state === option}
              onPress={() => navigation.setParams({state: option})}
            />
          ))}
        </ShowcaseControlGroup>
      </ShowcaseSection>

      <ShowcaseSection index="02" label="VARIANTS">
        <View style={styles.stack}>
          {buttonVariants.map(option => (
            <ShowcaseSpecimen
              key={option}
              label={option.toUpperCase()}
              style={styles.stackItem}>
              <Button variant={option}>ACTION</Button>
            </ShowcaseSpecimen>
          ))}
        </View>
      </ShowcaseSection>

      <ShowcaseSection index="03" label="STATES">
        <View style={styles.grid}>
          {buttonStates.map(option => (
            <ShowcaseSpecimen
              key={option}
              label={option.toUpperCase()}
              style={styles.gridCell}>
              <StateButton state={option} />
            </ShowcaseSpecimen>
          ))}
        </View>
      </ShowcaseSection>

      <ShowcaseSection index="04" label="SIZES">
        <View style={styles.stack}>
          {buttonSizes.map(option => (
            <ShowcaseSpecimen key={option} label={option.toUpperCase()}>
              <Button size={option}>ACTION</Button>
            </ShowcaseSpecimen>
          ))}
        </View>
      </ShowcaseSection>

      <ShowcaseSection index="05" label="CONTRACT">
        <ShowcaseDataTable>
          <ShowcaseDataRow label="Delivery" value="SOURCE" />
          <ShowcaseDataRow label="Runtime deps" value="ZERO" />
          <ShowcaseDataRow label="Bare React Native" value="YES" />
          <ShowcaseDataRow label="Architectures" value="OLD + NEW" />
          <ShowcaseDataRow label="Primary role" value="BUTTON" />
        </ShowcaseDataTable>
        <ShowcaseDeepLink>{deepLink}</ShowcaseDeepLink>
      </ShowcaseSection>
    </ComponentShowcaseScreen>
  );
}

const styles = StyleSheet.create({
  liveContent: {alignSelf: 'stretch'},
  readout: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readoutLabel: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  readoutValue: {fontSize: 15, lineHeight: 19, fontWeight: '900'},
  stack: {},
  stackItem: {marginBottom: 10},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCell: {width: '48%', marginBottom: 10},
});
