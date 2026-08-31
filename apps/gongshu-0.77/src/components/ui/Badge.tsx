import * as React from 'react';
import {StyleSheet, Text, View, type TextProps, type ViewProps} from 'react-native';
import {radius, useRubanColors, type RubanColors} from '../../design/tokens';

export const badgeVariants = ['default', 'secondary', 'outline', 'destructive', 'live'] as const;
export const badgeSizes = ['sm', 'md'] as const;

export type BadgeVariant = (typeof badgeVariants)[number];
export type BadgeSize = (typeof badgeSizes)[number];

export type BadgeProps = Omit<ViewProps, 'children'> & {
  children: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  textStyle?: TextProps['style'];
};

type BadgePalette = {
  background: string;
  border: string;
  foreground: string;
};

function getBadgePalette(variant: BadgeVariant, colors: RubanColors): BadgePalette {
  if (variant === 'secondary') {
    return {
      background: colors.surfaceRaised,
      border: colors.border,
      foreground: colors.ink,
    };
  }

  if (variant === 'outline') {
    return {
      background: 'transparent',
      border: colors.borderStrong,
      foreground: colors.ink,
    };
  }

  if (variant === 'destructive') {
    return {
      background: colors.alert,
      border: colors.alert,
      foreground: colors.alertForeground,
    };
  }

  if (variant === 'live') {
    return {
      background: colors.successSoft,
      border: colors.success,
      foreground: colors.success,
    };
  }

  return {
    background: colors.accent,
    border: colors.accent,
    foreground: colors.inverse,
  };
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  style,
  textStyle,
  ...viewProps
}: BadgeProps): React.ReactElement {
  const colors = useRubanColors();
  const palette = getBadgePalette(variant, colors);

  return (
    <View
      {...viewProps}
      style={[
        styles.root,
        sizeStyles[size],
        {backgroundColor: palette.background, borderColor: palette.border},
        style,
      ]}>
      <Text
        numberOfLines={1}
        style={[styles.label, labelSizeStyles[size], {color: palette.foreground}, textStyle]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {fontWeight: '900', letterSpacing: 0.8},
});

const sizeStyles = StyleSheet.create({
  sm: {minHeight: 22, paddingHorizontal: 8},
  md: {minHeight: 28, paddingHorizontal: 10},
});

const labelSizeStyles = StyleSheet.create({
  sm: {fontSize: 8, lineHeight: 11},
  md: {fontSize: 9, lineHeight: 12},
});
