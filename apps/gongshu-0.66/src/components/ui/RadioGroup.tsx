import * as React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import {useRubanColors} from '../../design/tokens';
import {useFieldState} from './Field';

type RadioGroupContextValue = {
  disabled: boolean;
  onValueChange?: (value: string) => void;
  value?: string;
};

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
  null,
);

export type RadioGroupProps = ViewProps & {
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  value?: string;
};

export function RadioGroup({
  disabled = false,
  onValueChange,
  value,
  style,
  children,
  ...viewProps
}: RadioGroupProps): React.ReactElement {
  const field = useFieldState({disabled});
  const contextValue = React.useMemo(
    () => ({disabled: field.disabled, onValueChange, value}),
    [field.disabled, onValueChange, value],
  );

  return (
    <RadioGroupContext.Provider value={contextValue}>
      <View {...viewProps} style={[styles.group, style]}>
        {children}
      </View>
    </RadioGroupContext.Provider>
  );
}

export type RadioGroupItemProps = Omit<
  PressableProps,
  'children' | 'onPress'
> & {
  disabled?: boolean;
  label: string;
  value: string;
};

function resolveExternalStyle(
  style: PressableProps['style'],
  state: PressableStateCallbackType,
): StyleProp<ViewStyle> {
  return typeof style === 'function' ? style(state) : style;
}

export function RadioGroupItem({
  disabled = false,
  label,
  value,
  accessibilityLabel,
  accessibilityState,
  hitSlop,
  style,
  ...pressableProps
}: RadioGroupItemProps): React.ReactElement {
  const colors = useRubanColors();
  const group = React.useContext(RadioGroupContext);
  if (!group) {
    throw new Error('RadioGroupItem must be rendered inside RadioGroup');
  }

  const inactive = disabled || group.disabled;
  const selected = group.value === value;

  return (
    <Pressable
      {...pressableProps}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{
        ...accessibilityState,
        checked: selected,
        disabled: inactive,
      }}
      disabled={inactive}
      hitSlop={hitSlop || 4}
      onPress={() => {
        if (group.onValueChange) {
          group.onValueChange(value);
        }
      }}
      style={state => [
        styles.item,
        inactive ? styles.disabled : undefined,
        state.pressed ? styles.pressed : undefined,
        resolveExternalStyle(style, state),
      ]}>
      <View
        style={[
          styles.radio,
          {borderColor: selected ? colors.accent : colors.borderStrong},
        ]}>
        {selected ? (
          <View style={[styles.dot, {backgroundColor: colors.accent}]} />
        ) : null}
      </View>
      <Text style={[styles.label, {color: colors.ink}]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {alignSelf: 'stretch'},
  item: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {width: 10, height: 10, borderRadius: 5},
  label: {
    flex: 1,
    marginLeft: 11,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  disabled: {opacity: 0.48},
  pressed: {opacity: 0.62},
});
