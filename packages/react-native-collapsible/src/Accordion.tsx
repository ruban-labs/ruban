import * as React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type TouchableOpacityProps,
  View,
  type ViewStyle,
} from 'react-native';
import Collapsible from './Collapsible';
import type {CollapsibleAlignment, CollapsibleEasing} from './types';

export interface AccordionProps<Section> {
  sections: readonly Section[];
  activeSections: readonly number[];
  renderHeader: (
    section: Section,
    index: number,
    isActive: boolean,
    sections: readonly Section[],
  ) => React.ReactNode;
  renderContent: (
    section: Section,
    index: number,
    isActive: boolean,
    sections: readonly Section[],
  ) => React.ReactNode;
  onChange: (activeSections: number[]) => void;
  keyExtractor?: (section: Section, index: number) => string;
  renderFooter?: (
    section: Section,
    index: number,
    isActive: boolean,
    sections: readonly Section[],
  ) => React.ReactNode;
  expandMultiple?: boolean;
  disabled?: boolean | ((section: Section, index: number) => boolean);
  duration?: number;
  easing?: CollapsibleEasing;
  align?: CollapsibleAlignment;
  renderChildrenCollapsed?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  sectionContainerStyle?: StyleProp<ViewStyle>;
  headerContainerStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  touchableProps?: Omit<
    TouchableOpacityProps,
    'children' | 'disabled' | 'onPress' | 'style'
  >;
  testID?: string;
}

export function Accordion<Section>({
  sections,
  activeSections,
  renderHeader,
  renderContent,
  onChange,
  keyExtractor,
  renderFooter,
  expandMultiple = false,
  disabled = false,
  duration,
  easing,
  align,
  renderChildrenCollapsed,
  containerStyle,
  sectionContainerStyle,
  headerContainerStyle,
  contentContainerStyle,
  touchableProps,
  testID,
}: AccordionProps<Section>): React.ReactElement {
  const activeSet = React.useMemo(
    () => new Set(activeSections.filter(index => index >= 0 && index < sections.length)),
    [activeSections, sections.length],
  );

  const toggleSection = React.useCallback(
    (index: number) => {
      if (activeSet.has(index)) {
        onChange(activeSections.filter(activeIndex => activeIndex !== index));
        return;
      }

      if (!expandMultiple) {
        onChange([index]);
        return;
      }

      onChange(
        sections
          .map((_, sectionIndex) => sectionIndex)
          .filter(sectionIndex => activeSet.has(sectionIndex) || sectionIndex === index),
      );
    },
    [activeSections, activeSet, expandMultiple, onChange, sections],
  );

  return (
    <View testID={testID} style={containerStyle}>
      {sections.map((section, index) => {
        const active = activeSet.has(index);
        const sectionDisabled = typeof disabled === 'function' ? disabled(section, index) : disabled;
        const key = keyExtractor ? keyExtractor(section, index) : String(index);

        return (
          <View key={key} style={sectionContainerStyle}>
            <TouchableOpacity
              {...touchableProps}
              testID={testID ? `${testID}-header-${index}` : undefined}
              accessibilityRole="button"
              accessibilityState={{disabled: sectionDisabled, expanded: active}}
              activeOpacity={touchableProps && touchableProps.activeOpacity != null ? touchableProps.activeOpacity : 0.72}
              disabled={sectionDisabled}
              onPress={() => toggleSection(index)}
              style={[styles.header, headerContainerStyle]}>
              {renderHeader(section, index, active, sections)}
            </TouchableOpacity>
            <Collapsible
              testID={testID ? `${testID}-section-${index}` : undefined}
              collapsed={!active}
              duration={duration}
              easing={easing}
              align={align}
              renderChildrenCollapsed={renderChildrenCollapsed}
              contentContainerStyle={contentContainerStyle}>
              {renderContent(section, index, active, sections)}
            </Collapsible>
            {renderFooter ? renderFooter(section, index, active, sections) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {minHeight: 44, justifyContent: 'center'},
});

export default Accordion;
