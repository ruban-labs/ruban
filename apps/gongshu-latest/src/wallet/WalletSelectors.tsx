import type { WalletAccount } from '@ruban-labs/react-native-wallet-core';
import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheetModal } from '../components/ui/BottomSheetModal';
import { SelectionMark } from '../components/ui/SelectionMark';
import { spacing, useRubanColors } from '../design/tokens';

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
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
      showHeader={false}
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
                selected ? { backgroundColor: colors.accentSoft } : undefined,
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
  pressed: { opacity: 0.62 },
});
