import * as React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NavigationBar } from '@zoontek/react-native-navigation-bar';
import { StatusBar } from 'react-native';
import type { RubanThemeMode } from '../design/theme-colors';

type Props = {
  mode: RubanThemeMode;
  backgroundColor: string;
};

function toBarStyle(
  mode: RubanThemeMode,
): 'light-content' | 'dark-content' {
  return mode === 'dark' ? 'light-content' : 'dark-content';
}

export function RubanSystemBars({ mode }: Props): React.ReactElement {
  const barStyle = toBarStyle(mode);
  return (
    <>
      <StatusBar barStyle={barStyle} />
      <NavigationBar barStyle={barStyle} />
    </>
  );
}

export function useFocusedRubanSystemBars(
  mode: RubanThemeMode,
  _backgroundColor: string,
): void {
  useFocusEffect(
    React.useCallback(() => {
      const barStyle = toBarStyle(mode);
      const statusBarEntry = StatusBar.pushStackEntry({ barStyle });
      const navigationBarEntry = NavigationBar.pushStackEntry({ barStyle });
      return () => {
        StatusBar.popStackEntry(statusBarEntry);
        NavigationBar.popStackEntry(navigationBarEntry);
      };
    }, [mode]),
  );
}
