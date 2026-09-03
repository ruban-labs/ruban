import * as React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { radius, useRubanColors } from '../../design/tokens';
import { useFieldState } from './Field';

export type CheckboxProps = Omit<PressableProps, 'children' | 'onPress'> & {
  checked: boolean;
  label?: string;
  onCheckedChange?: (checked: boolean) => void;
  invalid?: boolean;
};

function resolveExternalStyle(
  style: PressableProps['style'],
  state: PressableStateCallbackType,
): StyleProp<ViewStyle> {
  return typeof style === 'function' ? style(state) : style;
}

export function Checkbox({
  checked,
  label,
  onCheckedChange,
  invalid,
  disabled = false,
  accessibilityLabel,
  accessibilityState,
  hitSlop,
  style,
  ...pressableProps
}: CheckboxProps): React.ReactElement {
  const colors = useRubanColors();
  const field = useFieldState({ disabled: disabled === true, invalid });
  const borderColor = field.invalid
    ? colors.alert
    : checked
    ? colors.accent
    : colors.borderStrong;

  return (
    <Pressable
      {...pressableProps}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{
        ...accessibilityState,
        checked,
        disabled: field.disabled,
      }}
      disabled={field.disabled}
      hitSlop={hitSlop || 4}
      onPress={() => {
        if (onCheckedChange) {
          onCheckedChange(!checked);
        }
      }}
      style={state => [
        styles.root,
        field.disabled ? styles.disabled : undefined,
        state.pressed ? styles.pressed : undefined,
        resolveExternalStyle(style, state),
      ]}
    >
      <View
        style={[
          styles.box,
          {
            backgroundColor: checked ? colors.accent : colors.surface,
            borderColor,
          },
        ]}
      >
        {checked ? (
          <Text
            allowFontScaling={false}
            style={[styles.mark, { color: colors.inverse }]}
          >
            ✓
          </Text>
        ) : null}
      </View>
      {label ? (
        <Text style={[styles.label, { color: colors.ink }]}>{label}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  box: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { fontSize: 14, lineHeight: 17, fontWeight: '900' },
  label: {
    flex: 1,
    marginLeft: 11,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.62 },
});
