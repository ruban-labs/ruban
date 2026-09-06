import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModalRoot } from '../components/ui/BottomSheetModal';
import { SelectionMark } from '../components/ui/SelectionMark';
import { spacing, useRubanColors } from '../design/tokens';
import type { ChainRegistryEntry } from './chainRegistry';

export function ChainSelectorSheet({
  visible,
  chains,
  selectedChainId,
  onSelect,
  onDismiss,
}: {
  visible: boolean;
  chains: readonly ChainRegistryEntry[];
  selectedChainId: number;
  onSelect: (chainId: number) => void;
  onDismiss: () => void;
}): React.ReactElement {
  const colors = useRubanColors();
  const insets = useSafeAreaInsets();

  return (
    <BottomSheetModalRoot
      visible={visible}
      onDismiss={onDismiss}
      overlayId="chain-selector"
    >
      <BottomSheetScrollView
        testID="chain-selector-sheet"
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
      >
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
                selected ? { backgroundColor: colors.accentSoft } : undefined,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <View style={styles.logoFrame}>
                <Image source={logo} resizeMode="contain" style={styles.logo} />
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
      </BottomSheetScrollView>
    </BottomSheetModalRoot>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: spacing.xs },
  row: {
    minHeight: 78,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoFrame: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 42, height: 42, borderRadius: 21 },
  identity: { flex: 1, marginLeft: 13 },
  label: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  meta: {
    marginTop: 3,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 0.75,
  },
  pressed: { opacity: 0.62 },
});
