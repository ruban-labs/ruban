import * as React from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RubanThemeProvider, useRubanColors } from './src/design/tokens';
import AppNavigator from './src/navigation/AppNavigator';
import { useReleaseRuntimeHealth } from './src/releaseRuntime';
import {
  AppPreferencesProvider,
  useAppPreferences,
} from './src/settings/AppPreferences';
import { useBootSplashExit } from './src/startup/useBootSplashExit';
import { RubanSystemBars } from './src/system/RubanSystemBars';

enableScreens(true);

function AppSurface({ onReady }: { onReady: () => void }): React.ReactElement {
  const colors = useRubanColors();

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <RubanSystemBars mode={colors.mode} backgroundColor={colors.canvas} />
      <AppNavigator onReady={onReady} />
    </View>
  );
}

function ThemedApp(): React.ReactElement {
  const systemMode = useColorScheme();
  const { appearance } = useAppPreferences();
  const hideBootSplash = useBootSplashExit();
  const mode =
    appearance === 'system'
      ? systemMode === 'dark'
        ? 'dark'
        : 'light'
      : appearance;

  return (
    <RubanThemeProvider mode={mode}>
      <AppSurface onReady={hideBootSplash} />
    </RubanThemeProvider>
  );
}

function App(): React.ReactElement {
  useReleaseRuntimeHealth();

  return (
    <SafeAreaProvider>
      <AppPreferencesProvider>
        <ThemedApp />
      </AppPreferencesProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
