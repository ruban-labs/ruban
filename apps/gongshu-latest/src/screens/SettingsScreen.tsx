import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  ArrowRightIcon,
  CodeIcon,
  DocumentIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LicenseIcon,
  ShieldIcon,
  TagIcon,
  ThemeDarkIcon,
  ThemeLightIcon,
  ThemeModeIcon,
  TabsIcon,
  type RubanIconProps,
} from '@ruban-labs/react-native-ui-icons';
import * as React from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { architectureLabel, buildInfo } from '../buildInfo';
import { RubanScreen } from '../components/RubanPrimitives';
import {
  BottomSheetModal,
  BottomSheetModalRoot,
  SelectionBottomSheet,
  type SelectionOption,
} from '../components/ui/BottomSheetModal';
import { spacing, useRubanColors } from '../design/tokens';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import {
  useAppPreferences,
  type AppearancePreference,
} from '../settings/AppPreferences';

type Props = BottomTabScreenProps<TabParamList, 'Settings'>;
type SettingsAction = 'select' | 'external' | 'navigate';

type PlaygroundItem = {
  label: string;
  meta: string;
  destination: 'lab' | 'component';
  target: string;
};

type SettingsRowProps = {
  label: string;
  value: string;
  onPress?: () => void;
  action?: SettingsAction;
  testID?: string;
  icon?: React.ComponentType<RubanIconProps>;
};

function SettingsRow({
  label,
  value,
  onPress,
  action = 'select',
  testID,
  icon: Icon,
}: SettingsRowProps): React.ReactElement {
  const colors = useRubanColors();
  const content = (
    <>
      <View style={styles.rowIdentity}>
        {Icon ? <Icon size={21} color={colors.muted} /> : null}
        <Text
          style={[
            styles.rowLabel,
            Icon ? styles.rowLabelWithIcon : undefined,
            { color: colors.ink },
          ]}
        >
          {label}
        </Text>
      </View>
      <View style={styles.rowValueWrap}>
        <Text
          numberOfLines={1}
          style={[styles.rowValue, { color: colors.faint }]}
        >
          {value}
        </Text>
        {onPress ? (
          action === 'external' ? (
            <ExternalLinkIcon
              size={18}
              color={colors.accent}
              style={styles.rowActionIcon}
            />
          ) : action === 'navigate' ? (
            <ArrowRightIcon
              size={18}
              color={colors.accent}
              style={styles.rowActionIcon}
            />
          ) : null
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
        style={[styles.row, { borderBottomColor: colors.border }]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      {content}
    </View>
  );
}

const appearanceOptions: ReadonlyArray<SelectionOption<AppearancePreference>> =
  [
    { value: 'system', label: 'System', icon: ThemeModeIcon },
    { value: 'light', label: 'Light', icon: ThemeLightIcon },
    { value: 'dark', label: 'Dark', icon: ThemeDarkIcon },
  ];

const playgroundItems: readonly PlaygroundItem[] = [
  {
    label: 'Design playground',
    meta: 'DESIGN',
    destination: 'lab',
    target: 'design',
  },
  {
    label: 'Progress',
    meta: 'FEEDBACK',
    destination: 'lab',
    target: 'progress',
  },
  {
    label: 'Button',
    meta: 'ACTION',
    destination: 'component',
    target: 'button',
  },
  { label: 'Card', meta: 'SURFACE', destination: 'component', target: 'card' },
  { label: 'Badge', meta: 'STATUS', destination: 'component', target: 'badge' },
  {
    label: 'Separator',
    meta: 'STRUCTURE',
    destination: 'component',
    target: 'separator',
  },
  {
    label: 'Switch',
    meta: 'CONTROL',
    destination: 'component',
    target: 'switch',
  },
  { label: 'Field', meta: 'FORM', destination: 'component', target: 'field' },
  { label: 'Input', meta: 'FORM', destination: 'component', target: 'input' },
  {
    label: 'Textarea',
    meta: 'FORM',
    destination: 'component',
    target: 'textarea',
  },
  {
    label: 'Checkbox',
    meta: 'CONTROL',
    destination: 'component',
    target: 'checkbox',
  },
  {
    label: 'Radio group',
    meta: 'CONTROL',
    destination: 'component',
    target: 'radio-group',
  },
  {
    label: 'Select',
    meta: 'CONTROL',
    destination: 'component',
    target: 'select',
  },
  {
    label: 'Dialog',
    meta: 'OVERLAY',
    destination: 'component',
    target: 'dialog',
  },
  {
    label: 'Collapsible',
    meta: 'STRUCTURE',
    destination: 'component',
    target: 'collapsible',
  },
  {
    label: 'Form workbench',
    meta: 'RECIPE',
    destination: 'component',
    target: 'form',
  },
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
    <View
      style={[styles.groupWrap, inSheet ? styles.sheetGroupWrap : undefined]}
    >
      <Text style={[styles.groupLabel, { color: colors.faint }]}>{label}</Text>
      <View
        style={[
          styles.group,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
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
      title="Build & matrix"
      onDismiss={onDismiss}
    >
      <ScrollView bounces={false} contentContainerStyle={styles.sheetContent}>
        <SettingsGroup label="CURRENT APP" inSheet>
          <SettingsRow
            label="Environment"
            value={buildInfo.environment.toUpperCase()}
          />
          <SettingsRow label="React Native" value={buildInfo.reactNative} />
          <SettingsRow label="React" value={buildInfo.react} />
          <SettingsRow label="Architecture" value={architectureLabel} />
          <SettingsRow label="Engine" value={buildInfo.engine.toUpperCase()} />
          <SettingsRow
            label="Platform"
            value={`${buildInfo.platform.toUpperCase()} ${
              buildInfo.platformVersion
            }`}
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

function PlaygroundBottomSheet({
  visible,
  onDismiss,
  onOpen,
}: {
  visible: boolean;
  onDismiss: () => void;
  onOpen: (item: PlaygroundItem) => void;
}): React.ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <BottomSheetModalRoot visible={visible} onDismiss={onDismiss}>
      <BottomSheetScrollView
        testID="settings-sheet-playground"
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.sheetContent,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        <SettingsGroup label="LABS" inSheet>
          {playgroundItems.slice(0, 2).map(item => (
            <SettingsRow
              key={item.target}
              testID={`playground-open-${item.target}`}
              label={item.label}
              value={item.meta}
              action="navigate"
              onPress={() => onOpen(item)}
            />
          ))}
        </SettingsGroup>
        <SettingsGroup label="COMPONENTS" inSheet>
          {playgroundItems.slice(2).map(item => (
            <SettingsRow
              key={item.target}
              testID={`playground-open-${item.target}`}
              label={item.label}
              value={item.meta}
              action="navigate"
              onPress={() => onOpen(item)}
            />
          ))}
        </SettingsGroup>
      </BottomSheetScrollView>
    </BottomSheetModalRoot>
  );
}

export default function SettingsScreen({
  route,
  navigation,
}: Props): React.ReactElement {
  const colors = useRubanColors();
  const { appearance, setAppearance } = useAppPreferences();
  const activeSheet = route.params?.sheet;
  const showsDiagnostics = buildInfo.environment !== 'production';
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const dismissSheet = () => navigation.setParams({ sheet: undefined });
  const openPlaygroundItem = (item: PlaygroundItem) => {
    dismissSheet();
    if (item.destination === 'lab') {
      rootNavigation?.navigate('DeveloperLab', { tool: item.target });
      return;
    }

    rootNavigation?.navigate('ComponentDetail', {
      component: item.target,
      theme: colors.mode,
    });
  };

  return (
    <RubanScreen testID="screen-settings">
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>
          Settings
        </Text>
      </View>

      <SettingsGroup label="APP">
        <SettingsRow
          testID="settings-appearance"
          label="Appearance"
          value={appearance.toUpperCase()}
          icon={ThemeModeIcon}
          onPress={() => navigation.setParams({ sheet: 'appearance' })}
        />
      </SettingsGroup>

      <SettingsGroup label="ABOUT">
        <SettingsRow
          label="Ruban Labs"
          value="WEBSITE"
          icon={GlobeIcon}
          action="external"
          onPress={() => Linking.openURL('https://mobile.ruban-labs.work/')}
        />
        <SettingsRow
          label="Documentation"
          value="GITHUB"
          icon={DocumentIcon}
          action="external"
          onPress={() => Linking.openURL('https://github.com/ruban-labs/ruban')}
        />
        <SettingsRow
          label="Privacy"
          value="POLICY"
          icon={ShieldIcon}
          action="external"
          onPress={() =>
            Linking.openURL('https://mobile.ruban-labs.work/privacy/')
          }
        />
        <SettingsRow label="Version" value="0.0.1" icon={TagIcon} />
        <SettingsRow label="License" value="MIT" icon={LicenseIcon} />
      </SettingsGroup>

      {showsDiagnostics ? (
        <SettingsGroup label="DIAGNOSTICS">
          <SettingsRow
            testID="settings-playground"
            label="Playground"
            value={`${playgroundItems.length} SCREENS`}
            icon={TabsIcon}
            onPress={() => navigation.setParams({ sheet: 'playground' })}
          />
          <SettingsRow
            testID="settings-build"
            label="Build & matrix"
            value={`RN ${buildInfo.reactNative}`}
            icon={CodeIcon}
            onPress={() => navigation.setParams({ sheet: 'build' })}
          />
        </SettingsGroup>
      ) : null}

      <SelectionBottomSheet
        testID="settings-sheet-appearance"
        visible={activeSheet === 'appearance'}
        title="Appearance"
        value={appearance}
        options={appearanceOptions}
        onChange={setAppearance}
        onDismiss={dismissSheet}
      />
      {showsDiagnostics ? (
        <>
          <PlaygroundBottomSheet
            visible={activeSheet === 'playground'}
            onDismiss={dismissSheet}
            onOpen={openPlaygroundItem}
          />
          <BuildInfoBottomSheet
            visible={activeSheet === 'build'}
            onDismiss={dismissSheet}
          />
        </>
      ) : null}
    </RubanScreen>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.45,
  },
  groupWrap: { marginTop: spacing.lg },
  sheetGroupWrap: { marginTop: spacing.lg },
  sheetContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  groupLabel: {
    marginBottom: 9,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  group: { borderWidth: 1 },
  row: {
    minHeight: 58,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  rowLabel: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  rowLabelWithIcon: { marginLeft: 12 },
  rowValueWrap: { flexShrink: 0, flexDirection: 'row', alignItems: 'center' },
  rowValue: {
    minWidth: 56,
    textAlign: 'right',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  rowActionIcon: { marginLeft: 8 },
});
