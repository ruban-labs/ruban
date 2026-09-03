import type * as React from 'react';
import type {StyleProp, ViewProps, ViewStyle} from 'react-native';

export type CollapsibleAlignment = 'top' | 'center' | 'bottom';
export type CollapsibleEasingName =
  | 'linear'
  | 'ease'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic';
export type CollapsibleEasing = CollapsibleEasingName | ((value: number) => number);

export interface CollapsibleProps extends Omit<ViewProps, 'style'> {
  children?: React.ReactNode;
  collapsed?: boolean;
  collapsedHeight?: number;
  duration?: number;
  easing?: CollapsibleEasing;
  align?: CollapsibleAlignment;
  onAnimationEnd?: () => void;
  renderChildrenCollapsed?: boolean;
  enablePointerEvents?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}
