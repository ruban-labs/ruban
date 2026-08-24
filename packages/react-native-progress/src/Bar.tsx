import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  I18nManager,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  BAR_WIDTH_ZERO_POSITION,
  DEFAULT_COLOR,
  INDETERMINATE_WIDTH_FACTOR,
  clampProgress,
} from './theme';

export interface BarProps {
  /** Animate progress changes. Default `true`. */
  animated?: boolean;
  /** Animation used for progress changes. Default `spring`. */
  animationType?: 'spring' | 'timing';
  /** Extra config passed to the progress animation. Default `{ bounciness: 0 }`. */
  animationConfig?: Record<string, unknown>;
  /** Border color of the track. Defaults to `color`. */
  borderColor?: string;
  /** Corner radius of the track. Default `4`. */
  borderRadius?: number;
  /** Border width of the track. Default `1`. */
  borderWidth?: number;
  /** Fill color of the bar. Default iOS system blue. */
  color?: string;
  /** Bar height. Default `6`. */
  height?: number;
  /** Endless traveling segment instead of fixed progress. Default `false`. */
  indeterminate?: boolean;
  /** Duration of one indeterminate loop in ms. Default `1000`. */
  indeterminateAnimationDuration?: number;
  /** Fixed bar width; omit to fill the laid-out container width. Default `150`. */
  width?: number;
  /** Current progress between 0 and 1. Default `0`. */
  progress?: number;
  /** Track background color. Omit for transparent. */
  unfilledColor?: string;
  /** Use the native animation driver. Default `false`. */
  useNativeDriver?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  testID?: string;
}

/**
 * Horizontal progress bar.
 *
 * Refurbished from `react-native-progress` (oblador) with an identical render
 * model and zero runtime dependencies.
 */
export function Bar({
  animated = true,
  animationType = 'spring',
  animationConfig = { bounciness: 0 },
  borderColor,
  borderRadius = 4,
  borderWidth = 1,
  color = DEFAULT_COLOR,
  height = 6,
  indeterminate = false,
  indeterminateAnimationDuration = 1000,
  width = 150,
  progress = 0,
  unfilledColor,
  useNativeDriver = false,
  onLayout,
  style,
  children,
  testID,
}: BarProps): React.ReactElement {
  const progressAnim = useRef<Animated.Value | null>(null);
  const travelAnim = useRef<Animated.Value | null>(null);
  if (progressAnim.current === null) {
    progressAnim.current = new Animated.Value(
      indeterminate ? INDETERMINATE_WIDTH_FACTOR : clampProgress(progress)
    );
  }
  if (travelAnim.current === null) {
    travelAnim.current = new Animated.Value(BAR_WIDTH_ZERO_POSITION);
  }
  const progressValue = progressAnim.current;
  const travelValue = travelAnim.current;

  const [layoutWidth, setLayoutWidth] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      progressValue.stopAnimation();
      travelValue.stopAnimation();
    };
  }, [progressValue, travelValue]);

  useEffect(() => {
    if (!indeterminate) {
      return;
    }
    let cancelled = false;
    const loop = () => {
      if (cancelled || !mounted.current) {
        return;
      }
      travelValue.setValue(0);
      Animated.timing(travelValue, {
        toValue: 1,
        duration: indeterminateAnimationDuration,
        easing: Easing.linear,
        isInteraction: false,
        useNativeDriver,
      }).start((endState) => {
        if (endState.finished) {
          loop();
        }
      });
    };
    loop();
    return () => {
      cancelled = true;
      travelValue.stopAnimation();
    };
  }, [indeterminate, indeterminateAnimationDuration, travelValue, useNativeDriver]);

  const previousIndeterminate = useRef(indeterminate);
  useEffect(() => {
    if (previousIndeterminate.current !== indeterminate && !indeterminate) {
      Animated.spring(travelValue, {
        toValue: BAR_WIDTH_ZERO_POSITION,
        useNativeDriver,
      }).start();
    }
    previousIndeterminate.current = indeterminate;

    const target = indeterminate
      ? INDETERMINATE_WIDTH_FACTOR
      : clampProgress(progress);
    if (animated) {
      const animation =
        animationType === 'timing' ? Animated.timing : Animated.spring;
      animation(progressValue, {
        ...animationConfig,
        toValue: target,
        useNativeDriver,
      } as Animated.TimingAnimationConfig).start();
    } else {
      progressValue.setValue(target);
    }
  }, [
    indeterminate,
    progress,
    animated,
    animationType,
    animationConfig,
    useNativeDriver,
    progressValue,
    travelValue,
  ]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!width) {
        setLayoutWidth(event.nativeEvent.layout.width);
      }
      if (onLayout) {
        onLayout(event);
      }
    },
    [width, onLayout]
  );

  const innerWidth = Math.max(0, width || layoutWidth) - borderWidth * 2;

  return (
    <View
      testID={testID}
      onLayout={handleLayout}
      style={[
        {
          width,
          borderWidth,
          borderColor: borderColor !== undefined ? borderColor : color,
          borderRadius,
          overflow: 'hidden',
          backgroundColor: unfilledColor,
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          backgroundColor: color,
          height,
          transform: [
            {
              translateX: travelValue.interpolate({
                inputRange: [0, 1],
                outputRange: [
                  innerWidth * -INDETERMINATE_WIDTH_FACTOR,
                  innerWidth,
                ],
              }),
            },
            {
              translateX: progressValue.interpolate({
                inputRange: [0, 1],
                outputRange: [innerWidth / (I18nManager.isRTL ? 2 : -2), 0],
              }),
            },
            {
              scaleX: progressValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.0001, 1],
              }),
            },
          ],
        }}
      />
      {children}
    </View>
  );
}

export default Bar;
