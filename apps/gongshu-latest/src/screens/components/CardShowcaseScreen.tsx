import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import * as React from 'react';
import {StyleSheet, View} from 'react-native';
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
  Card,
  CardAction,
  CardActionText,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardMeta,
  CardTitle,
  cardTones,
  type CardTone,
} from '../../components/ui/Card';
import type {RubanThemeMode} from '../../design/theme-colors';
import type {RootStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ComponentDetail'> & {onBack: () => void};

function parseOption<T extends string>(
  value: string | undefined,
  options: readonly T[],
  fallback: T
): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function DemoCard({tone, compact = false}: {tone: CardTone; compact?: boolean}): React.ReactElement {
  return (
    <Card tone={tone} style={styles.card}>
      <CardHeader style={compact ? styles.compactHeader : undefined}>
        <CardTitle style={compact ? styles.compactTitle : undefined}>
          {compact ? tone.toUpperCase() : 'Build matrix'}
        </CardTitle>
        <CardDescription>{compact ? 'SURFACE' : 'RN 0.66 — LATEST'}</CardDescription>
        <CardAction>
          <CardActionText>{tone === 'live' ? 'LIVE' : '03'}</CardActionText>
        </CardAction>
      </CardHeader>
      {compact ? null : (
        <CardContent>
          <CardTitle style={styles.metric}>OLD + NEW</CardTitle>
        </CardContent>
      )}
      <CardFooter>
        <CardMeta>{compact ? 'TOKEN' : 'ANDROID + IOS'}</CardMeta>
        <CardMeta>{compact ? '15—100' : 'BARE RN'}</CardMeta>
      </CardFooter>
    </Card>
  );
}

export default function CardShowcaseScreen({route, navigation, onBack}: Props): React.ReactElement {
  const theme = parseOption<RubanThemeMode>(route.params.theme, ['light', 'dark'], 'light');
  const tone = parseOption<CardTone>(route.params.tone, cardTones, 'default');
  const deepLink = `ruban://components/card?theme=${theme}&tone=${tone}`;

  return (
    <ComponentShowcaseScreen
      index="02"
      name="Card"
      category="SURFACE"
      distribution="SOURCE"
      status="READY"
      theme={theme}
      onThemeChange={nextTheme => navigation.setParams({theme: nextTheme})}
      onBack={onBack}>
      <ShowcaseSection index="01" label="LIVE">
        <ShowcaseStage>
          <DemoCard tone={tone} />
        </ShowcaseStage>
        <ShowcaseControlGroup label="TONE">
          {cardTones.map(option => (
            <ShowcaseChoice
              key={option}
              label={option.toUpperCase()}
              selected={tone === option}
              onPress={() => navigation.setParams({tone: option})}
            />
          ))}
        </ShowcaseControlGroup>
      </ShowcaseSection>

      <ShowcaseSection index="02" label="TONES">
        <View style={styles.grid}>
          {cardTones.map(option => (
            <ShowcaseSpecimen key={option} label={option.toUpperCase()} style={styles.gridCell}>
              <DemoCard tone={option} compact />
            </ShowcaseSpecimen>
          ))}
        </View>
      </ShowcaseSection>

      <ShowcaseSection index="03" label="ANATOMY">
        <ShowcaseSpecimen label="HEADER / CONTENT / FOOTER">
          <DemoCard tone="default" />
        </ShowcaseSpecimen>
      </ShowcaseSection>

      <ShowcaseSection index="04" label="COMPOSITION">
        <View style={styles.stack}>
            <ShowcaseSpecimen label="STATUS" style={styles.stackItem}>
            <DemoCard tone="live" compact />
          </ShowcaseSpecimen>
            <ShowcaseSpecimen label="ALERT" style={styles.stackItem}>
            <DemoCard tone="alert" compact />
          </ShowcaseSpecimen>
            <ShowcaseSpecimen label="CONTRAST" style={styles.stackItem}>
            <DemoCard tone="contrast" compact />
          </ShowcaseSpecimen>
        </View>
      </ShowcaseSection>

      <ShowcaseSection index="05" label="CONTRACT">
        <ShowcaseDataTable>
          <ShowcaseDataRow label="Delivery" value="SOURCE" />
          <ShowcaseDataRow label="Runtime deps" value="ZERO" />
          <ShowcaseDataRow label="Bare React Native" value="YES" />
          <ShowcaseDataRow label="Interactivity" value="COMPOSE" />
          <ShowcaseDataRow label="Theme roles" value="SEMANTIC" />
        </ShowcaseDataTable>
        <ShowcaseDeepLink>{deepLink}</ShowcaseDeepLink>
      </ShowcaseSection>
    </ComponentShowcaseScreen>
  );
}

const styles = StyleSheet.create({
  card: {width: '100%'},
  compactHeader: {paddingRight: 48},
  compactTitle: {fontSize: 12, lineHeight: 16, letterSpacing: 0},
  metric: {fontSize: 28, lineHeight: 33, letterSpacing: -1.1},
  grid: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between'},
  gridCell: {width: '48%', marginBottom: 10},
  stack: {},
  stackItem: {marginBottom: 10},
});
