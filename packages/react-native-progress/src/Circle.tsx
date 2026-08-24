import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_COLOR, clampProgress } from './theme';
import { useAnimatedProgress } from './useAnimatedProgress';
import type { BaseProgressProps, CircleTextProps, RadialProgressStyleProps } from './types';

export interface CircleProps
  extends BaseProgressProps,
    RadialProgressStyleProps,
    CircleTextProps {
  /**
   * Fill color of the inner disk. Omit for a transparent center.
   */
  fill?: string;
  /**
   * Shape of the segment ends. Default `round`.
   */
  strokeCap?: 'round' | 'butt' | 'square';
  /**
   * Number of ring segments. Default derived from `size`.
   */
  segmentCount?: number;
  /**
   * Fraction of the ring present in indeterminate mode (the rest is the
   * traveling gap). Default `0.9`, matching the original.
   */
  endAngle?: number;
  testID?: string;
}

const TWO_PI = Math.PI * 2;

interface RingSpec {
  size: number;
  radius: number;
  thickness: number;
  segmentCount: number;
  visibleCount: number;
  litCount: number;
  litColor: string;
  unlitColor?: string;
  gapColor?: string;
  strokeCap: 'round' | 'butt' | 'square';
  direction: 'clockwise' | 'counter-clockwise';
}

/**
 * One segmented ring. Segments start at 12 o'clock and progress clockwise
 * (or counter-clockwise). Pure Views, no SVG.
 */
function SegmentRing({
  size,
  radius,
  thickness,
  segmentCount,
  visibleCount,
  litCount,
  litColor,
  unlitColor,
  strokeCap,
  direction,
}: RingSpec): React.ReactElement {
  const circumference = TWO_PI * radius;
  const slotLength = circumference / segmentCount;
  const segmentLength = Math.max(1.5, slotLength * 0.66);
  const cornerRadius = strokeCap === 'round' ? thickness / 2 : 0;

  const segments = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const fraction = index / segmentCount;
    const angle =
      direction === 'counter-clockwise'
        ? -fraction * 360
        : fraction * 360;
    const visible = index < visibleCount;
    const lit = index < litCount;
    const backgroundColor = !visible
      ? 'transparent'
      : lit
        ? litColor
        : (unlitColor || 'transparent');
    segments.push(
      <View
        key={index}
        style={{
          position: 'absolute',
          left: size / 2 - segmentLength / 2,
          top: size / 2 - thickness / 2,
          width: segmentLength,
          height: thickness,
          borderRadius: cornerRadius,
          backgroundColor,
          transform: [{ rotate: `${angle}deg` }, { translateY: -radius }],
        }}
      />
    );
  }
  return <View style={{ width: size, height: size }}>{segments}</View>;
}

/**
 * Circular progress ring built from discrete segments.
 *
 * The original `react-native-progress` Circle draws a smooth SVG arc. This
 * refurbishment intentionally renders a segmented ring instead: it keeps the
 * library dependency-free (no `react-native-svg`) and preserves the
 * transparent center, at the cost of the exact smooth-arc look. Use
 * `segmentCount` to tune density.
 */
export function Circle({
  animated = true,
  allowFontScaling = true,
  borderColor,
  borderWidth = 1,
  color = DEFAULT_COLOR,
  children,
  direction = 'clockwise',
  endAngle = 0.9,
  fill,
  formatText = (value: number) => `${Math.round(value * 100)}%`,
  indeterminate = false,
  indeterminateAnimationDuration = 1000,
  progress = 0,
  segmentCount,
  showsText = false,
  size = 40,
  strokeCap = 'round',
  style,
  textStyle,
  thickness = 3,
  unfilledColor,
  testID,
}: CircleProps): React.ReactElement {
  const { progress: progressAnim, rotation } = useAnimatedProgress({
    progress,
    animated,
    indeterminate,
    indeterminateProgress: clampProgress(endAngle),
    indeterminateAnimationDuration,
    direction,
  });

  const [displayProgress, setDisplayProgress] = useState(() =>
    indeterminate ? clampProgress(endAngle) : clampProgress(progress)
  );
  const displayRef = useRef(displayProgress);
  useEffect(() => {
    const listener = progressAnim.addListener((event) => {
      if (Math.abs(event.value - displayRef.current) < 0.0005) {
        return;
      }
      displayRef.current = event.value;
      setDisplayProgress(event.value);
    });
    return () => progressAnim.removeListener(listener);
  }, [progressAnim]);
  useEffect(() => {
    const target = indeterminate ? clampProgress(endAngle) : clampProgress(progress);
    displayRef.current = target;
    if (!animated) {
      setDisplayProgress(target);
    }
  }, [progress, indeterminate, endAngle, animated]);

  const count =
    segmentCount !== undefined
      ? segmentCount
      : Math.max(16, Math.min(60, Math.round(size * 0.6)));
  const border = borderWidth || (indeterminate ? 1 : 0);
  const ringRadius = size / 2 - border - thickness / 2;
  const visibleCount = indeterminate
    ? Math.round(clampProgress(endAngle) * count)
    : count;
  const litCount = indeterminate
    ? visibleCount
    : Math.round(clampProgress(displayProgress) * count);

  const rotationInterpolation = rotation.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-360deg', '0deg', '360deg'],
  });

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
          transform: indeterminate ? [{ rotate: rotationInterpolation }] : [],
        }}
      >
        {fill ? (
          <View
            style={{
              position: 'absolute',
              left: border + thickness,
              top: border + thickness,
              width: size - (border + thickness) * 2,
              height: size - (border + thickness) * 2,
              borderRadius: (size - (border + thickness) * 2) / 2,
              backgroundColor: fill,
            }}
          />
        ) : null}
        <SegmentRing
          size={size}
          radius={ringRadius}
          thickness={thickness}
          segmentCount={count}
          visibleCount={visibleCount}
          litCount={litCount}
          litColor={color}
          unlitColor={indeterminate ? undefined : unfilledColor}
          strokeCap={strokeCap}
          direction={direction}
        />
        {border > 0 ? (
          <View
            style={{
              position: 'absolute',
              left: border / 2,
              top: border / 2,
              width: size - border,
              height: size - border,
              borderRadius: (size - border) / 2,
              borderWidth: border,
              borderColor: borderColor !== undefined ? borderColor : color,
            }}
          />
        ) : null}
      </Animated.View>
      {showsText && !indeterminate ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text
              allowFontScaling={allowFontScaling}
              style={[{ fontSize: Math.max(10, size * 0.25), color }, textStyle]}
            >
              {formatText(clampProgress(displayProgress))}
            </Text>
          </View>
        </View>
      ) : null}
      {children}
    </View>
  );
}

export default Circle;
