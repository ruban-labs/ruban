import * as React from 'react';
import {StyleSheet, useColorScheme, View} from 'react-native';
import {enableScreens} from 'react-native-screens';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {RubanThemeProvider} from './src/design/tokens';
import AppNavigator from './src/navigation/AppNavigator';
import {useReleaseRuntimeHealth} from './src/releaseRuntime';
import {AppPreferencesProvider, useAppPreferences} from './src/settings/AppPreferences';
import {useBootSplashExit} from './src/startup/useBootSplashExit';

enableScreens(true);

function ThemedApp(): React.ReactElement {
  const systemMode = useColorScheme();
  const {appearance} = useAppPreferences();
  const hideBootSplash = useBootSplashExit();
  const mode = appearance === 'system' ? (systemMode === 'dark' ? 'dark' : 'light') : appearance;

  return (
    <RubanThemeProvider mode={mode}>
      <View style={styles.root}>
        <AppNavigator onReady={hideBootSplash} />
      </View>
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
  root: {flex: 1},
});

export default App;
