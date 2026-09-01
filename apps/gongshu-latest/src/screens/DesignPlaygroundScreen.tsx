import * as React from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {architectureLabel, buildInfo} from '../buildInfo';
import {
  rubanColorRoles,
  rubanOpacitySteps,
  rubanSemanticColors,
  rubanThemeColors,
  type RubanGradientColorKey,
  type RubanSemanticColors,
  type RubanThemeColorVariants,
} from '../design/theme-colors';

type Props = {
  darkMode: boolean;
  onDarkModeChange: (enabled: boolean) => void;
  onOpenProgress: () => void;
};

const serifFont = Platform.select({ios: 'New York', android: 'serif', default: 'serif'});
const monoFont = Platform.select({ios: 'SF Mono', android: 'monospace', default: 'monospace'});
const condensedFont = Platform.select({
  ios: 'Arial Narrow',
  android: 'sans-serif-condensed',
  default: undefined,
});

type PlaygroundStyles = ReturnType<typeof createStyles>;

function SpecimenLabel({
  children,
  inverse = false,
  styles,
}: {
  children: string;
  inverse?: boolean;
  styles: PlaygroundStyles;
}) {
  return (
    <Text style={[styles.specimenLabel, inverse ? styles.specimenLabelInverse : undefined]}>
      {children}
    </Text>
  );
}

export default function DesignPlaygroundScreen({
  darkMode,
  onDarkModeChange,
  onOpenProgress,
}: Props): React.ReactElement {
  const systemColorScheme = useColorScheme();
  const mode = darkMode ? 'dark' : 'light';
  const theme: RubanThemeColorVariants = rubanThemeColors[mode];
  const semanticTheme: RubanSemanticColors = rubanSemanticColors[mode];
  const styles = React.useMemo(() => createStyles(theme, semanticTheme), [semanticTheme, theme]);

  useFocusEffect(
    React.useCallback(() => {
      StatusBar.setBarStyle(darkMode ? 'light-content' : 'dark-content', true);

      return () => {
        StatusBar.setBarStyle(systemColorScheme === 'dark' ? 'light-content' : 'dark-content', true);
      };
    }, [darkMode, systemColorScheme])
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        testID="screen-design-playground"
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerName}>PLAYGROUND</Text>
          <View style={styles.themeControl}>
            <Text style={styles.themeMode}>{darkMode ? 'DARK' : 'LIGHT'}</Text>
            <Switch
              testID="playground-theme-switch"
              accessibilityLabel="Dark playground theme"
              value={darkMode}
              onValueChange={onDarkModeChange}
              trackColor={{false: theme['neutral-line'], true: theme['cobalt-100']}}
              thumbColor={darkMode ? theme['acid-100'] : theme['neutral-surface']}
              ios_backgroundColor={theme['neutral-line']}
            />
          </View>
        </View>

        <View style={styles.typeHero}>
          <Text style={styles.heroLetters}>Aa</Text>
          <View style={styles.heroMeta}>
            <Text style={styles.heroWord}>Ruban</Text>
            <Text style={styles.heroNumbers}>0123456789</Text>
          </View>
        </View>

        <View style={styles.sectionRule}>
          <Text style={styles.sectionNumber}>01</Text>
          <Text style={styles.sectionName}>TYPE</Text>
        </View>

        <View style={styles.typeList}>
          <View style={styles.typeRow}>
            <SpecimenLabel styles={styles}>SYSTEM / 700</SpecimenLabel>
            <Text style={styles.systemSpecimen}>Measure twice.</Text>
          </View>
          <View style={styles.typeRow}>
            <SpecimenLabel styles={styles}>SERIF / 500</SpecimenLabel>
            <Text style={styles.serifSpecimen}>尺度与构造</Text>
          </View>
          <View style={styles.typeRowLast}>
            <SpecimenLabel styles={styles}>MONO / 600</SpecimenLabel>
            <Text style={styles.monoSpecimen}>RN_{buildInfo.reactNative} / 0064</Text>
          </View>
        </View>

        <View style={styles.sectionRule}>
          <Text style={styles.sectionNumber}>02</Text>
          <Text style={styles.sectionName}>LAYOUT</Text>
        </View>

        <View style={styles.splitSpecimen}>
          <View style={styles.splitPrimary}>
            <SpecimenLabel inverse styles={styles}>ASYMMETRIC / 2:1</SpecimenLabel>
            <Text style={styles.splitValue}>64</Text>
          </View>
          <View style={styles.splitSecondary}>
            <Text style={styles.splitUnit}>%</Text>
            <View>
              <Text style={styles.splitMeta}>RN {buildInfo.reactNative}</Text>
              <Text style={styles.splitMeta}>{architectureLabel}</Text>
              <Text style={styles.splitMeta}>ANDROID</Text>
            </View>
          </View>
        </View>

        <View style={styles.editorialSpecimen}>
          <View style={styles.signalBar} />
          <View style={styles.editorialMain}>
            <SpecimenLabel styles={styles}>EDITORIAL / OFFSET</SpecimenLabel>
            <Text style={styles.editorialTitle}>Form</Text>
            <Text style={styles.editorialCounter}>03—08</Text>
          </View>
          <View style={styles.editorialSide}>
            <Text style={styles.verticalWord}>RUBAN</Text>
          </View>
        </View>

        <View style={styles.denseSpecimen}>
          <View style={styles.denseHeader}>
            <SpecimenLabel inverse styles={styles}>DENSE / INDEX</SpecimenLabel>
            <View style={styles.liveDot} />
          </View>
          {[
            ['01', 'BUTTON', 'READY'],
            ['02', 'PROGRESS', 'READY'],
            ['03', 'COLLAPSIBLE', 'READY'],
          ].map(row => (
            <View key={row[0]} style={styles.denseRow}>
              <Text style={styles.denseIndex}>{row[0]}</Text>
              <Text style={styles.denseName}>{row[1]}</Text>
              <Text style={[styles.denseState, row[2] === 'READY' ? styles.denseStateReady : undefined]}>
                {row[2]}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionRule}>
          <Text style={styles.sectionNumber}>03</Text>
          <Text style={styles.sectionName}>COLOR</Text>
        </View>

        <View style={styles.paletteGroups}>
          {rubanColorRoles.map(role => (
            <View key={role} style={styles.paletteGroup}>
              <Text style={styles.paletteName}>{role.toUpperCase()}</Text>
              <View style={styles.gradientRow}>
                {rubanOpacitySteps.map(opacity => {
                  const colorKey = `${role}-${opacity}` as RubanGradientColorKey;

                  return (
                    <View key={colorKey} style={styles.gradientStep}>
                      <View style={[styles.gradientColor, {backgroundColor: theme[colorKey]}]} />
                      <Text style={styles.gradientLabel}>{opacity}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          testID="playground-open-progress"
          accessibilityRole="button"
          activeOpacity={0.78}
          onPress={onOpenProgress}
          style={styles.progressLink}>
          <Text style={styles.progressLinkLabel}>PROGRESS LAB</Text>
          <Text style={styles.progressLinkArrow}>→</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(themeColors: RubanThemeColorVariants, semanticTheme: RubanSemanticColors) {
  const theme = {
    canvas: semanticTheme['surface-page'],
    paper: semanticTheme['surface-card'],
    ink: semanticTheme['text-primary'],
    muted: semanticTheme['text-tertiary'],
    line: semanticTheme['border-default'],
    cobalt: themeColors['cobalt-100'],
    signal: themeColors['signal-100'],
    acid: themeColors['acid-100'],
    editorial: themeColors.editorial,
    contrastSurface: semanticTheme['surface-contrast'],
    contrastText: semanticTheme['text-inverse'],
    contrastMuted: themeColors['contrast-muted'],
    contrastLine: themeColors['contrast-line'],
    contrastAccent: themeColors['contrast-accent'],
  };

  return StyleSheet.create({
    safeArea: {flex: 1, backgroundColor: theme.canvas},
    scroll: {flex: 1, backgroundColor: theme.canvas},
    content: {paddingHorizontal: 20, paddingTop: 14, paddingBottom: 56},
    header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    headerName: {fontSize: 12, lineHeight: 16, fontWeight: '900', letterSpacing: 2.2, color: theme.ink},
    themeControl: {flexDirection: 'row', alignItems: 'center'},
    themeMode: {marginRight: 8, fontFamily: monoFont, fontSize: 9, lineHeight: 12, fontWeight: '700', color: theme.muted},
    typeHero: {
      minHeight: 238,
      marginTop: 18,
      paddingHorizontal: 18,
      paddingVertical: 14,
      backgroundColor: theme.paper,
      borderWidth: 1,
      borderColor: theme.line,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    heroLetters: {fontSize: 108, lineHeight: 116, fontWeight: '800', letterSpacing: -8, color: theme.ink},
    heroMeta: {alignItems: 'flex-end', paddingBottom: 9},
    heroWord: {fontSize: 25, lineHeight: 30, fontWeight: '600', letterSpacing: -0.8, color: theme.cobalt},
    heroNumbers: {marginTop: 6, fontFamily: monoFont, fontSize: 10, lineHeight: 14, color: theme.muted},
    sectionRule: {
      marginTop: 28,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.ink,
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    sectionNumber: {fontFamily: monoFont, fontSize: 10, lineHeight: 14, color: theme.cobalt},
    sectionName: {fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 1.8, color: theme.ink},
    typeList: {backgroundColor: theme.paper},
    typeRow: {minHeight: 104, padding: 16, borderBottomWidth: 1, borderBottomColor: theme.line, justifyContent: 'space-between'},
    typeRowLast: {minHeight: 104, padding: 16, justifyContent: 'space-between'},
    specimenLabel: {fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 1.2, color: theme.muted},
    specimenLabelInverse: {color: theme.contrastText},
    systemSpecimen: {fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -1.2, color: theme.ink},
    serifSpecimen: {fontFamily: serifFont, fontSize: 31, lineHeight: 39, fontWeight: '500', color: theme.editorial},
    monoSpecimen: {fontFamily: monoFont, fontSize: 19, lineHeight: 26, fontWeight: '600', color: theme.signal},
    splitSpecimen: {minHeight: 190, flexDirection: 'row'},
    splitPrimary: {flex: 2, padding: 16, backgroundColor: theme.cobalt, justifyContent: 'space-between'},
    splitValue: {fontFamily: condensedFont, fontSize: 92, lineHeight: 94, fontWeight: '800', letterSpacing: -4, color: '#FFFFFF'},
    splitSecondary: {flex: 1, padding: 14, backgroundColor: theme.acid, justifyContent: 'space-between'},
    splitUnit: {fontSize: 36, lineHeight: 40, fontWeight: '900', color: '#101114'},
    splitMeta: {fontFamily: monoFont, fontSize: 8, lineHeight: 14, fontWeight: '700', color: '#101114'},
    editorialSpecimen: {
      minHeight: 190,
      marginTop: 14,
      backgroundColor: theme.paper,
      borderWidth: 1,
      borderColor: theme.line,
      flexDirection: 'row',
    },
    signalBar: {width: 10, backgroundColor: theme.signal},
    editorialMain: {flex: 1, padding: 16, justifyContent: 'space-between'},
    editorialTitle: {fontFamily: serifFont, fontSize: 64, lineHeight: 68, color: theme.editorial},
    editorialCounter: {fontFamily: monoFont, fontSize: 11, color: theme.muted},
    editorialSide: {width: 58, borderLeftWidth: 1, borderLeftColor: theme.line, alignItems: 'center', justifyContent: 'center'},
    verticalWord: {fontSize: 10, lineHeight: 12, fontWeight: '900', letterSpacing: 3, color: theme.cobalt, transform: [{rotate: '90deg'}]},
    denseSpecimen: {marginTop: 14, padding: 16, backgroundColor: theme.contrastSurface},
    denseHeader: {paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    liveDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: theme.contrastAccent},
    denseRow: {minHeight: 48, borderTopWidth: 1, borderTopColor: theme.contrastLine, flexDirection: 'row', alignItems: 'center'},
    denseIndex: {width: 36, fontFamily: monoFont, fontSize: 10, color: theme.contrastAccent},
    denseName: {flex: 1, fontSize: 12, fontWeight: '800', letterSpacing: 0.9, color: theme.contrastText},
    denseState: {fontFamily: monoFont, fontSize: 9, color: theme.contrastMuted},
    denseStateReady: {color: theme.contrastAccent},
    paletteGroups: {},
    paletteGroup: {marginBottom: 12, padding: 12, backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line},
    paletteName: {fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.4, color: theme.ink},
    gradientRow: {marginTop: 10, flexDirection: 'row', justifyContent: 'space-between'},
    gradientStep: {width: '23%'},
    gradientColor: {height: 54, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.line},
    gradientLabel: {marginTop: 6, fontFamily: monoFont, fontSize: 8, lineHeight: 11, color: theme.muted},
    progressLink: {
      minHeight: 54,
      marginTop: 28,
      paddingHorizontal: 16,
      backgroundColor: theme.contrastSurface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    progressLinkLabel: {fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 1.4, color: theme.contrastText},
    progressLinkArrow: {fontSize: 22, color: theme.contrastAccent},
  });
}
