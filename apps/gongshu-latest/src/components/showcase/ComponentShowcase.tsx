import * as React from 'react';
import {Pressable, StyleSheet, Text, View, type ViewProps} from 'react-native';
import {RubanScreen} from '../RubanPrimitives';
import {RubanThemeProvider, spacing, useRubanColors} from '../../design/tokens';
import type {RubanThemeMode} from '../../design/theme-colors';

type ComponentShowcaseScreenProps = {
  index: string;
  name: string;
  category: string;
  distribution: 'SOURCE' | 'PACKAGE';
  status: 'PREVIEW' | 'READY';
  theme: RubanThemeMode;
  onThemeChange: (theme: RubanThemeMode) => void;
  onBack: () => void;
  children: React.ReactNode;
};

export function ComponentShowcaseScreen(props: ComponentShowcaseScreenProps): React.ReactElement {
  return (
    <RubanThemeProvider mode={props.theme}>
      <ComponentShowcaseContent {...props} />
    </RubanThemeProvider>
  );
}

function ComponentShowcaseContent({
  index,
  name,
  category,
  distribution,
  status,
  theme,
  onThemeChange,
  onBack,
  children,
}: ComponentShowcaseScreenProps): React.ReactElement {
  const colors = useRubanColors();

  return (
    <RubanScreen testID={`screen-component-${name.toLowerCase()}`}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={8}>
          <Text style={[styles.backLabel, {color: colors.ink}]}>← COMPONENTS</Text>
        </Pressable>
        <View style={[styles.themeControl, {borderColor: colors.borderStrong}]}>
          {(['light', 'dark'] as const).map(mode => {
            const selected = theme === mode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{selected}}
                onPress={() => onThemeChange(mode)}
                style={[
                  styles.themeChoice,
                  selected ? {backgroundColor: colors.ink} : undefined,
                ]}>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.themeLabel, {color: selected ? colors.inverse : colors.faint}]}>
                  {mode.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text style={[styles.title, {color: colors.ink}]}>{name}</Text>
        <View style={[styles.indexBlock, {backgroundColor: colors.accent}]}>
          <Text style={[styles.index, {color: colors.inverse}]}>{index}</Text>
        </View>
      </View>

      <View style={[styles.metaStrip, {borderColor: colors.border}]}>
        <MetaCell label="CATEGORY" value={category} />
        <MetaCell label="DELIVERY" value={distribution} bordered />
        <MetaCell label="STATUS" value={status} bordered />
      </View>

      {children}
    </RubanScreen>
  );
}

function MetaCell({label, value, bordered = false}: {label: string; value: string; bordered?: boolean}) {
  const colors = useRubanColors();
  return (
    <View
      style={[
        styles.metaCell,
        bordered ? styles.metaCellBorder : undefined,
        bordered ? {borderLeftColor: colors.border} : undefined,
      ]}>
      <Text style={[styles.metaLabel, {color: colors.faint}]}>{label}</Text>
      <Text style={[styles.metaValue, {color: colors.ink}]}>{value}</Text>
    </View>
  );
}

export function ShowcaseSection({
  index,
  label,
  children,
}: {
  index: string;
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  const colors = useRubanColors();
  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeader, {borderBottomColor: colors.ink}]}>
        <Text style={[styles.sectionIndex, {color: colors.accent}]}>{index}</Text>
        <Text style={[styles.sectionLabel, {color: colors.ink}]}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

export function ShowcaseStage({style, ...viewProps}: ViewProps): React.ReactElement {
  const colors = useRubanColors();
  return (
    <View
      {...viewProps}
      style={[
        styles.stage,
        {backgroundColor: colors.surface, borderColor: colors.border},
        style,
      ]}
    />
  );
}

export function ShowcaseControlGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  const colors = useRubanColors();
  return (
    <View style={styles.controlGroup}>
      <Text style={[styles.controlLabel, {color: colors.faint}]}>{label}</Text>
      <View style={styles.choiceRow}>{children}</View>
    </View>
  );
}

export function ShowcaseChoice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  const colors = useRubanColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{selected}}
      onPress={onPress}
      style={({pressed}) => [
        styles.choice,
        {
          backgroundColor: selected ? colors.ink : colors.surface,
          borderColor: selected ? colors.ink : colors.borderStrong,
        },
        pressed ? styles.pressed : undefined,
      ]}>
      <Text style={[styles.choiceLabel, {color: selected ? colors.inverse : colors.muted}]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ShowcaseSpecimen({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: ViewProps['style'];
}): React.ReactElement {
  const colors = useRubanColors();
  return (
    <View style={[styles.specimen, {backgroundColor: colors.surface, borderColor: colors.border}, style]}>
      <Text style={[styles.specimenLabel, {color: colors.faint}]}>{label}</Text>
      <View style={styles.specimenContent}>{children}</View>
    </View>
  );
}

export function ShowcaseDataRow({label, value}: {label: string; value: string}): React.ReactElement {
  const colors = useRubanColors();
  return (
    <View style={[styles.dataRow, {borderBottomColor: colors.border}]}>
      <Text style={[styles.dataLabel, {color: colors.ink}]}>{label}</Text>
      <Text style={[styles.dataValue, {color: colors.faint}]}>{value}</Text>
    </View>
  );
}

export function ShowcaseDataTable({children}: {children: React.ReactNode}): React.ReactElement {
  const colors = useRubanColors();
  return <View style={[styles.dataTable, {backgroundColor: colors.surface, borderColor: colors.border}]}>{children}</View>;
}

export function ShowcaseDeepLink({children}: {children: string}): React.ReactElement {
  const colors = useRubanColors();
  return (
    <View style={[styles.deepLink, {backgroundColor: colors.surfaceRaised, borderColor: colors.border}]}>
      <Text style={[styles.deepLinkLabel, {color: colors.accent}]}>DEEP LINK</Text>
      <Text selectable style={[styles.deepLinkValue, {color: colors.ink}]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  backLabel: {fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.2},
  themeControl: {borderWidth: 1, flexDirection: 'row', flexShrink: 0},
  themeChoice: {width: 64, minHeight: 30, alignItems: 'center', justifyContent: 'center'},
  themeLabel: {
    width: '100%',
    textAlign: 'center',
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  titleRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: {flexShrink: 1, fontSize: 48, lineHeight: 52, fontWeight: '800', letterSpacing: -2.4},
  indexBlock: {width: 54, height: 54, alignItems: 'center', justifyContent: 'center'},
  index: {fontSize: 17, lineHeight: 21, fontWeight: '900'},
  metaStrip: {marginTop: spacing.lg, borderWidth: 1, flexDirection: 'row'},
  metaCell: {flex: 1, minHeight: 66, padding: 11, justifyContent: 'space-between'},
  metaCellBorder: {borderLeftWidth: 1},
  metaLabel: {fontSize: 7, lineHeight: 10, fontWeight: '900', letterSpacing: 0.8},
  metaValue: {fontSize: 11, lineHeight: 15, fontWeight: '900'},
  section: {marginTop: spacing.xl},
  sectionHeader: {
    paddingBottom: 8,
    borderBottomWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionIndex: {fontSize: 10, lineHeight: 14, fontWeight: '800'},
  sectionLabel: {fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 1.4},
  stage: {
    minHeight: 210,
    padding: spacing.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlGroup: {marginTop: spacing.md},
  controlLabel: {marginBottom: 8, fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 1.1},
  choiceRow: {flexDirection: 'row', flexWrap: 'wrap'},
  choice: {minHeight: 34, marginRight: 7, marginBottom: 7, paddingHorizontal: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center'},
  choiceLabel: {paddingHorizontal: 2, fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.65},
  pressed: {opacity: 0.62},
  specimen: {minHeight: 118, padding: 12, borderWidth: 1},
  specimenLabel: {fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.9},
  specimenContent: {flex: 1, marginTop: 14, justifyContent: 'center'},
  dataRow: {
    minHeight: 52,
    paddingHorizontal: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dataTable: {borderWidth: 1},
  dataLabel: {fontSize: 12, lineHeight: 16, fontWeight: '800'},
  dataValue: {fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.75},
  deepLink: {marginTop: spacing.md, padding: spacing.md, borderWidth: 1},
  deepLinkLabel: {fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 1},
  deepLinkValue: {marginTop: 7, fontSize: 10, lineHeight: 15, fontWeight: '700'},
});
