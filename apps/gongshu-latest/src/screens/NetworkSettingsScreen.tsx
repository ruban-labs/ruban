import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackIcon } from '@ruban-labs/react-native-ui-icons';
import * as React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { chainRegistry } from '../chains/chainRegistry';
import { RubanScreen } from '../components/RubanPrimitives';
import { spacing, useRubanColors } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NetworkSettings'>;

export default function NetworkSettingsScreen({
  navigation,
}: Props): React.ReactElement {
  const colors = useRubanColors();

  return (
    <RubanScreen testID="screen-network-settings">
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={navigation.goBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed ? styles.pressed : undefined,
          ]}
        >
          <BackIcon size={28} color={colors.ink} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>
          Networks
        </Text>
      </View>

      <View style={styles.list}>
        {chainRegistry.map(entry => {
          const logo = colors.mode === 'dark' ? entry.whiteLogo : entry.logo;

          return (
            <View
              key={entry.chain.id}
              testID={`network-rpc-${entry.chain.id}`}
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.chainRow}>
                <Image source={logo} resizeMode="contain" style={styles.logo} />
                <View style={styles.identity}>
                  <Text style={[styles.chainName, { color: colors.ink }]}>
                    {entry.displayName}
                  </Text>
                  <Text style={[styles.chainMeta, { color: colors.faint }]}>
                    {entry.nativeSymbol} · CHAIN {entry.chain.id}
                  </Text>
                </View>
              </View>
              <View
                style={[styles.rpc, { backgroundColor: colors.choiceSurface }]}
              >
                <Text
                  selectable
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  style={[styles.rpcUrl, { color: colors.muted }]}
                >
                  {entry.primaryRpcUrl}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </RubanScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  headerTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.45,
  },
  list: { marginTop: spacing.lg },
  card: {
    marginBottom: spacing.md,
    padding: 14,
    borderWidth: 1,
  },
  chainRow: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 38, height: 38, borderRadius: 19 },
  identity: { flex: 1, marginLeft: 12 },
  chainName: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  chainMeta: {
    marginTop: 2,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  rpc: {
    marginTop: 12,
    minHeight: 38,
    paddingHorizontal: 11,
    justifyContent: 'center',
  },
  rpcUrl: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
  pressed: { opacity: 0.62 },
});
