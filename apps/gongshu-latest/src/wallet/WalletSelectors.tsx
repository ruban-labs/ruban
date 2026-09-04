import { CheckIcon } from '@ruban-labs/react-native-ui-icons';
import type { WalletAccount } from '@ruban-labs/react-native-wallet-core';
import * as React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BottomSheetModal } from '../components/ui/BottomSheetModal';
import { spacing, useRubanColors } from '../design/tokens';
import type { PortfolioChainCatalogEntry } from '../portfolio/chainCatalog';

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function SelectionMark({
  selected,
}: {
  selected: boolean;
}): React.ReactElement {
  const colors = useRubanColors();

  return (
    <View
      style={[
        styles.selectionMark,
        {
          borderColor: selected ? colors.accent : colors.borderStrong,
          backgroundColor: selected ? colors.accent : 'transparent',
        },
      ]}
    >
      {selected ? <CheckIcon size={12} color={colors.canvas} /> : null}
    </View>
  );
}

export function ChainSelectorSheet({
  visible,
  chains,
  selectedChainId,
  onSelect,
  onDismiss,
}: {
  visible: boolean;
  chains: readonly PortfolioChainCatalogEntry[];
  selectedChainId: number;
  onSelect: (chainId: number) => void;
  onDismiss: () => void;
}): React.ReactElement {
  const colors = useRubanColors();

  return (
    <BottomSheetModal
      visible={visible}
      title="Select network"
      onDismiss={onDismiss}
      overlayId="wallet-chain-selector"
      testID="chain-selector-sheet"
    >
      <ScrollView contentContainerStyle={styles.list}>
        {chains.map(entry => {
          const selected = entry.chain.id === selectedChainId;
          const logo = colors.mode === 'dark' ? entry.whiteLogo : entry.logo;

          return (
            <Pressable
              key={entry.chain.id}
              testID={`chain-option-${entry.chain.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={entry.displayName}
              onPress={() => {
                onSelect(entry.chain.id);
                onDismiss();
              }}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: colors.border },
                selected
                  ? { backgroundColor: colors.navigationActive }
                  : undefined,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <View style={styles.chainLogoFrame}>
                <Image
                  source={logo}
                  resizeMode="contain"
                  style={styles.chainLogo}
                />
              </View>
              <View style={styles.identity}>
                <Text style={[styles.label, { color: colors.ink }]}>
                  {entry.displayName}
                </Text>
                <Text style={[styles.meta, { color: colors.faint }]}>
                  {entry.nativeSymbol} · CHAIN {entry.chain.id}
                </Text>
              </View>
              <SelectionMark selected={selected} />
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheetModal>
  );
}

export function AddressSelectorSheet({
  visible,
  accounts,
  selectedAccountId,
  onSelect,
  onDismiss,
}: {
  visible: boolean;
  accounts: readonly WalletAccount[];
  selectedAccountId: string | null;
  onSelect: (accountId: string) => void;
  onDismiss: () => void;
}): React.ReactElement {
  const colors = useRubanColors();

  return (
    <BottomSheetModal
      visible={visible}
      title="Select address"
      onDismiss={onDismiss}
      overlayId="wallet-address-selector"
      testID="address-selector-sheet"
    >
      <ScrollView contentContainerStyle={styles.list}>
        {accounts.map(account => {
          const selected = account.id === selectedAccountId;

          return (
            <Pressable
              key={account.id}
              testID={`address-option-${account.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${account.label}, ${account.address}`}
              onPress={() => {
                onSelect(account.id);
                onDismiss();
              }}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: colors.border },
                selected
                  ? { backgroundColor: colors.navigationActive }
                  : undefined,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <View
                style={[
                  styles.addressMark,
                  { backgroundColor: colors.accentSoft },
                ]}
              >
                <Text
                  style={[styles.addressMarkText, { color: colors.accent }]}
                >
                  {account.address.slice(2, 4).toUpperCase()}
                </Text>
              </View>
              <View style={styles.identity}>
                <Text style={[styles.label, { color: colors.ink }]}>
                  {account.label}
                </Text>
                <Text style={[styles.address, { color: colors.faint }]}>
                  {shortAddress(account.address)}
                </Text>
              </View>
              <SelectionMark selected={selected} />
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.sm },
  row: {
    minHeight: 78,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chainLogoFrame: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chainLogo: { width: 42, height: 42, borderRadius: 21 },
  addressMark: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressMarkText: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
  identity: { flex: 1, marginLeft: 13 },
  label: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  address: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  meta: {
    marginTop: 3,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 0.75,
  },
  selectionMark: {
    width: 18,
    height: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.62 },
});
