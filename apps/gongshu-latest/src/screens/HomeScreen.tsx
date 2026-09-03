import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import * as React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Collapsible from '@ruban-labs/react-native-collapsible';
import {Bar} from '@ruban-labs/react-native-progress';
import {RubanScreen} from '../components/RubanPrimitives';
import {spacing, useRubanColors, type RubanColors} from '../design/tokens';
import type {RootStackParamList, TabParamList} from '../navigation/types';

type Props = BottomTabScreenProps<TabParamList, 'Home'>;
type ComponentName =
  | 'Button'
  | 'Card'
  | 'Badge'
  | 'Separator'
  | 'Switch'
  | 'Field'
  | 'Input'
  | 'Textarea'
  | 'Checkbox'
  | 'Radio Group'
  | 'Select'
  | 'Progress'
  | 'Collapsible';
type ComponentTarget =
  | 'button'
  | 'card'
  | 'badge'
  | 'separator'
  | 'switch'
  | 'field'
  | 'input'
  | 'textarea'
  | 'checkbox'
  | 'radio-group'
  | 'select'
  | 'progress'
  | 'collapsible';
type ComponentItem = {
  index: string;
  name: ComponentName;
  category: string;
  distribution: 'source' | 'package';
  state: 'ready';
  target: ComponentTarget;
};
type GroupKey = 'source' | 'packages';

const componentInventory: readonly ComponentItem[] = [
  {index: '01', name: 'Button', category: 'ACTION', distribution: 'source', state: 'ready', target: 'button'},
  {index: '02', name: 'Card', category: 'SURFACE', distribution: 'source', state: 'ready', target: 'card'},
  {index: '03', name: 'Badge', category: 'STATUS', distribution: 'source', state: 'ready', target: 'badge'},
  {index: '04', name: 'Separator', category: 'STRUCTURE', distribution: 'source', state: 'ready', target: 'separator'},
  {index: '05', name: 'Switch', category: 'CONTROL', distribution: 'source', state: 'ready', target: 'switch'},
  {index: '06', name: 'Field', category: 'FORM', distribution: 'source', state: 'ready', target: 'field'},
  {index: '07', name: 'Input', category: 'FORM', distribution: 'source', state: 'ready', target: 'input'},
  {index: '08', name: 'Textarea', category: 'FORM', distribution: 'source', state: 'ready', target: 'textarea'},
  {index: '09', name: 'Checkbox', category: 'CONTROL', distribution: 'source', state: 'ready', target: 'checkbox'},
  {index: '10', name: 'Radio Group', category: 'CONTROL', distribution: 'source', state: 'ready', target: 'radio-group'},
  {index: '11', name: 'Select', category: 'CONTROL', distribution: 'source', state: 'ready', target: 'select'},
  {index: '12', name: 'Progress', category: 'FEEDBACK', distribution: 'package', state: 'ready', target: 'progress'},
  {index: '13', name: 'Collapsible', category: 'STRUCTURE', distribution: 'package', state: 'ready', target: 'collapsible'},
];

const groups: ReadonlyArray<{
  key: GroupKey;
  label: string;
  items: readonly ComponentItem[];
}> = [
  {key: 'source', label: 'CORE COMPONENTS', items: componentInventory.filter(item => item.distribution === 'source')},
  {key: 'packages', label: 'RUBAN PACKAGES', items: componentInventory.filter(item => item.distribution === 'package')},
];

const componentCount = String(componentInventory.length).padStart(2, '0');

function ComponentPreview({name, colors}: {name: ComponentName; colors: RubanColors}): React.ReactElement {
  if (name === 'Button') {
    return (
      <View style={[styles.previewButton, {backgroundColor: colors.ink}]}>
        <Text style={[styles.previewButtonText, {color: colors.inverse}]}>ACTION</Text>
      </View>
    );
  }

  if (name === 'Card') {
    return <View style={[styles.previewCard, {backgroundColor: colors.surface, borderColor: colors.border}]} />;
  }

  if (name === 'Badge') {
    return (
      <View style={[styles.previewBadge, {backgroundColor: colors.successSoft}]}>
        <Text style={[styles.previewBadgeText, {color: colors.success}]}>LIVE</Text>
      </View>
    );
  }

  if (name === 'Separator') {
    return <View style={[styles.previewSeparator, {backgroundColor: colors.ink}]} />;
  }

  if (name === 'Switch') {
    return (
      <View style={[styles.previewSwitch, {backgroundColor: colors.accentSoft}]}>
        <View style={[styles.previewSwitchThumb, {backgroundColor: colors.accent}]} />
      </View>
    );
  }

  if (name === 'Field') {
    return (
      <View style={styles.previewField}>
        <View style={[styles.previewLabel, {backgroundColor: colors.ink}]} />
        <View style={[styles.previewInput, {borderColor: colors.borderStrong}]} />
      </View>
    );
  }

  if (name === 'Input') {
    return <View style={[styles.previewInput, {borderColor: colors.borderStrong}]} />;
  }

  if (name === 'Textarea') {
    return <View style={[styles.previewTextarea, {borderColor: colors.borderStrong}]} />;
  }

  if (name === 'Checkbox') {
    return (
      <View style={[styles.previewCheckbox, {backgroundColor: colors.accent, borderColor: colors.accent}]}>
        <Text style={[styles.previewCheckmark, {color: colors.inverse}]}>✓</Text>
      </View>
    );
  }

  if (name === 'Radio Group') {
    return (
      <View style={styles.previewRadioGroup}>
        <View style={[styles.previewRadio, {borderColor: colors.accent}]}>
          <View style={[styles.previewRadioDot, {backgroundColor: colors.accent}]} />
        </View>
        <View style={[styles.previewRadio, {borderColor: colors.borderStrong}]} />
      </View>
    );
  }

  if (name === 'Select') {
    return (
      <View style={[styles.previewSelect, {borderColor: colors.borderStrong}]}>
        <View style={[styles.previewSelectLine, {backgroundColor: colors.ink}]} />
        <Text style={[styles.previewSelectArrow, {color: colors.accent}]}>↓</Text>
      </View>
    );
  }

  if (name === 'Collapsible') {
    return (
      <View style={[styles.previewDisclosure, {borderColor: colors.borderStrong}]}>
        <View style={[styles.previewDisclosureHeader, {backgroundColor: colors.accentSoft}]} />
        <View style={[styles.previewDisclosureLine, {backgroundColor: colors.ink}]} />
        <View style={[styles.previewDisclosureLineShort, {backgroundColor: colors.faint}]} />
      </View>
    );
  }

  return (
    <Bar
      progress={0.64}
      width={86}
      height={5}
      borderWidth={0}
      color={colors.accent}
      unfilledColor={colors.accentSoft}
    />
  );
}

function InventoryGroup({
  groupKey,
  label,
  items,
  expanded,
  colors,
  onToggle,
  onOpenComponent,
}: {
  groupKey: GroupKey;
  label: string;
  items: readonly ComponentItem[];
  expanded: boolean;
  colors: RubanColors;
  onToggle: () => void;
  onOpenComponent: (target: ComponentTarget) => void;
}): React.ReactElement {
  const first = items[0]?.index ?? '00';
  const last = items[items.length - 1]?.index ?? first;

  return (
    <View style={styles.inventoryGroup}>
      <TouchableOpacity
        testID={`home-group-${groupKey}`}
        accessibilityRole="button"
        accessibilityState={{expanded}}
        activeOpacity={0.72}
        onPress={onToggle}
        style={[styles.groupHeader, {borderColor: colors.ink}]}>
        <View>
          <Text style={[styles.groupLabel, {color: colors.ink}]}>{label}</Text>
          <Text style={[styles.groupRange, {color: colors.faint}]}>{first}—{last}</Text>
        </View>
        <View style={[styles.groupCount, {backgroundColor: expanded ? colors.ink : colors.surfaceRaised}]}>
          <Text style={[styles.groupCountText, {color: expanded ? colors.inverse : colors.faint}]}>
            {String(items.length).padStart(2, '0')} {expanded ? '−' : '+'}
          </Text>
        </View>
      </TouchableOpacity>
      <Collapsible
        testID={`home-group-${groupKey}-content`}
        collapsed={!expanded}
        duration={220}
        easing="easeOutCubic">
        <View>
          {items.map(component => (
            <TouchableOpacity
              key={component.name}
              accessibilityRole="button"
              activeOpacity={0.72}
              onPress={() => onOpenComponent(component.target)}
              style={[styles.componentRow, {borderBottomColor: colors.border}]}>
              <Text style={[styles.componentIndex, {color: colors.accent}]}>{component.index}</Text>
              <View style={styles.componentIdentity}>
                <Text style={[styles.componentName, {color: colors.ink}]}>{component.name}</Text>
                <Text style={[styles.componentMeta, {color: colors.faint}]}>
                  {component.category} · {component.distribution.toUpperCase()}
                </Text>
                <Text style={[styles.componentState, {color: colors.accent}]}>
                  {component.state.toUpperCase()}
                </Text>
              </View>
              <View style={styles.preview}>
                <ComponentPreview name={component.name} colors={colors} />
              </View>
              <Text style={[styles.rowArrow, {color: colors.faint}]}>→</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Collapsible>
    </View>
  );
}

export default function HomeScreen({navigation}: Props): React.ReactElement {
  const colors = useRubanColors();
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const [expandedGroups, setExpandedGroups] = React.useState<Record<GroupKey, boolean>>({
    source: true,
    packages: true,
  });

  const openComponent = (target: ComponentTarget) => {
    if (target === 'progress') {
      navigation.navigate('Playground', {
        tool: 'progress',
        bar: '0.64',
        circle: '0.42',
        pie: '0.76',
      });
      return;
    }

    rootNavigation?.navigate('ComponentDetail', {component: target, theme: 'light'});
  };

  const toggleGroup = (group: GroupKey) => {
    setExpandedGroups(current => ({...current, [group]: !current[group]}));
  };

  return (
    <RubanScreen testID="screen-home">
      <View style={styles.header}>
        <Text style={[styles.wordmark, {color: colors.ink}]}>RUBAN / UI WORKBENCH</Text>
        <Text style={[styles.buildTag, {color: colors.faint}]}>MOBILE</Text>
      </View>

      <View style={styles.titleRow}>
        <Text style={[styles.title, {color: colors.ink}]}>Library</Text>
        <View style={[styles.countBlock, {backgroundColor: colors.accent}]}>
          <Text style={[styles.count, {color: colors.inverse}]}>{componentCount}</Text>
        </View>
      </View>

      <View style={[styles.buildStrip, {borderColor: colors.border}]}>
        <View style={styles.buildCell}>
          <Text style={[styles.buildLabel, {color: colors.faint}]}>CORE</Text>
          <Text style={[styles.buildValue, {color: colors.ink}]}>11</Text>
        </View>
        <View style={[styles.buildCell, styles.buildCellBorder, {borderColor: colors.border}]}>
          <Text style={[styles.buildLabel, {color: colors.faint}]}>PACKAGES</Text>
          <Text style={[styles.buildValue, {color: colors.ink}]}>02</Text>
        </View>
        <View style={[styles.buildCell, styles.buildCellBorder, {borderColor: colors.border}]}>
          <Text style={[styles.buildLabel, {color: colors.faint}]}>THEMES</Text>
          <Text style={[styles.buildValue, {color: colors.ink}]}>02</Text>
        </View>
      </View>

      <View style={styles.inventory}>
        {groups.map(group => (
          <InventoryGroup
            key={group.key}
            groupKey={group.key}
            label={group.label}
            items={group.items}
            expanded={expandedGroups[group.key]}
            colors={colors}
            onToggle={() => toggleGroup(group.key)}
            onOpenComponent={openComponent}
          />
        ))}
      </View>

      <TouchableOpacity
        testID="home-open-form-workbench"
        accessibilityRole="button"
        activeOpacity={0.78}
        onPress={() => rootNavigation?.navigate('ComponentDetail', {component: 'form', theme: 'light'})}
        style={[styles.formLink, {backgroundColor: colors.accent}]}>
        <Text style={[styles.playgroundLabel, {color: colors.inverse}]}>OPEN FORM WORKBENCH</Text>
        <Text style={[styles.playgroundArrow, {color: colors.inverse}]}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="home-open-playground"
        accessibilityRole="button"
        activeOpacity={0.78}
        onPress={() => navigation.navigate('Playground', {tool: 'design'})}
        style={[styles.playgroundLink, {backgroundColor: colors.ink}]}>
        <Text style={[styles.playgroundLabel, {color: colors.inverse}]}>EXPLORE DESIGN SYSTEM</Text>
        <Text style={[styles.playgroundArrow, {color: colors.accent}]}>→</Text>
      </TouchableOpacity>
    </RubanScreen>
  );
}

const styles = StyleSheet.create({
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  wordmark: {fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 1.7},
  buildTag: {fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 0.8},
  titleRow: {marginTop: 28, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between'},
  title: {flexShrink: 1, fontSize: 44, lineHeight: 48, fontWeight: '800', letterSpacing: -2.2},
  countBlock: {width: 54, height: 54, alignItems: 'center', justifyContent: 'center'},
  count: {fontSize: 18, lineHeight: 22, fontWeight: '900'},
  buildStrip: {marginTop: spacing.lg, borderWidth: 1, flexDirection: 'row'},
  buildCell: {flex: 1, minHeight: 70, padding: 12, justifyContent: 'space-between'},
  buildCellBorder: {borderLeftWidth: 1},
  buildLabel: {fontSize: 8, lineHeight: 11, fontWeight: '800', letterSpacing: 1},
  buildValue: {fontSize: 13, lineHeight: 17, fontWeight: '900'},
  inventory: {marginTop: 30},
  inventoryGroup: {marginBottom: 18},
  groupHeader: {
    minHeight: 50,
    paddingLeft: 12,
    borderTopWidth: 2,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupLabel: {fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.25},
  groupRange: {marginTop: 3, fontSize: 8, lineHeight: 11, fontWeight: '700', letterSpacing: 0.7},
  groupCount: {alignSelf: 'stretch', minWidth: 68, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center'},
  groupCountText: {fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.7},
  componentRow: {minHeight: 84, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center'},
  componentIndex: {width: 34, fontSize: 10, lineHeight: 14, fontWeight: '800'},
  componentIdentity: {width: 116},
  componentName: {fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.25},
  componentMeta: {marginTop: 4, fontSize: 7, lineHeight: 10, fontWeight: '800', letterSpacing: 0.7},
  componentState: {marginTop: 2, fontSize: 7, lineHeight: 10, fontWeight: '900', letterSpacing: 0.8},
  preview: {flex: 1, alignItems: 'flex-end', paddingRight: 12},
  rowArrow: {width: 18, fontSize: 17},
  previewButton: {minWidth: 70, height: 30, alignItems: 'center', justifyContent: 'center'},
  previewButtonText: {fontSize: 7, lineHeight: 10, fontWeight: '900', letterSpacing: 0.8},
  previewCard: {width: 62, height: 38, borderWidth: 1},
  previewBadge: {height: 26, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center'},
  previewBadgeText: {fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.8},
  previewSeparator: {width: 76, height: 2},
  previewSwitch: {width: 48, height: 26, padding: 3, alignItems: 'flex-end', justifyContent: 'center'},
  previewSwitchThumb: {width: 20, height: 20},
  previewField: {width: 76},
  previewLabel: {width: 34, height: 3, marginBottom: 5},
  previewInput: {width: 76, height: 28, borderWidth: 1},
  previewTextarea: {width: 76, height: 40, borderWidth: 1},
  previewCheckbox: {width: 22, height: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center'},
  previewCheckmark: {fontSize: 13, lineHeight: 16, fontWeight: '900'},
  previewRadioGroup: {flexDirection: 'row'},
  previewRadio: {width: 22, height: 22, marginLeft: 7, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center'},
  previewRadioDot: {width: 10, height: 10, borderRadius: 5},
  previewSelect: {width: 76, height: 30, paddingHorizontal: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center'},
  previewSelectLine: {flex: 1, height: 2},
  previewSelectArrow: {marginLeft: 7, fontSize: 13, lineHeight: 16, fontWeight: '900'},
  previewDisclosure: {width: 76, height: 42, padding: 6, borderWidth: 1},
  previewDisclosureHeader: {height: 7},
  previewDisclosureLine: {width: 52, height: 2, marginTop: 7},
  previewDisclosureLineShort: {width: 34, height: 2, marginTop: 5},
  formLink: {minHeight: 56, marginTop: 2, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  playgroundLink: {minHeight: 56, marginTop: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  playgroundLabel: {fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 1.3},
  playgroundArrow: {fontSize: 22},
});
