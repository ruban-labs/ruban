import * as React from 'react';
import {useColorScheme} from 'react-native';
import {enableScreens} from 'react-native-screens';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {RubanThemeProvider} from './src/design/tokens';
import AppNavigator from './src/navigation/AppNavigator';
import {useReleaseRuntimeHealth} from './src/releaseRuntime';
import {AppPreferencesProvider, useAppPreferences} from './src/settings/AppPreferences';

enableScreens(true);

function ThemedApp(): React.ReactElement {
  const systemMode = useColorScheme();
  const {appearance} = useAppPreferences();
  const mode = appearance === 'system' ? (systemMode === 'dark' ? 'dark' : 'light') : appearance;

  return (
    <RubanThemeProvider mode={mode}>
      <AppNavigator />
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

export default App;
