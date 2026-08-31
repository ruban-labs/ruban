import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {radius, useRubanColors, type RubanColors} from '../../design/tokens';

export const buttonVariants = ['primary', 'secondary', 'outline', 'ghost', 'destructive'] as const;
export const buttonSizes = ['sm', 'md', 'lg'] as const;

export type ButtonVariant = (typeof buttonVariants)[number];
export type ButtonSize = (typeof buttonSizes)[number];

export type ButtonProps = Omit<PressableProps, 'children'> & {
  children: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
};

type ButtonPalette = {
  background: string;
  pressedBackground: string;
  border: string;
  foreground: string;
};

function getButtonPalette(variant: ButtonVariant, colors: RubanColors): ButtonPalette {
  if (variant === 'secondary') {
    return {
      background: colors.surfaceRaised,
      pressedBackground: colors.accentSoft,
      border: colors.border,
      foreground: colors.ink,
    };
  }

  if (variant === 'outline') {
    return {
      background: 'transparent',
      pressedBackground: colors.surfaceRaised,
      border: colors.borderStrong,
      foreground: colors.ink,
    };
  }

  if (variant === 'ghost') {
    return {
      background: 'transparent',
      pressedBackground: colors.surfaceRaised,
      border: 'transparent',
      foreground: colors.ink,
    };
  }

  if (variant === 'destructive') {
    return {
      background: colors.alert,
      pressedBackground: colors.alertPressed,
      border: colors.alert,
      foreground: colors.alertForeground,
    };
  }

  return {
    background: colors.accent,
    pressedBackground: colors.accentPressed,
    border: colors.accent,
    foreground: colors.inverse,
  };
}

function resolveExternalStyle(
  style: PressableProps['style'],
  state: PressableStateCallbackType
): StyleProp<ViewStyle> {
  return typeof style === 'function' ? style(state) : style;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled = false,
  accessibilityRole,
  accessibilityState,
  style,
  ...pressableProps
}: ButtonProps): React.ReactElement {
  const colors = useRubanColors();
  const palette = getButtonPalette(variant, colors);
  const inactive = disabled || loading;

  return (
    <Pressable
      {...pressableProps}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityState={{...accessibilityState, busy: loading, disabled: inactive}}
      disabled={inactive}
      style={state => [
        styles.root,
        sizeStyles[size],
        fullWidth ? styles.fullWidth : undefined,
        {
          backgroundColor: state.pressed ? palette.pressedBackground : palette.background,
          borderColor: palette.border,
        },
        inactive ? styles.inactive : undefined,
        resolveExternalStyle(style, state),
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.foreground} size="small" style={styles.spinner} />
      ) : null}
      <Text style={[styles.label, labelSizeStyles[size], {color: palette.foreground}]}>
        {loading ? 'LOADING' : children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {alignSelf: 'stretch'},
  inactive: {opacity: 0.42},
  spinner: {marginRight: 9},
  label: {fontWeight: '900', letterSpacing: 0.75},
});

const sizeStyles = StyleSheet.create({
  sm: {minHeight: 36, paddingHorizontal: 12},
  md: {minHeight: 44, paddingHorizontal: 16},
  lg: {minHeight: 52, paddingHorizontal: 20},
});

const labelSizeStyles = StyleSheet.create({
  sm: {fontSize: 10, lineHeight: 13},
  md: {fontSize: 11, lineHeight: 15},
  lg: {fontSize: 12, lineHeight: 16},
});
