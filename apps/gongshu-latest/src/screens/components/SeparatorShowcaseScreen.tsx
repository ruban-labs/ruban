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
  Separator,
  separatorOrientations,
  separatorTones,
  separatorWeights,
  type SeparatorOrientation,
  type SeparatorTone,
  type SeparatorWeight,
} from '../../components/ui/Separator';
import {useRubanColors} from '../../design/tokens';
import type {RubanThemeMode} from '../../design/theme-colors';
import type {RootStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ComponentDetail'> & {onBack: () => void};

function parseOption<T extends string>(value: string | undefined, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function SeparatorSample({
  orientation,
  tone,
  weight,
  testID,
  accessibilityLabel,
}: {
  orientation: SeparatorOrientation;
  tone: SeparatorTone;
  weight: SeparatorWeight;
  testID?: string;
  accessibilityLabel?: string;
}): React.ReactElement {
  const colors = useRubanColors();

  if (orientation === 'vertical') {
    return (
      <View style={styles.verticalSample}>
        <Text style={[styles.sampleLabel, {color: colors.ink}]}>LEFT</Text>
        <Separator
          accessibilityLabel={accessibilityLabel}
          decorative={accessibilityLabel == null}
          testID={testID}
          orientation="vertical"
          tone={tone}
          weight={weight}
          style={styles.verticalLine}
        />
        <Text style={[styles.sampleLabel, {color: colors.ink}]}>RIGHT</Text>
      </View>
    );
  }

  return (
    <View style={styles.horizontalSample}>
      <Text style={[styles.sampleLabel, {color: colors.ink}]}>GROUP A</Text>
      <Separator
        accessibilityLabel={accessibilityLabel}
        decorative={accessibilityLabel == null}
        testID={testID}
        tone={tone}
        weight={weight}
      />
      <Text style={[styles.sampleLabel, {color: colors.ink}]}>GROUP B</Text>
    </View>
  );
}

export default function SeparatorShowcaseScreen({route, navigation, onBack}: Props): React.ReactElement {
  const theme = parseOption<RubanThemeMode>(route.params.theme, ['light', 'dark'], 'light');
  const orientation = parseOption<SeparatorOrientation>(route.params.orientation, separatorOrientations, 'horizontal');
  const tone = parseOption<SeparatorTone>(route.params.tone, separatorTones, 'strong');
  const weight = parseOption<SeparatorWeight>(route.params.weight, separatorWeights, 'regular');
  const deepLink = `ruban://components/separator?theme=${theme}&orientation=${orientation}&tone=${tone}&weight=${weight}`;

  return (
    <ComponentShowcaseScreen
      index="04"
      name="Separator"
      category="STRUCTURE"
      distribution="SOURCE"
      status="READY"
      theme={theme}
      onThemeChange={nextTheme => navigation.setParams({theme: nextTheme})}
      onBack={onBack}>
      <ShowcaseSection index="01" label="LIVE">
        <ShowcaseStage>
          <SeparatorSample
            accessibilityLabel={`Live separator ${orientation} ${tone} ${weight}`}
            testID="separator-live"
            orientation={orientation}
            tone={tone}
            weight={weight}
          />
        </ShowcaseStage>
        <ShowcaseControlGroup label="ORIENTATION">
          {separatorOrientations.map(option => (
            <ShowcaseChoice
              key={option}
              label={option.toUpperCase()}
              selected={orientation === option}
              onPress={() => navigation.setParams({orientation: option})}
            />
          ))}
        </ShowcaseControlGroup>
        <ShowcaseControlGroup label="TONE">
          {separatorTones.map(option => (
            <ShowcaseChoice
              key={option}
              label={option.toUpperCase()}
              selected={tone === option}
              onPress={() => navigation.setParams({tone: option})}
            />
          ))}
        </ShowcaseControlGroup>
        <ShowcaseControlGroup label="WEIGHT">
          {separatorWeights.map(option => (
            <ShowcaseChoice
              key={option}
              label={option.toUpperCase()}
              selected={weight === option}
              onPress={() => navigation.setParams({weight: option})}
            />
          ))}
        </ShowcaseControlGroup>
      </ShowcaseSection>

      <ShowcaseSection index="02" label="TONES">
        <View style={styles.stack}>
          {separatorTones.map(option => (
            <ShowcaseSpecimen key={option} label={option.toUpperCase()} style={styles.stackItem}>
              <Separator tone={option} weight="bold" />
            </ShowcaseSpecimen>
          ))}
        </View>
      </ShowcaseSection>

      <ShowcaseSection index="03" label="ORIENTATION">
        <View style={styles.grid}>
          {separatorOrientations.map(option => (
            <ShowcaseSpecimen key={option} label={option.toUpperCase()} style={styles.gridCell}>
              <SeparatorSample orientation={option} tone="accent" weight="regular" />
            </ShowcaseSpecimen>
          ))}
        </View>
      </ShowcaseSection>

      <ShowcaseSection index="04" label="WEIGHTS">
        <View style={styles.stack}>
          {separatorWeights.map(option => (
            <ShowcaseSpecimen key={option} label={option.toUpperCase()} style={styles.stackItem}>
              <Separator tone="strong" weight={option} />
            </ShowcaseSpecimen>
          ))}
        </View>
      </ShowcaseSection>

      <ShowcaseSection index="05" label="CONTRACT">
        <ShowcaseDataTable>
          <ShowcaseDataRow label="Delivery" value="SOURCE" />
          <ShowcaseDataRow label="Runtime deps" value="ZERO" />
          <ShowcaseDataRow label="Bare React Native" value="YES" />
          <ShowcaseDataRow label="Orientations" value="H + V" />
          <ShowcaseDataRow label="Decorative default" value="YES" />
        </ShowcaseDataTable>
        <ShowcaseDeepLink>{deepLink}</ShowcaseDeepLink>
      </ShowcaseSection>
    </ComponentShowcaseScreen>
  );
}

const styles = StyleSheet.create({
  sampleLabel: {fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.9},
  horizontalSample: {alignSelf: 'stretch'},
  verticalSample: {height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
  verticalLine: {marginHorizontal: 28},
  stack: {},
  stackItem: {marginBottom: 10},
  grid: {flexDirection: 'row', justifyContent: 'space-between'},
  gridCell: {width: '48%'},
});
