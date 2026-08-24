import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { DEFAULT_COLOR } from './theme';
import type { ProgressDirection } from './types';

export interface CircleSnailProps {
  /** Run the animation. Default `true`. */
  animating?: boolean;
  /** Segment color, or a cycled color list. Default iOS system blue. */
  color?: string | string[];
  /** Comet sweep direction. Default `counter-clockwise` (like the original). */
  direction?: ProgressDirection;
  /** Duration of one comet grow/shrink phase in ms. Default `1000`. */
  duration?: number;
  /** Hide the whole component when not animating. Default `false`. */
  hidesWhenStopped?: boolean;
  /** Diameter. Default `40`. */
  size?: number;
  /** Duration of one full ring rotation in ms. Default `5000`. */
  spinDuration?: number;
  /** Ring thickness. Default `3`. */
  thickness?: number;
  /** Segment end shape. Default `round`. */
  strokeCap?: 'round' | 'butt' | 'square';
  /** Number of ring segments. Default derived from `size`. */
  segmentCount?: number;
  style?: object;
  children?: React.ReactNode;
  testID?: string;
}

const TWO_PI = Math.PI * 2;
const MIN_ARC_FRACTION = 0.02;
const MAX_ARC_FRACTION = 0.75;

/**
 * Indeterminate spinner: a rotating segmented ring with a comet that grows
 * and shrinks, optionally cycling through a color list. Dependency-free
 * refurbishment of the original SVG-based CircleSnail.
 */
export function CircleSnail({
  animating = true,
  color = DEFAULT_COLOR,
  direction = 'counter-clockwise',
  duration = 1000,
  hidesWhenStopped = false,
  size = 40,
  spinDuration = 5000,
  thickness = 3,
  strokeCap = 'round',
  segmentCount,
  style,
  children,
  testID,
}: CircleSnailProps): React.ReactElement | null {
  const [arcFraction, setArcFraction] = useState(MIN_ARC_FRACTION);
  const [colorIndex, setColorIndex] = useState(0);
  const arcValue = useRef<Animated.Value | null>(null);
  const spinValue = useRef<Animated.Value | null>(null);
  if (arcValue.current === null) {
    arcValue.current = new Animated.Value(MIN_ARC_FRACTION);
  }
  if (spinValue.current === null) {
    spinValue.current = new Animated.Value(0);
  }
  const arc = arcValue.current;
  const spin = spinValue.current;
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const listener = arc.addListener((event) => setArcFraction(event.value));
    return () => {
      mounted.current = false;
      arc.removeListener(listener);
      arc.stopAnimation();
      spin.stopAnimation();
    };
  }, [arc, spin]);

  useEffect(() => {
    if (!animating) {
      arc.stopAnimation();
      spin.stopAnimation();
      return;
    }
    let cancelled = false;
    let iteration = 0;
    const sweep = () => {
      if (cancelled || !mounted.current) {
        return;
      }
      Animated.sequence([
        Animated.timing(arc, {
          toValue: MAX_ARC_FRACTION,
          duration,
          isInteraction: false,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(arc, {
          toValue: MIN_ARC_FRACTION,
          duration,
          isInteraction: false,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]).start((endState) => {
        if (endState.finished) {
          iteration += 1;
          if (Array.isArray(color)) {
            setColorIndex(iteration % color.length);
          }
          sweep();
        }
      });
    };
    const rotate = () => {
      if (cancelled || !mounted.current) {
        return;
      }
      spin.setValue(0);
      Animated.timing(spin, {
        toValue: 1,
        duration: spinDuration,
        easing: Easing.linear,
        isInteraction: false,
        useNativeDriver: false,
      }).start((endState) => {
        if (endState.finished) {
          rotate();
        }
      });
    };
    sweep();
    rotate();
    return () => {
      cancelled = true;
    };
  }, [animating, duration, spinDuration, arc, spin, color]);

  if (!animating && hidesWhenStopped) {
    return null;
  }

  const colors = Array.isArray(color) ? color : [color];
  const candidateColor = colors[colorIndex % colors.length];
  const activeColor =
    candidateColor !== undefined ? candidateColor : DEFAULT_COLOR;
  const count =
    segmentCount !== undefined
      ? segmentCount
      : Math.max(16, Math.min(60, Math.round(size * 0.6)));
  const radius = size / 2 - thickness / 2;
  const litCount = Math.max(
    1,
    Math.round(
      (MIN_ARC_FRACTION +
        (MAX_ARC_FRACTION - MIN_ARC_FRACTION) *
          ((arcFraction - MIN_ARC_FRACTION) /
            (MAX_ARC_FRACTION - MIN_ARC_FRACTION))) *
        count
    )
  );
  const circumference = TWO_PI * radius;
  const segmentLength = Math.max(1.5, (circumference / count) * 0.66);
  const cornerRadius = strokeCap === 'round' ? thickness / 2 : 0;
  const rotationInterpolation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const segments = [];
  for (let index = 0; index < count; index += 1) {
    const fraction = index / count;
    const angle = direction === 'counter-clockwise' ? -fraction * 360 : fraction * 360;
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
          backgroundColor: index < litCount ? activeColor : 'transparent',
          transform: [{ rotate: `${angle}deg` }, { translateY: -radius }],
        }}
      />
    );
  }

  return (
    <View
      testID={testID}
      style={[{ width: size, height: size, backgroundColor: 'transparent' }, style]}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [{ rotate: rotationInterpolation }],
        }}
      >
        {segments}
      </Animated.View>
      {children}
    </View>
  );
}

export default CircleSnail;
