import * as React from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  StyleSheet,
} from 'react-native';
import type {CollapsibleEasing, CollapsibleProps} from './types';

const easingFunctions = {
  linear: Easing.linear,
  ease: Easing.ease,
  easeInCubic: Easing.in(Easing.cubic),
  easeOutCubic: Easing.out(Easing.cubic),
  easeInOutCubic: Easing.inOut(Easing.cubic),
} as const;

function resolveEasing(easing: CollapsibleEasing): (value: number) => number {
  return typeof easing === 'function' ? easing : easingFunctions[easing];
}

export function Collapsible({
  children,
  collapsed = true,
  collapsedHeight = 0,
  duration = 300,
  easing = 'easeOutCubic',
  align = 'top',
  onAnimationEnd,
  renderChildrenCollapsed = true,
  enablePointerEvents = false,
  style,
  contentContainerStyle,
  testID,
  pointerEvents,
  accessibilityElementsHidden,
  importantForAccessibility,
  ...viewProps
}: CollapsibleProps): React.ReactElement {
  const safeCollapsedHeight = Math.max(0, collapsedHeight);
  const animatedHeight = React.useRef(new Animated.Value(safeCollapsedHeight)).current;
  const previousCollapsed = React.useRef(collapsed);
  const animationToken = React.useRef(0);
  const targetHeight = React.useRef(safeCollapsedHeight);
  const mounted = React.useRef(true);
  const [measuredHeight, setMeasuredHeight] = React.useState<number | null>(null);
  const [animating, setAnimating] = React.useState(false);
  const [measuringBeforeOpen, setMeasuringBeforeOpen] = React.useState(false);

  React.useEffect(
    () => () => {
      mounted.current = false;
      animationToken.current += 1;
      animatedHeight.stopAnimation();
    },
    [animatedHeight],
  );

  const animateTo = React.useCallback(
    (nextHeight: number, notify = true) => {
      const nextToken = animationToken.current + 1;
      animationToken.current = nextToken;
      targetHeight.current = nextHeight;
      setAnimating(true);

      animatedHeight.stopAnimation(() => {
        if (duration <= 0) {
          animatedHeight.setValue(nextHeight);
          if (mounted.current && animationToken.current === nextToken) {
            setAnimating(false);
            if (notify && onAnimationEnd) onAnimationEnd();
          }
          return;
        }

        Animated.timing(animatedHeight, {
          toValue: nextHeight,
          duration,
          easing: resolveEasing(easing),
          useNativeDriver: false,
        }).start(({finished}) => {
          if (!mounted.current || animationToken.current !== nextToken) return;
          setAnimating(false);
          if (finished && notify && onAnimationEnd) onAnimationEnd();
        });
      });
    },
    [animatedHeight, duration, easing, onAnimationEnd],
  );

  React.useEffect(() => {
    if (previousCollapsed.current === collapsed) return;
    previousCollapsed.current = collapsed;

    if (collapsed) {
      setMeasuringBeforeOpen(false);
      animateTo(safeCollapsedHeight);
      return;
    }

    if (measuredHeight == null) {
      setMeasuringBeforeOpen(true);
      setAnimating(true);
      return;
    }

    animateTo(Math.max(safeCollapsedHeight, measuredHeight));
  }, [animateTo, collapsed, measuredHeight, safeCollapsedHeight]);

  React.useEffect(() => {
    if (collapsed && !animating) animatedHeight.setValue(safeCollapsedHeight);
  }, [animatedHeight, animating, collapsed, safeCollapsedHeight]);

  const handleContentLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const layoutHeight = event.nativeEvent.layout.height;
      if (
        collapsed &&
        measuredHeight != null &&
        measuredHeight > safeCollapsedHeight &&
        layoutHeight <= safeCollapsedHeight
      ) {
        return;
      }

      const nextHeight = Math.max(safeCollapsedHeight, layoutHeight);
      const changed = measuredHeight !== nextHeight;
      if (changed) setMeasuredHeight(nextHeight);

      if (measuringBeforeOpen && !collapsed) {
        setMeasuringBeforeOpen(false);
        animateTo(nextHeight);
        return;
      }

      if (!collapsed && !animating) {
        targetHeight.current = nextHeight;
        animatedHeight.setValue(nextHeight);
        return;
      }

      if (!collapsed && animating && changed && targetHeight.current !== nextHeight) {
        animateTo(nextHeight, false);
      }
    },
    [
      animateTo,
      animatedHeight,
      animating,
      collapsed,
      measuredHeight,
      measuringBeforeOpen,
      safeCollapsedHeight,
    ],
  );

  const fullyCollapsed = collapsed && !animating;
  const openingNeedsMeasurement =
    !collapsed && previousCollapsed.current && measuredHeight == null;
  const shouldRenderChildren = renderChildrenCollapsed || !fullyCollapsed;
  const shouldControlHeight =
    collapsed ||
    measuredHeight != null ||
    measuringBeforeOpen ||
    openingNeedsMeasurement ||
    animating;
  const measuredValue = measuredHeight == null ? safeCollapsedHeight : measuredHeight;
  const heightDifference = Animated.subtract(animatedHeight, measuredValue);
  const translateY = align === 'bottom'
    ? heightDifference
    : align === 'center'
      ? Animated.divide(heightDifference, 2)
      : 0;

  return (
    <Animated.View
      {...viewProps}
      testID={testID}
      pointerEvents={fullyCollapsed && !enablePointerEvents ? 'none' : pointerEvents}
      accessibilityElementsHidden={fullyCollapsed ? true : accessibilityElementsHidden}
      importantForAccessibility={fullyCollapsed ? 'no-hide-descendants' : importantForAccessibility}
      style={[
        styles.container,
        style,
        shouldControlHeight ? {height: animatedHeight} : undefined,
      ]}>
      {shouldRenderChildren ? (
        <Animated.View
          testID={testID ? `${testID}-content` : undefined}
          onLayout={handleContentLayout}
          style={[
            contentContainerStyle,
            shouldControlHeight ? styles.measuredContent : undefined,
            align === 'top' ? undefined : {transform: [{translateY}]},
          ]}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {overflow: 'hidden'},
  measuredContent: {position: 'absolute', top: 0, left: 0, right: 0},
});

export default Collapsible;
