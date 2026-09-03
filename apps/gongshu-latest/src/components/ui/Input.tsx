import * as React from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { radius, useRubanColors } from '../../design/tokens';
import { useFieldState } from './Field';

export type InputProps = TextInputProps & {
  disabled?: boolean;
  invalid?: boolean;
};

export type InputHandle = React.ElementRef<typeof TextInput>;

export const Input = React.forwardRef<InputHandle, InputProps>(
  function RubanInput(
    {
      disabled,
      invalid,
      editable = true,
      accessibilityState,
      onFocus,
      onBlur,
      placeholderTextColor,
      selectionColor,
      style,
      ...textInputProps
    },
    ref,
  ): React.ReactElement {
    const colors = useRubanColors();
    const field = useFieldState({ disabled, invalid });
    const [focused, setFocused] = React.useState(false);
    const enabled = editable && !field.disabled;
    const borderColor = field.invalid
      ? colors.alert
      : focused
      ? colors.focusRing
      : colors.borderStrong;

    return (
      <TextInput
        {...textInputProps}
        ref={ref}
        editable={enabled}
        accessibilityState={{ ...accessibilityState, disabled: !enabled }}
        onFocus={event => {
          setFocused(true);
          if (onFocus) {
            onFocus(event);
          }
        }}
        onBlur={event => {
          setFocused(false);
          if (onBlur) {
            onBlur(event);
          }
        }}
        placeholderTextColor={placeholderTextColor || colors.faint}
        selectionColor={selectionColor || colors.accent}
        style={[
          styles.input,
          {
            backgroundColor: field.disabled
              ? colors.surfaceRaised
              : colors.surface,
            borderColor,
            color: colors.ink,
          },
          style,
        ]}
      />
    );
  },
);

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
});
