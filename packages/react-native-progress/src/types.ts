import type { StyleProp, ViewStyle, TextProps } from 'react-native';

export type ProgressDirection = 'clockwise' | 'counter-clockwise';

export interface ProgressAnimationProps {
  /** Animate progress changes instead of jumping to them. Default `true`. */
  animated?: boolean;
  /** Show an endless animation instead of a fixed progress value. */
  indeterminate?: boolean;
  /** Duration in ms of one indeterminate loop. Default `1000`. */
  indeterminateAnimationDuration?: number;
}

export interface RadialProgressStyleProps {
  /** Diameter of the component. Default `40`. */
  size?: number;
  /** Progress arc/ring thickness. Default `3`. */
  thickness?: number;
  /** Filled color of the progress arc. Default iOS system blue. */
  color?: string;
  /** Color of the unfilled track. Omit for a transparent track. */
  unfilledColor?: string;
  /** Width of the outer border ring. Default `1`. */
  borderWidth?: number;
  /** Color of the outer border ring. Defaults to `color`. */
  borderColor?: string;
}

export interface CircleTextProps {
  /** Render the current progress as text in the center. Default `false`. */
  showsText?: boolean;
  /** Format the centered text. Default renders `NN%`. */
  formatText?: (progress: number) => string;
  /** Style of the centered text. */
  textStyle?: StyleProp<TextProps['style']>;
  /** Allow font scaling for the centered text. Default `true`. */
  allowFontScaling?: boolean;
}

export interface BaseProgressProps extends ProgressAnimationProps {
  /** Current progress between 0 and 1. Default `0`. */
  progress?: number;
  /** Sweep direction for radial components. Default `clockwise`. */
  direction?: ProgressDirection;
  /** Extra styles for the outer container. */
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}
