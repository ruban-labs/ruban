import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { clampProgress } from './theme';
import type { ProgressDirection } from './types';

export interface UseAnimatedProgressOptions {
  progress: number;
  animated: boolean;
  indeterminate: boolean;
  /** Fixed progress shown while indeterminate (e.g. Pie's 0.2 sliver). */
  indeterminateProgress?: number;
  indeterminateAnimationDuration: number;
  direction: ProgressDirection;
}

export interface AnimatedProgressControls {
  /** Animated progress value in [0, 1]. */
  progress: Animated.Value;
  /** Animated rotation value; one loop goes from 0 to 1 (360deg). */
  rotation: Animated.Value;
}

/**
 * Hook replacement for the legacy `withAnimation` HOC. Drives an animated
 * progress value plus an indeterminate rotation loop. JS-driven on purpose
 * (as the original was) so it can feed render-time geometry.
 */
export function useAnimatedProgress({
  progress,
  animated,
  indeterminate,
  indeterminateProgress = 0,
  indeterminateAnimationDuration,
  direction,
}: UseAnimatedProgressOptions): AnimatedProgressControls {
  const progressRef = useRef<Animated.Value | null>(null);
  const rotationRef = useRef<Animated.Value | null>(null);
  if (progressRef.current === null) {
    progressRef.current = new Animated.Value(
      indeterminate ? indeterminateProgress : clampProgress(progress)
    );
  }
  if (rotationRef.current === null) {
    rotationRef.current = new Animated.Value(0);
  }
  const progressValue = progressRef.current;
  const rotationValue = rotationRef.current;

  const liveProgress = useRef(clampProgress(progress));
  const liveRotation = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const progressListener = progressValue.addListener((event) => {
      liveProgress.current = event.value;
    });
    const rotationListener = rotationValue.addListener((event) => {
      liveRotation.current = event.value;
    });
    return () => {
      mounted.current = false;
      progressValue.removeListener(progressListener);
      rotationValue.removeListener(rotationListener);
      progressValue.stopAnimation();
      rotationValue.stopAnimation();
    };
  }, [progressValue, rotationValue]);

  useEffect(() => {
    if (!indeterminate) {
      return;
    }
    let cancelled = false;
    const spin = () => {
      if (cancelled || !mounted.current) {
        return;
      }
      rotationValue.setValue(0);
      Animated.timing(rotationValue, {
        toValue: direction === 'counter-clockwise' ? -1 : 1,
        duration: indeterminateAnimationDuration,
        easing: Easing.linear,
        isInteraction: false,
        useNativeDriver: false,
      }).start((endState) => {
        if (endState.finished) {
          spin();
        }
      });
    };
    spin();
    return () => {
      cancelled = true;
      rotationValue.stopAnimation();
    };
  }, [indeterminate, direction, indeterminateAnimationDuration, rotationValue]);

  useEffect(() => {
    const target = indeterminate
      ? indeterminateProgress
      : clampProgress(progress);
    if (indeterminate && target === 0) {
      return;
    }
    if (target === liveProgress.current) {
      return;
    }
    if (animated) {
      Animated.spring(progressValue, {
        toValue: target,
        bounciness: 0,
        useNativeDriver: false,
      }).start();
    } else {
      progressValue.setValue(target);
    }
  }, [progress, indeterminate, indeterminateProgress, animated, progressValue]);

  return { progress: progressValue, rotation: rotationValue };
}
