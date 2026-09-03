import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import * as React from 'react';
import {Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {architectureLabel, buildInfo} from '../buildInfo';
import {RubanScreen} from '../components/RubanPrimitives';
import {
  BottomSheetModal,
  SelectionBottomSheet,
  type SelectionOption,
} from '../components/ui/BottomSheetModal';
import {spacing, useRubanColors} from '../design/tokens';
import type {TabParamList} from '../navigation/types';
import {
  useAppPreferences,
  type AppearancePreference,
} from '../settings/AppPreferences';

type Props = BottomTabScreenProps<TabParamList, 'Settings'>;
type SettingsAction = 'select' | 'external';

type SettingsRowProps = {
  label: string;
  value: string;
  onPress?: () => void;
  action?: SettingsAction;
  testID?: string;
};

function SettingsRow({
  label,
  value,
  onPress,
  action = 'select',
  testID,
}: SettingsRowProps): React.ReactElement {
  const colors = useRubanColors();
  const content = (
    <>
      <Text style={[styles.rowLabel, {color: colors.ink}]}>{label}</Text>
      <View style={styles.rowValueWrap}>
        <Text numberOfLines={1} style={[styles.rowValue, {color: colors.faint}]}>
          {value}
        </Text>
        {onPress ? (
          <Text style={[styles.rowArrow, {color: colors.accent}]}>
            {action === 'external' ? '↗' : '↓'}
          </Text>
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        accessibilityRole={action === 'external' ? 'link' : 'button'}
        activeOpacity={0.72}
        onPress={onPress}
        style={[styles.row, {borderBottomColor: colors.border}]}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.row, {borderBottomColor: colors.border}]}>{content}</View>;
}

const appearanceOptions: ReadonlyArray<SelectionOption<AppearancePreference>> = [
  {value: 'system', label: 'System', meta: 'FOLLOW DEVICE'},
  {value: 'light', label: 'Light', meta: 'RUBAN LIGHT'},
  {value: 'dark', label: 'Dark', meta: 'RUBAN DARK'},
];

function SettingsGroup({
  label,
  children,
  inSheet = false,
}: {
  label: string;
  children: React.ReactNode;
  inSheet?: boolean;
}): React.ReactElement {
  const colors = useRubanColors();

  return (
    <View style={[styles.groupWrap, inSheet ? styles.sheetGroupWrap : undefined]}>
      <Text style={[styles.groupLabel, {color: colors.faint}]}>{label}</Text>
      <View style={[styles.group, {backgroundColor: colors.surface, borderColor: colors.border}]}>
        {children}
      </View>
    </View>
  );
}

function BuildInfoBottomSheet({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}): React.ReactElement | null {
  return (
    <BottomSheetModal
      testID="settings-sheet-build"
      visible={visible}
      title="Runtime & Compatibility"
      onDismiss={onDismiss}>
      <ScrollView bounces={false} contentContainerStyle={styles.sheetContent}>
        <SettingsGroup label="CURRENT APP" inSheet>
          <SettingsRow label="React Native" value={buildInfo.reactNative} />
          <SettingsRow label="React" value={buildInfo.react} />
          <SettingsRow label="Architecture" value={architectureLabel} />
          <SettingsRow label="Engine" value={buildInfo.engine.toUpperCase()} />
          <SettingsRow
            label="Platform"
            value={`${buildInfo.platform.toUpperCase()} ${buildInfo.platformVersion}`}
          />
        </SettingsGroup>
        <SettingsGroup label="COMPATIBILITY" inSheet>
          <SettingsRow label="RN 0.66" value="OLD" />
          <SettingsRow label="RN 0.77" value="OLD + NEW" />
          <SettingsRow label="RN LATEST" value="NEW" />
        </SettingsGroup>
      </ScrollView>
    </BottomSheetModal>
  );
}

export default function SettingsScreen({route, navigation}: Props): React.ReactElement {
  const colors = useRubanColors();
  const {appearance, setAppearance} = useAppPreferences();
  const activeSheet = route.params?.sheet;
  const dismissSheet = () => navigation.setParams({sheet: undefined});

  return (
    <RubanScreen testID="screen-settings">
      <View style={styles.header}>
        <Text style={[styles.headerLabel, {color: colors.ink}]}>RUBAN / SETTINGS</Text>
        <Text style={[styles.headerMeta, {color: colors.faint}]}>
          WORKBENCH
        </Text>
      </View>
      <Text style={[styles.title, {color: colors.ink}]}>Settings</Text>

      <SettingsGroup label="PREFERENCES">
        <SettingsRow
          testID="settings-appearance"
          label="Appearance"
          value={appearance.toUpperCase()}
          onPress={() => navigation.setParams({sheet: 'appearance'})}
        />
      </SettingsGroup>

      <SettingsGroup label="TECHNICAL">
        <SettingsRow
          testID="settings-build"
          label="Runtime & compatibility"
          value={`RN ${buildInfo.reactNative}`}
          onPress={() => navigation.setParams({sheet: 'build'})}
        />
      </SettingsGroup>

      <SettingsGroup label="ABOUT">
        <SettingsRow label="Purpose" value="UI REFERENCE" />
        <SettingsRow label="Audience" value="RN TEAMS" />
        <SettingsRow
          label="Ruban Labs"
          value="WEBSITE"
          action="external"
          onPress={() => Linking.openURL('https://mobile.ruban-labs.work/')}
        />
        <SettingsRow
          label="Documentation"
          value="GITHUB"
          action="external"
          onPress={() => Linking.openURL('https://github.com/ruban-labs/ruban')}
        />
        <SettingsRow
          label="Privacy"
          value="POLICY"
          action="external"
          onPress={() => Linking.openURL('https://mobile.ruban-labs.work/privacy/')}
        />
        <SettingsRow label="Version" value="0.0.1" />
        <SettingsRow label="License" value="MIT" />
      </SettingsGroup>

      <SelectionBottomSheet
        testID="settings-sheet-appearance"
        visible={activeSheet === 'appearance'}
        title="Appearance"
        value={appearance}
        options={appearanceOptions}
        onChange={setAppearance}
        onDismiss={dismissSheet}
      />
      <BuildInfoBottomSheet visible={activeSheet === 'build'} onDismiss={dismissSheet} />
    </RubanScreen>
  );
}

const styles = StyleSheet.create({
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  headerLabel: {fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 1.7},
  headerMeta: {fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 0.9},
  title: {marginTop: 28, fontSize: 48, lineHeight: 52, fontWeight: '800', letterSpacing: -2.4},
  groupWrap: {marginTop: spacing.xl},
  sheetGroupWrap: {marginTop: spacing.lg},
  sheetContent: {paddingHorizontal: spacing.lg, paddingBottom: spacing.lg},
  groupLabel: {marginBottom: 9, fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.3},
  group: {borderWidth: 1},
  row: {
    minHeight: 58,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {flex: 1, paddingRight: 12, fontSize: 14, lineHeight: 19, fontWeight: '700'},
  rowValueWrap: {flexShrink: 0, flexDirection: 'row', alignItems: 'center'},
  rowValue: {minWidth: 56, textAlign: 'right', fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.8},
  rowArrow: {marginLeft: 8, fontSize: 16, lineHeight: 18},
});
