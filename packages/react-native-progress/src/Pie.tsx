import React from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import { DEFAULT_COLOR } from './theme';
import { useAnimatedProgress } from './useAnimatedProgress';
import type { BaseProgressProps } from './types';

export interface PieProps extends BaseProgressProps {
  /** Diameter of the pie. Default `40`. */
  size?: number;
  /** Fill color of the sector. Default iOS system blue. */
  color?: string;
  /** Color of the full disk below the sector. Omit for transparent. */
  unfilledColor?: string;
  /** Width of the outer border ring. Default `1`. */
  borderWidth?: number;
  /** Color of the outer border ring. Defaults to `color`. */
  borderColor?: string;
}

/**
 * Pie-style progress: a filled sector sweeping clockwise from 12 o'clock.
 *
 * Implemented with clipped rotating half-disks only - no SVG, no ART, zero
 * runtime dependencies, transparent background preserved.
 */
export function Pie({
  animated = true,
  borderColor,
  borderWidth = 1,
  color = DEFAULT_COLOR,
  children,
  direction = 'clockwise',
  indeterminate = false,
  indeterminateAnimationDuration = 1000,
  progress = 0,
  size = 40,
  style,
  unfilledColor,
  testID,
}: PieProps & { testID?: string }): React.ReactElement {
  const { progress: progressAnim, rotation } = useAnimatedProgress({
    progress,
    animated,
    indeterminate,
    indeterminateProgress: 0.2,
    indeterminateAnimationDuration,
    direction,
  });

  const sweepRight = progressAnim.interpolate({
    inputRange: [0, 0.5],
    outputRange: ['0deg', '180deg'],
    extrapolate: 'clamp',
  });
  const sweepLeft = progressAnim.interpolate({
    inputRange: [0.5, 1],
    outputRange: ['0deg', '180deg'],
    extrapolate: 'clamp',
  });
  const halfFillOpacity = progressAnim.interpolate({
    inputRange: [0.4999, 0.5],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const rotationInterpolation = rotation.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-360deg', '0deg', '360deg'],
  });

  const half = size / 2;
  const halfDiskBase = {
    position: 'absolute' as const,
    top: 0,
    width: half,
    height: size,
    backgroundColor: color,
  };
  const leftHalfDisk = {
    ...halfDiskBase,
    left: 0,
    borderTopLeftRadius: half,
    borderBottomLeftRadius: half,
  };
  const rightHalfDisk = {
    ...halfDiskBase,
    left: half,
    borderTopRightRadius: half,
    borderBottomRightRadius: half,
  };
  const windowBase = {
    position: 'absolute' as const,
    top: 0,
    width: half,
    height: size,
    overflow: 'hidden' as const,
  };
  const rotatorBase = {
    position: 'absolute' as const,
    top: 0,
    width: size,
    height: size,
  };

  return (
    <View
      testID={testID}
      style={[
        { width: size, height: size, backgroundColor: 'transparent' },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: half,
          overflow: 'hidden',
          transform: [{ rotate: rotationInterpolation }],
        }}
      >
        {unfilledColor ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: size,
              height: size,
              borderRadius: half,
              backgroundColor: unfilledColor,
            }}
          />
        ) : null}
        <View
          style={
            direction === 'counter-clockwise'
              ? { width: size, height: size, transform: [{ scaleX: -1 }] }
              : { width: size, height: size }
          }
        >
          {/* Phase 1: left half-disk rotates into the right window (0..50%). */}
          <View style={[windowBase, { left: half }]}>
            <Animated.View
              style={[
                rotatorBase,
                { left: -half, transform: [{ rotate: sweepRight }] },
              ]}
            >
              <View style={leftHalfDisk} />
            </Animated.View>
          </View>
          {/* Solid right half shown from 50% on. */}
          <View style={[windowBase, { left: half }]}>
            <Animated.View
              style={[
                halfDiskBase,
                {
                  left: 0,
                  borderTopRightRadius: half,
                  borderBottomRightRadius: half,
                  opacity: halfFillOpacity,
                },
              ]}
            />
          </View>
          {/* Phase 2: right half-disk rotates into the left window (50..100%). */}
          <View style={[windowBase, { left: 0 }]}>
            <Animated.View
              style={[rotatorBase, { left: 0, transform: [{ rotate: sweepLeft }] }]}
            >
              <View style={rightHalfDisk} />
            </Animated.View>
          </View>
        </View>
      </Animated.View>
      {borderWidth > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: borderWidth / 2,
            left: borderWidth / 2,
            width: size - borderWidth,
            height: size - borderWidth,
            borderRadius: (size - borderWidth) / 2,
            borderWidth,
            borderColor: borderColor !== undefined ? borderColor : color,
          }}
        />
      ) : null}
      {children}
    </View>
  );
}

export default Pie;
