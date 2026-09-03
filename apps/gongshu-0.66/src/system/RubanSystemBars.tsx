import * as React from 'react';
import {NativeModules, Platform, processColor, StatusBar} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {RubanThemeMode} from '../design/theme-colors';

type SystemBarEntry = {
  mode: RubanThemeMode;
  backgroundColor: string;
};

type RubanSystemBarsProps = SystemBarEntry;

type RubanSystemBarsNativeModule = {
  setStyle(darkContent: boolean, backgroundColor: number): void;
};

const nativeSystemBars = NativeModules.RubanSystemBars as
  | RubanSystemBarsNativeModule
  | undefined;
const entries: SystemBarEntry[] = [];

function applyEntry(entry: SystemBarEntry): void {
  const darkContent = entry.mode === 'light';
  StatusBar.setBarStyle(darkContent ? 'dark-content' : 'light-content', true);
  if (Platform.OS === 'android') {
    const backgroundColor = processColor(entry.backgroundColor);
    if (typeof backgroundColor === 'number') {
      nativeSystemBars?.setStyle(darkContent, backgroundColor);
    }
  }
}

function pushEntry(entry: SystemBarEntry): SystemBarEntry {
  entries.push(entry);
  applyEntry(entry);
  return entry;
}

function popEntry(entry: SystemBarEntry): void {
  const index = entries.indexOf(entry);
  if (index !== -1) {
    entries.splice(index, 1);
  }
  const currentEntry = entries[entries.length - 1];
  if (currentEntry) {
    applyEntry(currentEntry);
  }
}

export function RubanSystemBars({
  mode,
  backgroundColor,
}: RubanSystemBarsProps): null {
  React.useEffect(() => {
    const entry = pushEntry({mode, backgroundColor});
    return () => popEntry(entry);
  }, [backgroundColor, mode]);

  return null;
}

export function useFocusedRubanSystemBars(
  mode: RubanThemeMode,
  backgroundColor: string,
): void {
  useFocusEffect(
    React.useCallback(() => {
      const entry = pushEntry({mode, backgroundColor});
      return () => popEntry(entry);
    }, [backgroundColor, mode]),
  );
}
