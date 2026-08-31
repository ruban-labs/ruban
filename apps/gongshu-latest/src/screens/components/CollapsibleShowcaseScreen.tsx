import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import * as React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Accordion, Collapsible} from '@ruban-labs/react-native-collapsible';
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
import {spacing, useRubanColors} from '../../design/tokens';
import type {RubanThemeMode} from '../../design/theme-colors';
import type {RootStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ComponentDetail'> & {onBack: () => void};
const disclosureStates = ['open', 'closed'] as const;
const disclosureModes = ['panel', 'accordion'] as const;
const alignments = ['top', 'center', 'bottom'] as const;
type DisclosureState = (typeof disclosureStates)[number];
type DisclosureMode = (typeof disclosureModes)[number];

const accordionSections = [
  {id: 'dimensions', title: 'DIMENSIONS', value: '320 × AUTO'},
  {id: 'runtime', title: 'RUNTIME', value: 'ZERO DEPS'},
] as const;

function parseOption<T extends string>(value: string | undefined, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

export default function CollapsibleShowcaseScreen({route, navigation, onBack}: Props): React.ReactElement {
  const colors = useRubanColors();
  const theme = parseOption<RubanThemeMode>(route.params.theme, ['light', 'dark'], 'light');
  const state = parseOption<DisclosureState>(route.params.state, disclosureStates, 'open');
  const mode = parseOption<DisclosureMode>(route.params.variant, disclosureModes, 'panel');
  const open = state === 'open';
  const deepLink = `ruban://components/collapsible?theme=${theme}&state=${state}&variant=${mode}`;

  const setOpen = (nextOpen: boolean) => {
    navigation.setParams({state: nextOpen ? 'open' : 'closed'});
  };

  return (
    <ComponentShowcaseScreen
      index="07"
      name="Collapsible"
      category="STRUCTURE"
      distribution="PACKAGE"
      status="READY"
      theme={theme}
      onThemeChange={nextTheme => navigation.setParams({theme: nextTheme})}
      onBack={onBack}>
      <ShowcaseSection index="01" label="LIVE">
        <ShowcaseStage style={styles.liveStage}>
          {mode === 'panel' ? (
            <View style={styles.liveWidth}>
              <Pressable
                testID="collapsible-live-trigger"
                accessibilityRole="button"
                accessibilityState={{expanded: open}}
                onPress={() => setOpen(!open)}
                style={({pressed}) => [
                  styles.disclosureHeader,
                  {backgroundColor: colors.ink},
                  pressed ? styles.pressed : undefined,
                ]}>
                <Text style={[styles.disclosureLabel, {color: colors.inverse}]}>WORKPIECE</Text>
                <Text style={[styles.disclosureMark, {color: colors.accent}]}>{open ? '−' : '+'}</Text>
              </Pressable>
              <Collapsible
                testID="collapsible-live"
                collapsed={!open}
                duration={240}
                easing="easeOutCubic"
                renderChildrenCollapsed={false}>
                <View style={[styles.disclosureBody, {backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong}]}>
                  <DataLine label="HEIGHT" value="AUTO" />
                  <DataLine label="ALIGN" value="TOP" />
                  <DataLine label="DRIVER" value="JS" />
                </View>
              </Collapsible>
            </View>
          ) : (
            <Accordion
              testID="collapsible-live-accordion"
              sections={accordionSections}
              activeSections={open ? [0] : []}
              onChange={activeSections => setOpen(activeSections.length > 0)}
              keyExtractor={section => section.id}
              duration={240}
              sectionContainerStyle={[styles.accordionSection, {borderColor: colors.borderStrong}]}
              headerContainerStyle={styles.accordionTouchable}
              renderHeader={(section, _index, active) => (
                <View style={styles.accordionHeader}>
                  <Text style={[styles.accordionTitle, {color: colors.ink}]}>{section.title}</Text>
                  <Text style={[styles.accordionMark, {color: colors.accent}]}>{active ? '−' : '+'}</Text>
                </View>
              )}
              renderContent={section => (
                <View style={[styles.accordionContent, {backgroundColor: colors.surfaceRaised}]}>
                  <Text style={[styles.accordionValue, {color: colors.ink}]}>{section.value}</Text>
                </View>
              )}
            />
          )}
        </ShowcaseStage>
        <ShowcaseControlGroup label="STATE">
          {disclosureStates.map(option => (
            <ShowcaseChoice
              key={option}
              label={option.toUpperCase()}
              selected={state === option}
              onPress={() => navigation.setParams({state: option})}
            />
          ))}
        </ShowcaseControlGroup>
        <ShowcaseControlGroup label="MODE">
          {disclosureModes.map(option => (
            <ShowcaseChoice
              key={option}
              label={option.toUpperCase()}
              selected={mode === option}
              onPress={() => navigation.setParams({variant: option})}
            />
          ))}
        </ShowcaseControlGroup>
      </ShowcaseSection>

      <ShowcaseSection index="02" label="ALIGNMENT">
        <View style={styles.alignmentGrid}>
          {alignments.map(alignment => (
            <ShowcaseSpecimen key={alignment} label={alignment.toUpperCase()} style={styles.alignmentCell}>
              <View style={[styles.alignmentFrame, {borderColor: colors.border}]}>
                <Collapsible collapsed collapsedHeight={36} duration={0} align={alignment}>
                  <View style={[styles.alignmentBody, {backgroundColor: colors.accentSoft}]}>
                    <View style={[styles.alignmentLine, {backgroundColor: colors.accent}]} />
                    <View style={[styles.alignmentLineShort, {backgroundColor: colors.ink}]} />
                  </View>
                </Collapsible>
              </View>
            </ShowcaseSpecimen>
          ))}
        </View>
      </ShowcaseSection>

      <ShowcaseSection index="03" label="CONTRACT">
        <ShowcaseDataTable>
          <ShowcaseDataRow label="Delivery" value="PACKAGE" />
          <ShowcaseDataRow label="Runtime deps" value="ZERO" />
          <ShowcaseDataRow label="Bare React Native" value="YES" />
          <ShowcaseDataRow label="RN floor" value="0.66" />
          <ShowcaseDataRow label="Architecture" value="OLD + NEW" />
          <ShowcaseDataRow label="Height model" value="DYNAMIC" />
        </ShowcaseDataTable>
        <ShowcaseDeepLink>{deepLink}</ShowcaseDeepLink>
      </ShowcaseSection>
    </ComponentShowcaseScreen>
  );
}

function DataLine({label, value}: {label: string; value: string}): React.ReactElement {
  const colors = useRubanColors();
  return (
    <View style={[styles.dataLine, {borderBottomColor: colors.border}]}>
      <Text style={[styles.dataLineLabel, {color: colors.faint}]}>{label}</Text>
      <Text style={[styles.dataLineValue, {color: colors.ink}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  liveStage: {minHeight: 260},
  liveWidth: {alignSelf: 'stretch'},
  disclosureHeader: {minHeight: 52, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  disclosureLabel: {fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.2},
  disclosureMark: {fontSize: 22, lineHeight: 24, fontWeight: '700'},
  disclosureBody: {paddingHorizontal: spacing.md, borderWidth: 1, borderTopWidth: 0},
  dataLine: {minHeight: 46, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  dataLineLabel: {fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.9},
  dataLineValue: {fontSize: 11, lineHeight: 15, fontWeight: '900'},
  pressed: {opacity: 0.66},
  accordionSection: {alignSelf: 'stretch', borderTopWidth: 1},
  accordionTouchable: {paddingHorizontal: 14},
  accordionHeader: {minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  accordionTitle: {fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.1},
  accordionMark: {fontSize: 20, lineHeight: 22, fontWeight: '700'},
  accordionContent: {minHeight: 76, padding: 15, justifyContent: 'center'},
  accordionValue: {fontSize: 18, lineHeight: 23, fontWeight: '800', letterSpacing: -0.4},
  alignmentGrid: {flexDirection: 'row', justifyContent: 'space-between'},
  alignmentCell: {width: '31%'},
  alignmentFrame: {height: 66, borderWidth: 1, justifyContent: 'center'},
  alignmentBody: {height: 78, padding: 8, justifyContent: 'center'},
  alignmentLine: {width: '100%', height: 4},
  alignmentLineShort: {width: '58%', height: 3, marginTop: 7},
});

