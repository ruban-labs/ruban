import * as React from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {radius, useRubanColors} from '../../design/tokens';

export const switchSizes = ['sm', 'md'] as const;
export type SwitchSize = (typeof switchSizes)[number];

export type SwitchProps = Omit<PressableProps, 'children' | 'onPress'> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: SwitchSize;
};

const switchMetrics = {
  sm: {trackWidth: 48, trackHeight: 26, thumbSize: 20, inset: 3, travel: 22},
  md: {trackWidth: 56, trackHeight: 32, thumbSize: 26, inset: 3, travel: 24},
} as const;

function resolveExternalStyle(
  style: PressableProps['style'],
  state: PressableStateCallbackType
): StyleProp<ViewStyle> {
  return typeof style === 'function' ? style(state) : style;
}

export function Switch({
  checked,
  onCheckedChange,
  size = 'md',
  disabled = false,
  accessibilityRole,
  accessibilityState,
  hitSlop,
  style,
  ...pressableProps
}: SwitchProps): React.ReactElement {
  const colors = useRubanColors();
  const metrics = switchMetrics[size];
  const inactive = disabled === true;
  const progress = React.useRef(new Animated.Value(checked ? 1 : 0)).current;

  React.useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: checked ? 1 : 0,
      duration: 140,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [checked, progress]);

  return (
    <Pressable
      {...pressableProps}
      accessibilityRole={accessibilityRole ?? 'switch'}
      accessibilityState={{...accessibilityState, checked, disabled: inactive}}
      disabled={inactive}
      hitSlop={hitSlop ?? 6}
      onPress={() => onCheckedChange?.(!checked)}
      style={state => [
        styles.root,
        {width: metrics.trackWidth, minHeight: 44},
        inactive ? styles.disabled : undefined,
        resolveExternalStyle(style, state),
      ]}>
      {({pressed}) => (
        <View
          style={[
            styles.track,
            {
              width: metrics.trackWidth,
              height: metrics.trackHeight,
              padding: metrics.inset,
              backgroundColor: checked ? colors.accent : colors.surfaceRaised,
              borderColor: checked ? colors.accent : colors.borderStrong,
            },
            pressed ? styles.pressed : undefined,
          ]}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                width: metrics.thumbSize,
                height: metrics.thumbSize,
                backgroundColor: checked ? colors.inverse : colors.ink,
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, metrics.travel],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {alignItems: 'center', justifyContent: 'center'},
  track: {borderWidth: 1, borderRadius: radius.md, justifyContent: 'center'},
  thumb: {borderRadius: radius.sm},
  pressed: {opacity: 0.78},
  disabled: {opacity: 0.38},
});
