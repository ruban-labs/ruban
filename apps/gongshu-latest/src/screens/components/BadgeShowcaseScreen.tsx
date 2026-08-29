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
  Badge,
  badgeSizes,
  badgeVariants,
  type BadgeSize,
  type BadgeVariant,
} from '../../components/ui/Badge';
import type {RubanThemeMode} from '../../design/theme-colors';
import type {RootStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ComponentDetail'> & {onBack: () => void};

function parseOption<T extends string>(value: string | undefined, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function badgeLabel(variant: BadgeVariant): string {
  if (variant === 'destructive') return 'ALERT';
  if (variant === 'live') return 'LIVE';
  if (variant === 'secondary') return 'MUTED';
  if (variant === 'outline') return 'OUTLINE';
  return 'READY';
}

export default function BadgeShowcaseScreen({route, navigation, onBack}: Props): React.ReactElement {
  const theme = parseOption<RubanThemeMode>(route.params.theme, ['light', 'dark'], 'light');
  const variant = parseOption<BadgeVariant>(route.params.variant, badgeVariants, 'live');
  const size = parseOption<BadgeSize>(route.params.size, badgeSizes, 'md');
  const deepLink = `ruban://components/badge?theme=${theme}&variant=${variant}&size=${size}`;

  return (
    <ComponentShowcaseScreen
      index="03"
      name="Badge"
      category="STATUS"
      distribution="SOURCE"
      status="PREVIEW"
      theme={theme}
      onThemeChange={nextTheme => navigation.setParams({theme: nextTheme})}
      onBack={onBack}>
      <ShowcaseSection index="01" label="LIVE">
        <ShowcaseStage>
          <Badge testID="badge-live" variant={variant} size={size}>
            {badgeLabel(variant)}
          </Badge>
        </ShowcaseStage>
        <ShowcaseControlGroup label="VARIANT">
          {badgeVariants.map(option => (
            <ShowcaseChoice
              key={option}
              label={option.toUpperCase()}
              selected={variant === option}
              onPress={() => navigation.setParams({variant: option})}
            />
          ))}
        </ShowcaseControlGroup>
        <ShowcaseControlGroup label="SIZE">
          {badgeSizes.map(option => (
            <ShowcaseChoice
              key={option}
              label={option.toUpperCase()}
              selected={size === option}
              onPress={() => navigation.setParams({size: option})}
            />
          ))}
        </ShowcaseControlGroup>
      </ShowcaseSection>

      <ShowcaseSection index="02" label="VARIANTS">
        <View style={styles.grid}>
          {badgeVariants.map(option => (
            <ShowcaseSpecimen key={option} label={option.toUpperCase()} style={styles.gridCell}>
              <Badge variant={option} size="sm">{badgeLabel(option)}</Badge>
            </ShowcaseSpecimen>
          ))}
        </View>
      </ShowcaseSection>

      <ShowcaseSection index="03" label="SIZES">
        <View style={styles.stack}>
          {badgeSizes.map(option => (
            <ShowcaseSpecimen key={option} label={option.toUpperCase()} style={styles.stackItem}>
              <Badge variant="live" size={option}>LIVE</Badge>
            </ShowcaseSpecimen>
          ))}
        </View>
      </ShowcaseSection>

      <ShowcaseSection index="04" label="COMPOSITION">
        <ShowcaseSpecimen label="LABEL / COUNT / STATE">
          <View style={styles.composition}>
            <Badge variant="default">RELEASE</Badge>
            <Badge variant="secondary">08</Badge>
            <Badge variant="outline">BETA</Badge>
          </View>
        </ShowcaseSpecimen>
      </ShowcaseSection>

      <ShowcaseSection index="05" label="CONTRACT">
        <ShowcaseDataTable>
          <ShowcaseDataRow label="Delivery" value="SOURCE" />
          <ShowcaseDataRow label="Runtime deps" value="ZERO" />
          <ShowcaseDataRow label="Bare React Native" value="YES" />
          <ShowcaseDataRow label="Content" value="TEXT" />
          <ShowcaseDataRow label="Theme roles" value="SEMANTIC" />
        </ShowcaseDataTable>
        <ShowcaseDeepLink>{deepLink}</ShowcaseDeepLink>
      </ShowcaseSection>
    </ComponentShowcaseScreen>
  );
}

const styles = StyleSheet.create({
  grid: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between'},
  gridCell: {width: '48%', marginBottom: 10},
  stack: {},
  stackItem: {marginBottom: 10},
  composition: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center'},
});
