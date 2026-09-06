import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { PortfolioAsset } from '@ruban-labs/react-native-evm-client';
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getChainRegistryEntry } from '../chains/chainRegistry';
import { BottomSheetModalRoot } from '../components/ui/BottomSheetModal';
import { spacing, useRubanColors } from '../design/tokens';
import type { PortfolioProtocolPositionRow } from '../storage/entities';
import { formatUsd } from './presentation';
import { PortfolioIcon } from './TokenIcon';

export type PortfolioItemSelection =
  | { kind: 'asset'; asset: PortfolioAsset }
  | { kind: 'protocol'; protocol: PortfolioProtocolPositionRow };

function shortContract(address: string): string {
  return `${address.slice(0, 10)}…${address.slice(-8)}`;
}

function Metric({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}): React.ReactElement {
  const colors = useRubanColors();

  return (
    <View
      style={[
        styles.metric,
        wide ? styles.metricWide : undefined,
        { backgroundColor: colors.choiceSurface },
      ]}
    >
      <Text style={[styles.metricLabel, { color: colors.faint }]}>{label}</Text>
      <Text
        selectable={wide}
        numberOfLines={wide ? 1 : 2}
        style={[styles.metricValue, { color: colors.ink }]}
      >
        {value}
      </Text>
    </View>
  );
}

export function PortfolioItemSheet({
  selection,
  onDismiss,
}: {
  selection: PortfolioItemSelection | null;
  onDismiss: () => void;
}): React.ReactElement {
  const colors = useRubanColors();
  const insets = useSafeAreaInsets();
  const item =
    selection?.kind === 'asset' ? selection.asset : selection?.protocol;
  const chain = item ? getChainRegistryEntry(item.chainId) : null;
  const title =
    selection?.kind === 'asset'
      ? selection.asset.symbol
      : selection?.kind === 'protocol'
      ? selection.protocol.protocolName
      : '';
  const meta =
    selection?.kind === 'asset'
      ? selection.asset.name
      : selection?.kind === 'protocol'
      ? selection.protocol.category.toUpperCase()
      : '';

  return (
    <BottomSheetModalRoot
      visible={selection != null}
      onDismiss={onDismiss}
      overlayId="portfolio-item"
      enableDynamicSizing={false}
      snapPoints={['58%']}
    >
      <BottomSheetScrollView
        testID="portfolio-item-sheet"
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        <View style={styles.identity}>
          {selection?.kind === 'asset' ? (
            <PortfolioIcon
              logoUrl={selection.asset.logoUrl}
              label={selection.asset.symbol}
              size={54}
            />
          ) : (
            <PortfolioIcon
              logoUrl={selection?.protocol.logoUrl || undefined}
              label={title}
              size={54}
            />
          )}
          <View style={styles.identityCopy}>
            <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
            <Text style={[styles.meta, { color: colors.faint }]}>
              {chain?.displayName.toUpperCase()}
              {meta ? ` · ${meta}` : ''}
            </Text>
          </View>
        </View>

        {selection?.kind === 'asset' ? (
          <View style={styles.metrics}>
            <Metric
              label="VALUE"
              value={
                selection.asset.valueUsd == null
                  ? '—'
                  : formatUsd(selection.asset.valueUsd)
              }
            />
            <Metric
              label="PRICE"
              value={
                selection.asset.priceUsd == null
                  ? '—'
                  : formatUsd(selection.asset.priceUsd)
              }
            />
            <Metric
              label="BALANCE"
              value={`${selection.asset.displayBalance} ${selection.asset.symbol}`}
              wide
            />
            <Metric
              label="CONTRACT"
              value={
                selection.asset.contractAddress
                  ? shortContract(selection.asset.contractAddress)
                  : 'Native'
              }
              wide
            />
          </View>
        ) : selection?.kind === 'protocol' ? (
          <View style={styles.metrics}>
            <Metric
              label="NET"
              value={formatUsd(selection.protocol.netValueUsd)}
            />
            <Metric
              label="DEBT"
              value={formatUsd(selection.protocol.debtValueUsd)}
            />
            <Metric
              label="ASSETS"
              value={formatUsd(selection.protocol.assetValueUsd)}
              wide
            />
          </View>
        ) : null}
      </BottomSheetScrollView>
    </BottomSheetModalRoot>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md, paddingHorizontal: spacing.lg },
  identity: { flexDirection: 'row', alignItems: 'center' },
  identityCopy: { flex: 1, marginLeft: 14 },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  meta: {
    marginTop: 3,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  metrics: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metric: {
    width: '48.5%',
    minHeight: 88,
    marginBottom: spacing.sm,
    padding: 13,
    justifyContent: 'space-between',
  },
  metricWide: { width: '100%', minHeight: 76 },
  metricLabel: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  metricValue: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
});
