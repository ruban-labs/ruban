import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackIcon } from '@ruban-labs/react-native-ui-icons';
import * as React from 'react';
import {
  Alert,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { runUiAppIntent } from '../application/AppIntentRuntime';
import { RubanScreen } from '../components/RubanPrimitives';
import { useDataEngine } from '../data/DataEngineContext';
import { spacing, useRubanColors } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DataSource'>;

export default function DataSourceScreen({
  navigation,
}: Props): React.ReactElement {
  const colors = useRubanColors();
  const engine = useDataEngine();
  const [accessKey, setAccessKey] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const configured = engine.source?.credentialState === 'configured';

  React.useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') setAccessKey('');
    });
    return () => listener.remove();
  }, []);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    try {
      await operation();
    } catch {
      Alert.alert(
        'Data source',
        'Could not complete this action. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  const button = (label: string, onPress: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy || disabled }}
      disabled={busy || disabled}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: colors.choiceSurface,
          opacity: busy || disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );

  return (
    <RubanScreen
      testID="screen-data-source"
      scrollProps={{ keyboardShouldPersistTaps: 'handled' }}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={navigation.goBack}
          style={styles.back}
        >
          <BackIcon size={28} color={colors.ink} />
        </Pressable>
        <Text style={[styles.title, { color: colors.ink }]}>Data source</Text>
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.ink }]}>DeBank Cloud</Text>
        <Text style={[styles.note, { color: colors.muted }]}>
          {configured
            ? 'Key saved on this device. Refresh uses your DeBank units.'
            : 'Use your own key to refresh real addresses. DeBank charges for API usage.'}
        </Text>
        <TextInput
          testID="debank-access-key"
          accessibilityLabel="DeBank AccessKey"
          value={accessKey}
          onChangeText={setAccessKey}
          secureTextEntry
          autoCorrect={false}
          autoCapitalize="none"
          autoComplete="off"
          textContentType="none"
          maxLength={4096}
          placeholder={configured ? 'Replace AccessKey' : 'AccessKey'}
          placeholderTextColor={colors.faint}
          editable={!busy}
          style={[
            styles.input,
            { color: colors.ink, borderColor: colors.border },
          ]}
        />
        {button(
          'Save key',
          () => {
            const value = accessKey;
            setAccessKey('');
            void run(async () => {
              await runUiAppIntent({
                action: 'data-source.import-key',
                accessKey: value,
              });
              await engine.refreshSource();
            });
          },
          !accessKey.trim(),
        )}
        {configured
          ? button('Remove key', () =>
              Alert.alert(
                'Remove key?',
                'Cached portfolios stay on this device.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () =>
                      void run(async () => {
                        await runUiAppIntent({
                          action: 'data-source.clear-key',
                        });
                        await engine.refreshSource();
                      }),
                  },
                ],
              ),
            )
          : null}
        {button(
          'Get a DeBank key ↗',
          () =>
            void run(async () => {
              await Linking.openURL('https://cloud.debank.com/');
            }),
        )}
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.ink }]}>
          Example portfolio
        </Text>
        <Text style={[styles.note, { color: colors.muted }]}>
          Sample balances. No key or API units required.
        </Text>
        {button(
          'Try example',
          () =>
            void run(async () => {
              await runUiAppIntent({ action: 'wallet.open-demo' });
              navigation.navigate('Main', { screen: 'Home' });
            }),
        )}
      </View>
    </RubanScreen>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  back: {
    position: 'absolute',
    left: 0,
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800' },
  card: { padding: spacing.md, marginTop: spacing.lg },
  note: { marginVertical: spacing.md, fontSize: 14, lineHeight: 20 },
  input: { minHeight: 48, borderWidth: 1, paddingHorizontal: spacing.md },
  button: {
    minHeight: 44,
    marginTop: spacing.sm,
    padding: spacing.md,
    justifyContent: 'center',
  },
  label: { fontSize: 15, fontWeight: '600' },
});
