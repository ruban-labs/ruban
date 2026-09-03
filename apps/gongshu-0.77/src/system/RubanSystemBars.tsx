import * as React from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {SystemBars} from 'react-native-edge-to-edge';
import type {RubanThemeMode} from '../design/theme-colors';

type Props = {
  mode: RubanThemeMode;
  backgroundColor: string;
};

function toBarStyle(mode: RubanThemeMode): 'light' | 'dark' {
  return mode === 'dark' ? 'light' : 'dark';
}

export function RubanSystemBars({mode}: Props): React.ReactElement {
  return <SystemBars style={toBarStyle(mode)} />;
}

export function useFocusedRubanSystemBars(
  mode: RubanThemeMode,
  _backgroundColor: string,
): void {
  useFocusEffect(
    React.useCallback(() => {
      const entry = SystemBars.pushStackEntry({style: toBarStyle(mode)});
      return () => SystemBars.popStackEntry(entry);
    }, [mode]),
  );
}
