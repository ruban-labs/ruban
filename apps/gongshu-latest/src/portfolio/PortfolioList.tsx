import { RefreshIcon } from '@ruban-labs/react-native-ui-icons';
import type { PortfolioAsset } from '@ruban-labs/react-native-evm-client';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { spacing, useRubanColors } from '../design/tokens';
import type { PortfolioProtocolPositionRow } from '../storage/entities';
import type { PortfolioItemSelection } from './PortfolioItemSheet';
import { formatUsd } from './presentation';
import { PortfolioIcon } from './TokenIcon';
import { usePortfolioSyncProgress } from './usePortfolio';

type GroupPosition = 'only' | 'first' | 'middle' | 'last';

type PortfolioListItem =
  | {
      kind: 'asset';
      key: string;
      position: GroupPosition;
      asset: PortfolioAsset;
    }
  | { kind: 'empty'; key: string; position: GroupPosition }
  | { kind: 'section'; key: string }
  | {
      kind: 'protocol';
      key: string;
      position: GroupPosition;
      protocol: PortfolioProtocolPositionRow;
    };

type PortfolioListProps = {
  header: React.ReactElement;
  enabled: boolean;
  assets: PortfolioAsset[];
  protocols: PortfolioProtocolPositionRow[];
  refreshing: boolean;
  error: string | null;
  syncLabel: string;
  address?: string;
  fallbackTotalChains: number;
  latencyMs: number;
  onRefresh: () => void;
  onSelectItem: (selection: PortfolioItemSelection) => void;
};

function groupPosition(index: number, length: number): GroupPosition {
  if (length === 1) return 'only';
  if (index === 0) return 'first';
  if (index === length - 1) return 'last';
  return 'middle';
}

function buildListItems(
  assets: PortfolioAsset[],
  protocols: PortfolioProtocolPositionRow[],
): PortfolioListItem[] {
  const items: PortfolioListItem[] =
    assets.length > 0
      ? assets.map((asset, index) => ({
          kind: 'asset',
          key: `asset:${asset.chainId}:${asset.contractAddress || 'native'}`,
          position: groupPosition(index, assets.length),
          asset,
        }))
      : [{ kind: 'empty', key: 'asset:empty', position: 'only' }];

  if (protocols.length > 0) {
    items.push({ kind: 'section', key: 'section:defi' });
    protocols.forEach((protocol, index) => {
      items.push({
        kind: 'protocol',
        key: `protocol:${protocol.chainId}:${protocol.protocolId}:${protocol.positionId}`,
        position: groupPosition(index, protocols.length),
        protocol,
      });
    });
  }

  return items;
}

export function PortfolioList({
  header,
  enabled,
  assets,
  protocols,
  refreshing,
  error,
  syncLabel,
  address,
  fallbackTotalChains,
  latencyMs,
  onRefresh,
  onSelectItem,
}: PortfolioListProps): React.ReactElement {
  const colors = useRubanColors();
  const items = React.useMemo(
    () => (enabled ? buildListItems(assets, protocols) : []),
    [assets, enabled, protocols],
  );
  const listHeader = React.useMemo(
    () => (
      <>
        {header}
        {enabled ? (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: colors.faint }]}>
              TOKENS
            </Text>
            <PortfolioSyncControl
              address={address}
              refreshing={refreshing}
              idleLabel={syncLabel}
              fallbackTotalChains={fallbackTotalChains}
              latencyMs={latencyMs}
              onRefresh={onRefresh}
            />
          </View>
        ) : null}
      </>
    ),
    [
      colors.faint,
      address,
      enabled,
      fallbackTotalChains,
      header,
      latencyMs,
      onRefresh,
      refreshing,
      syncLabel,
    ],
  );
  const renderItem = React.useCallback(
    ({ item }: ListRenderItemInfo<PortfolioListItem>) => {
      switch (item.kind) {
        case 'asset':
          return (
            <AssetRow
              asset={item.asset}
              position={item.position}
              onSelect={onSelectItem}
            />
          );
        case 'protocol':
          return (
            <ProtocolRow
              protocol={item.protocol}
              position={item.position}
              onSelect={onSelectItem}
            />
          );
        case 'section':
          return (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: colors.faint }]}>
                DEFI
              </Text>
            </View>
          );
        case 'empty':
          return (
            <EmptyRow
              refreshing={refreshing}
              error={error}
              position={item.position}
            />
          );
      }
    },
    [colors.faint, error, onSelectItem, refreshing],
  );

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={item => item.key}
      ListHeaderComponent={listHeader}
      style={styles.list}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      updateCellsBatchingPeriod={48}
      windowSize={5}
    />
  );
}

function PortfolioSyncControl({
  address,
  refreshing,
  idleLabel,
  fallbackTotalChains,
  latencyMs,
  onRefresh,
}: {
  address?: string;
  refreshing: boolean;
  idleLabel: string;
  fallbackTotalChains: number;
  latencyMs: number;
  onRefresh: () => void;
}): React.ReactElement {
  const colors = useRubanColors();
  const progress = usePortfolioSyncProgress(address);
  const totalChains = progress.totalChains || fallbackTotalChains;
  const label = refreshing
    ? `${progress.completedChains}/${totalChains}`
    : idleLabel;

  return (
    <Pressable
      testID="refresh-portfolio"
      disabled={refreshing}
      onPress={onRefresh}
      accessibilityRole="button"
      accessibilityLabel={
        refreshing
          ? `Syncing, ${progress.stage}, ${progress.completedChains} of ${totalChains}`
          : 'Refresh'
      }
      style={({ pressed }) => [
        styles.syncControl,
        pressed ? styles.pressed : undefined,
      ]}
    >
      {refreshing ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : null}
      {label ? (
        <Text style={[styles.syncMeta, { color: colors.faint }]}>
          {label}
          {!refreshing && latencyMs ? ` · ${latencyMs} MS` : ''}
        </Text>
      ) : null}
      {!refreshing ? <RefreshIcon size={18} color={colors.faint} /> : null}
    </Pressable>
  );
}

const AssetRow = React.memo(function PortfolioAssetRow({
  asset,
  position,
  onSelect,
}: {
  asset: PortfolioAsset;
  position: GroupPosition;
  onSelect: (selection: PortfolioItemSelection) => void;
}): React.ReactElement {
  const colors = useRubanColors();
  const select = React.useCallback(
    () => onSelect({ kind: 'asset', asset }),
    [asset, onSelect],
  );

  return (
    <Pressable
      testID={`portfolio-token-${asset.chainId}-${asset.symbol}`}
      accessibilityRole="button"
      accessibilityLabel={`${asset.name}, ${asset.displayBalance} ${asset.symbol}`}
      onPress={select}
      style={({ pressed }) => [
        styles.row,
        rowEdges(position, colors.border),
        pressed ? { backgroundColor: colors.choiceSurface } : undefined,
      ]}
    >
      <PortfolioIcon logoUrl={asset.logoUrl} label={asset.symbol} />
      <View style={styles.itemIdentity}>
        <Text style={[styles.itemTitle, { color: colors.ink }]}>
          {asset.symbol}
        </Text>
        <Text style={[styles.itemMeta, { color: colors.faint }]}>
          {asset.name.toUpperCase()}
        </Text>
      </View>
      <View style={styles.itemAmounts}>
        <Text style={[styles.itemValue, { color: colors.ink }]}>
          {asset.valueUsd == null ? '—' : formatUsd(asset.valueUsd)}
        </Text>
        <Text style={[styles.itemBalance, { color: colors.faint }]}>
          {asset.displayBalance}
        </Text>
      </View>
    </Pressable>
  );
});

const ProtocolRow = React.memo(function PortfolioProtocolRow({
  protocol,
  position,
  onSelect,
}: {
  protocol: PortfolioProtocolPositionRow;
  position: GroupPosition;
  onSelect: (selection: PortfolioItemSelection) => void;
}): React.ReactElement {
  const colors = useRubanColors();
  const select = React.useCallback(
    () => onSelect({ kind: 'protocol', protocol }),
    [onSelect, protocol],
  );

  return (
    <Pressable
      testID={`portfolio-protocol-${protocol.protocolId}`}
      accessibilityRole="button"
      accessibilityLabel={`${protocol.protocolName}, ${formatUsd(
        protocol.netValueUsd,
      )}`}
      onPress={select}
      style={({ pressed }) => [
        styles.row,
        rowEdges(position, colors.border),
        pressed ? { backgroundColor: colors.choiceSurface } : undefined,
      ]}
    >
      <PortfolioIcon
        logoUrl={protocol.logoUrl || undefined}
        label={protocol.protocolName}
      />
      <View style={styles.itemIdentity}>
        <Text style={[styles.itemTitle, { color: colors.ink }]}>
          {protocol.protocolName}
        </Text>
        <Text style={[styles.itemMeta, { color: colors.faint }]}>
          {protocol.category.toUpperCase()}
        </Text>
      </View>
      <View style={styles.itemAmounts}>
        <Text style={[styles.itemValue, { color: colors.ink }]}>
          {formatUsd(protocol.netValueUsd)}
        </Text>
        {protocol.debtValueUsd > 0 ? (
          <Text style={[styles.itemBalance, { color: colors.alert }]}>
            −{formatUsd(protocol.debtValueUsd)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

function EmptyRow({
  refreshing,
  error,
  position,
}: {
  refreshing: boolean;
  error: string | null;
  position: GroupPosition;
}): React.ReactElement {
  const colors = useRubanColors();

  return (
    <View style={[styles.emptyList, rowEdges(position, colors.border)]}>
      <Text style={[styles.emptyListValue, { color: colors.ink }]}>
        {refreshing ? 'SYNCING' : 'NO BALANCES'}
      </Text>
      {error ? (
        <Text style={[styles.emptyListMeta, { color: colors.alert }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function rowEdges(position: GroupPosition, borderColor: string) {
  return {
    borderColor,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: position === 'only' || position === 'first' ? 1 : 0,
    borderBottomWidth:
      position === 'only' || position === 'last' ? 1 : StyleSheet.hairlineWidth,
  };
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { paddingBottom: spacing.xxl },
  sectionHeader: {
    marginTop: 28,
    marginBottom: 10,
    minHeight: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  syncMeta: {
    marginHorizontal: 8,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.55,
  },
  syncControl: {
    minWidth: 44,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  row: {
    minHeight: 72,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIdentity: { flex: 1, marginLeft: 12 },
  itemTitle: { fontSize: 14, lineHeight: 18, fontWeight: '900' },
  itemMeta: {
    marginTop: 2,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 0.55,
  },
  itemAmounts: { alignItems: 'flex-end', marginLeft: spacing.sm },
  itemValue: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  itemBalance: {
    marginTop: 1,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  emptyList: { minHeight: 82, padding: 16, justifyContent: 'center' },
  emptyListValue: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  emptyListMeta: {
    marginTop: 8,
    fontSize: 8,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.55,
  },
  pressed: { opacity: 0.62 },
});
