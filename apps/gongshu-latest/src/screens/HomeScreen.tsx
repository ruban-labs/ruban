import { Dialog } from '@ruban-labs/react-native-ui-dialog';
import { Input } from '@ruban-labs/react-native-ui-form/input';
import { CaretDownIcon, RefreshIcon } from '@ruban-labs/react-native-ui-icons';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChainSelectorSheet } from '../chains/ChainSelectorSheet';
import { chainRegistry, getChainRegistryEntry } from '../chains/chainRegistry';
import { RubanScreen } from '../components/RubanPrimitives';
import { spacing, useRubanColors } from '../design/tokens';
import { usePortfolio } from '../portfolio/usePortfolio';
import { useWallet } from '../wallet/WalletContext';
import { AddressSelectorSheet } from '../wallet/WalletSelectors';

function shortAddress(address: string): string {
  return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

function money(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

export default function HomeScreen(): React.ReactElement {
  const colors = useRubanColors();
  const wallet = useWallet();
  const portfolio = usePortfolio(wallet.selectedAccount?.address);
  const [watchOpen, setWatchOpen] = React.useState(false);
  const [watchAddress, setWatchAddress] = React.useState('');
  const [watchLabel, setWatchLabel] = React.useState('Watch account');
  const [busy, setBusy] = React.useState(false);
  const [activeSelector, setActiveSelector] = React.useState<
    'chain' | 'address' | null
  >(null);

  const run = React.useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      if (error instanceof Error && !/cancel/i.test(error.message))
        Alert.alert('Wallet', error.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const addWatch = React.useCallback(() => {
    run(async () => {
      await wallet.addWatchAccount(watchLabel, watchAddress);
      setWatchAddress('');
      setWatchOpen(false);
    });
  }, [run, wallet, watchAddress, watchLabel]);

  const selectedChain = getChainRegistryEntry(wallet.selectedChainId);
  const selectedChainPortfolio = portfolio.snapshot?.chains.find(
    chain => chain.chain.id === wallet.selectedChainId,
  );
  const visibleAssets =
    portfolio.snapshot?.assets.filter(
      asset =>
        asset.chainId === wallet.selectedChainId &&
        Number(asset.displayBalance) > 0,
    ) || [];
  const selectedValue =
    selectedChainPortfolio?.assets.reduce(
      (total, asset) => total + (asset.valueUsd || 0),
      0,
    ) || 0;
  const maxLatency = selectedChainPortfolio?.latencyMs || 0;

  return (
    <RubanScreen
      testID="screen-home"
      contentStyle={styles.screen}
      scrollProps={{ refreshControl: undefined }}
    >
      <View style={styles.header}>
        <TouchableOpacity
          testID="open-chain-selector"
          accessibilityRole="button"
          accessibilityLabel={`Network, ${selectedChain.displayName}`}
          onPress={() => setActiveSelector('chain')}
          activeOpacity={0.68}
          style={styles.chainButton}
        >
          <Image
            source={
              colors.mode === 'dark'
                ? selectedChain.whiteLogo
                : selectedChain.logo
            }
            resizeMode="contain"
            style={styles.chainLogo}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>
          Portfolio
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            disabled={portfolio.refreshing}
            onPress={portfolio.refresh}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={portfolio.refreshing ? 'Syncing' : 'Refresh'}
            style={styles.refreshButton}
          >
            <RefreshIcon size={28} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {wallet.selectedAccount ? (
        <>
          <Text style={[styles.balance, { color: colors.ink }]}>
            {money(selectedValue)}
          </Text>
          <TouchableOpacity
            testID="open-address-selector"
            accessibilityRole="button"
            accessibilityLabel={`Address, ${wallet.selectedAccount.label}`}
            onPress={() => setActiveSelector('address')}
            activeOpacity={0.68}
            style={styles.accountRow}
          >
            <View>
              <Text style={[styles.accountName, { color: colors.ink }]}>
                {wallet.selectedAccount.label}
              </Text>
              <Text style={[styles.address, { color: colors.faint }]}>
                {shortAddress(wallet.selectedAccount.address)}
              </Text>
            </View>
            <CaretDownIcon size={12} color={colors.faint} />
          </TouchableOpacity>
        </>
      ) : (
        <View style={[styles.emptyHero, { backgroundColor: colors.contrast }]}>
          <Text style={[styles.emptyMark, { color: colors.contrastAccent }]}>
            01
          </Text>
          <Text style={[styles.emptyTitle, { color: colors.inverse }]}>
            Create a wallet
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <Action
          label="CREATE"
          onPress={() => run(wallet.createMnemonic)}
          disabled={busy || !wallet.available}
        />
        <Action
          label="PHRASE"
          onPress={() => run(wallet.importMnemonic)}
          disabled={busy || !wallet.available}
        />
        <Action
          label="KEY"
          onPress={() => run(wallet.importPrivateKey)}
          disabled={busy || !wallet.available}
        />
        <Action
          label="WATCH"
          onPress={() => setWatchOpen(true)}
          disabled={busy || !wallet.available}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: colors.faint }]}>
          ASSETS
        </Text>
        {portfolio.refreshing ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Text style={[styles.syncMeta, { color: colors.faint }]}>
            {portfolio.completedChains}/{chainRegistry.length}
            {maxLatency ? ` · ${maxLatency} MS` : ''}
          </Text>
        )}
      </View>

      <View style={[styles.assetList, { borderColor: colors.border }]}>
        {visibleAssets.length > 0 ? (
          visibleAssets.map((asset, index) => (
            <View
              key={`${asset.chainId}:${asset.contractAddress || 'native'}`}
              style={[
                styles.assetRow,
                index > 0 && {
                  borderTopColor: colors.border,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View
                style={[
                  styles.assetMark,
                  { backgroundColor: colors.accentSoft },
                ]}
              >
                <Text style={[styles.assetMarkText, { color: colors.accent }]}>
                  {asset.symbol.slice(0, 1)}
                </Text>
              </View>
              <View style={styles.assetIdentity}>
                <Text style={[styles.assetSymbol, { color: colors.ink }]}>
                  {asset.symbol}
                </Text>
                <Text style={[styles.assetChain, { color: colors.faint }]}>
                  {asset.chainName.toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={[styles.assetValue, { color: colors.ink }]}>
                  {asset.valueUsd == null ? '—' : money(asset.valueUsd)}
                </Text>
                <Text style={[styles.assetBalance, { color: colors.faint }]}>
                  {asset.displayBalance}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.noAssets}>
            <Text style={[styles.noAssetsValue, { color: colors.ink }]}>
              {portfolio.refreshing ? 'SYNCING' : 'NO BALANCES'}
            </Text>
            {portfolio.error ? (
              <Text style={[styles.noAssetsMeta, { color: colors.alert }]}>
                {portfolio.error}
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <ChainSelectorSheet
        visible={activeSelector === 'chain'}
        chains={chainRegistry}
        selectedChainId={wallet.selectedChainId}
        onSelect={wallet.selectChain}
        onDismiss={() => setActiveSelector(null)}
      />
      <AddressSelectorSheet
        visible={activeSelector === 'address'}
        accounts={wallet.accounts}
        selectedAccountId={wallet.selectedAccount?.id || null}
        onSelect={wallet.selectAccount}
        onDismiss={() => setActiveSelector(null)}
      />

      <Dialog.Root open={watchOpen} onOpenChange={setWatchOpen}>
        <Dialog.Content accessibilityLabel="Add watch account">
          <Dialog.Header>
            <Dialog.Title>Watch account</Dialog.Title>
          </Dialog.Header>
          <Input
            value={watchLabel}
            onChangeText={setWatchLabel}
            placeholder="Label"
          />
          <Input
            value={watchAddress}
            onChangeText={setWatchAddress}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="0x…"
            style={styles.watchAddress}
          />
          <Dialog.Footer>
            <TouchableOpacity
              onPress={() => setWatchOpen(false)}
              style={styles.dialogButton}
            >
              <Text style={[styles.dialogButtonText, { color: colors.faint }]}>
                CANCEL
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={addWatch}
              style={[styles.dialogButton, { backgroundColor: colors.ink }]}
            >
              <Text
                style={[styles.dialogButtonText, { color: colors.inverse }]}
              >
                ADD
              </Text>
            </TouchableOpacity>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </RubanScreen>
  );
}

function Action({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}): React.ReactElement {
  const colors = useRubanColors();
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.72}
      style={[
        styles.action,
        { borderColor: colors.borderStrong },
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.actionText, { color: colors.ink }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: spacing.xxl },
  header: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.45,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    right: 0,
  },
  chainButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  chainLogo: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  refreshButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balance: {
    marginTop: 30,
    fontSize: 48,
    lineHeight: 54,
    fontWeight: '800',
    letterSpacing: -2.4,
  },
  accountRow: {
    marginTop: 6,
    minHeight: 42,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountName: { fontSize: 14, lineHeight: 20, fontWeight: '800' },
  address: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  emptyHero: {
    marginTop: 28,
    height: 174,
    padding: 18,
    justifyContent: 'space-between',
  },
  emptyMark: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  emptyTitle: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1.8,
  },
  actions: { marginTop: 16, flexDirection: 'row' },
  action: {
    flex: 1,
    minHeight: 46,
    marginRight: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  disabled: { opacity: 0.4 },
  sectionHeader: {
    marginTop: 30,
    marginBottom: 10,
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
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.55,
  },
  assetList: { borderWidth: 1 },
  assetRow: {
    minHeight: 72,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetMark: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetMarkText: { fontSize: 15, fontWeight: '900' },
  assetIdentity: { flex: 1, marginLeft: 12 },
  assetSymbol: { fontSize: 14, lineHeight: 18, fontWeight: '900' },
  assetChain: {
    marginTop: 2,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  assetValue: {
    textAlign: 'right',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  assetBalance: {
    textAlign: 'right',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  noAssets: { minHeight: 82, padding: 16, justifyContent: 'center' },
  noAssetsValue: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  noAssetsMeta: {
    marginTop: 8,
    fontSize: 8,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.55,
  },
  watchAddress: { marginTop: 10 },
  dialogButton: {
    minWidth: 82,
    minHeight: 42,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogButtonText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});
