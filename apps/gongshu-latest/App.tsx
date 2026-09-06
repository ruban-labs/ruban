import * as React from 'react';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OverlayProvider } from '@ruban-labs/react-native-ui-overlay';
import { DataEngineProvider } from './src/data/DataEngineContext';
import { AppIntentRuntime } from './src/application/AppIntentRuntime';
import { RpcRequestReviewProvider } from './src/dapp/RpcRequestReviewProvider';
import { RubanThemeProvider, useRubanColors } from './src/design/tokens';
import AppNavigator from './src/navigation/AppNavigator';
import { useReleaseRuntimeHealth } from './src/releaseRuntime';
import {
  AppPreferencesProvider,
  useAppPreferences,
} from './src/settings/AppPreferences';
import { useBootSplashExit } from './src/startup/useBootSplashExit';
import { RubanSystemBars } from './src/system/RubanSystemBars';
import { WalletProvider } from './src/wallet/WalletContext';

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
      <OverlayProvider>
        <RpcRequestReviewProvider>
          <AppSurface onReady={hideBootSplash} />
        </RpcRequestReviewProvider>
      </OverlayProvider>
    </RubanThemeProvider>
  );
}

function App(): React.ReactElement {
  useReleaseRuntimeHealth();

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <AppPreferencesProvider>
            <DataEngineProvider>
              <WalletProvider>
                <AppIntentRuntime />
                <ThemedApp />
              </WalletProvider>
            </DataEngineProvider>
          </AppPreferencesProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
