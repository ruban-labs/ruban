import { WalletIcon } from '@ruban-labs/react-native-ui-icons';
import { useIsFocused } from '@react-navigation/native';
import * as React from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChainSelectorSheet } from '../chains/ChainSelectorSheet';
import { chainRegistry, getChainRegistryEntry } from '../chains/chainRegistry';
import { RubanScreen } from '../components/RubanPrimitives';
import { spacing, useRubanColors } from '../design/tokens';
import {
  PortfolioItemSheet,
  type PortfolioItemSelection,
} from '../portfolio/PortfolioItemSheet';
import { PortfolioList } from '../portfolio/PortfolioList';
import {
  buildChainAllocations,
  formatPortfolioAge,
  formatUsd,
  selectPortfolioChain,
} from '../portfolio/presentation';
import { usePortfolio } from '../portfolio/usePortfolio';
import { useWallet } from '../wallet/WalletContext';
import { AddressSelectorSheet } from '../wallet/WalletSelectors';

function shortAddress(address: string): string {
  return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

function percent(value: number): string {
  if (value <= 0) return '0%';
  if (value < 0.01) return '<1%';
  return `${Math.round(value * 100)}%`;
}

export default function HomeScreen(): React.ReactElement {
  const colors = useRubanColors();
  const wallet = useWallet();
  const isFocused = useIsFocused();
  const portfolio = usePortfolio(wallet.selectedAccount?.address, isFocused);
  const [busy, setBusy] = React.useState(false);
  const [activeSelector, setActiveSelector] = React.useState<
    'chain' | 'address' | null
  >(null);
  const [selectedItem, setSelectedItem] =
    React.useState<PortfolioItemSelection | null>(null);
  const selectItem = React.useCallback(
    (selection: PortfolioItemSelection) => setSelectedItem(selection),
    [],
  );

  const run = React.useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      if (error instanceof Error && !/cancel/i.test(error.message)) {
        Alert.alert('Wallet', error.message);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const selectedChain = getChainRegistryEntry(wallet.selectedChainId);
  const selectedPortfolio = React.useMemo(
    () =>
      selectPortfolioChain(
        portfolio.snapshot,
        portfolio.chains,
        portfolio.protocols,
        wallet.selectedChainId,
      ),
    [
      portfolio.chains,
      portfolio.protocols,
      portfolio.snapshot,
      wallet.selectedChainId,
    ],
  );
  const allocations = React.useMemo(
    () =>
      buildChainAllocations(
        portfolio.chains,
        portfolio.snapshot?.totalValueUsd || 0,
      ),
    [portfolio.chains, portfolio.snapshot?.totalValueUsd],
  );
  const allocationByChain = React.useMemo(
    () => new Map(allocations.map(item => [item.chainId, item])),
    [allocations],
  );
  const supportedValue = chainRegistry.reduce(
    (total, entry) =>
      total + (allocationByChain.get(entry.chain.id)?.valueUsd || 0),
    0,
  );
  const otherValue = Math.max(
    0,
    (portfolio.snapshot?.totalValueUsd || 0) - supportedValue,
  );
  const otherShare = portfolio.snapshot?.totalValueUsd
    ? otherValue / portfolio.snapshot.totalValueUsd
    : 0;
  const syncLabel = portfolio.snapshot
    ? formatPortfolioAge(portfolio.snapshot.updatedAt)
    : '';

  return (
    <RubanScreen
      testID="screen-home"
      contentStyle={styles.screen}
      scroll={false}
    >
      <PortfolioList
        enabled={Boolean(wallet.selectedAccount)}
        header={
          <>
            <View style={styles.header}>
              <Pressable
                testID="open-chain-selector"
                accessibilityRole="button"
                accessibilityLabel={`Network, ${selectedChain.displayName}`}
                onPress={() => setActiveSelector('chain')}
                style={({ pressed }) => [
                  styles.headerAction,
                  styles.headerActionLeft,
                  pressed ? styles.pressed : undefined,
                ]}
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
              </Pressable>
              <Text style={[styles.headerTitle, { color: colors.ink }]}>
                Portfolio
              </Text>
              <Pressable
                testID="open-address-selector"
                accessibilityRole="button"
                accessibilityLabel={
                  wallet.selectedAccount
                    ? `Address, ${wallet.selectedAccount.label}`
                    : 'Select address'
                }
                onPress={() => setActiveSelector('address')}
                style={({ pressed }) => [
                  styles.headerAction,
                  styles.headerActionRight,
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <WalletIcon size={28} color={colors.accent} />
              </Pressable>
            </View>

            {wallet.selectedAccount ? (
              <>
                <Text style={[styles.balance, { color: colors.ink }]}>
                  {portfolio.snapshot
                    ? formatUsd(portfolio.snapshot.totalValueUsd)
                    : '—'}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.accountMeta, { color: colors.faint }]}
                >
                  {wallet.selectedAccount.label} ·{' '}
                  {shortAddress(wallet.selectedAccount.address)}
                </Text>

                <View
                  testID="portfolio-network-allocation"
                  style={[
                    styles.networkCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.networkSummary}>
                    <Text
                      style={[styles.sectionLabel, { color: colors.faint }]}
                    >
                      NETWORKS
                    </Text>
                    <Text style={[styles.networkValue, { color: colors.ink }]}>
                      {formatUsd(selectedPortfolio.chainValueUsd)}
                    </Text>
                  </View>
                  <View style={styles.networks}>
                    {chainRegistry.map(entry => {
                      const allocation = allocationByChain.get(entry.chain.id);
                      const selected =
                        entry.chain.id === wallet.selectedChainId;
                      const logo =
                        colors.mode === 'dark' ? entry.whiteLogo : entry.logo;

                      return (
                        <Pressable
                          key={entry.chain.id}
                          testID={`portfolio-network-${entry.chain.id}`}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`${entry.displayName}, ${percent(
                            allocation?.share || 0,
                          )}`}
                          onPress={() =>
                            run(() => wallet.selectChain(entry.chain.id))
                          }
                          style={({ pressed }) => [
                            styles.network,
                            selected
                              ? { backgroundColor: colors.accentSoft }
                              : undefined,
                            pressed ? styles.pressed : undefined,
                          ]}
                        >
                          <Image
                            source={logo}
                            resizeMode="contain"
                            style={styles.networkLogo}
                          />
                          <Text
                            style={[
                              styles.networkShare,
                              { color: colors.faint },
                            ]}
                          >
                            {percent(allocation?.share || 0)}
                          </Text>
                        </Pressable>
                      );
                    })}
                    {otherValue >= 0.01 ? (
                      <View
                        accessibilityLabel={`Other networks, ${percent(
                          otherShare,
                        )}`}
                        style={styles.network}
                      >
                        <View
                          style={[
                            styles.otherNetwork,
                            { backgroundColor: colors.choiceSurface },
                          ]}
                        >
                          <Text
                            style={[
                              styles.otherNetworkText,
                              { color: colors.muted },
                            ]}
                          >
                            ···
                          </Text>
                        </View>
                        <Text
                          style={[styles.networkShare, { color: colors.faint }]}
                        >
                          {percent(otherShare)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </>
            ) : (
              <Pressable
                testID="empty-portfolio-add-address"
                accessibilityRole="button"
                accessibilityLabel="Add address"
                onPress={() => setActiveSelector('address')}
                style={({ pressed }) => [
                  styles.emptyHero,
                  { backgroundColor: colors.contrast },
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <WalletIcon size={26} color={colors.contrastAccent} />
                <Text style={[styles.emptyTitle, { color: colors.inverse }]}>
                  Add address
                </Text>
              </Pressable>
            )}
          </>
        }
        assets={selectedPortfolio.assets}
        protocols={selectedPortfolio.protocols}
        refreshing={portfolio.refreshing}
        error={portfolio.error}
        syncLabel={syncLabel}
        address={wallet.selectedAccount?.address}
        fallbackTotalChains={chainRegistry.length}
        latencyMs={selectedPortfolio.latencyMs}
        onRefresh={portfolio.refresh}
        onSelectItem={selectItem}
      />

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
        available={wallet.available && !busy}
        onSelect={wallet.selectAccount}
        onCreateWallet={() => run(wallet.createMnemonic)}
        onImportMnemonic={() => run(wallet.importMnemonic)}
        onImportPrivateKey={() => run(wallet.importPrivateKey)}
        onAddWatch={wallet.addWatchAccount}
        onDismiss={() => setActiveSelector(null)}
      />
      <PortfolioItemSheet
        selection={selectedItem}
        onDismiss={() => setSelectedItem(null)}
      />
    </RubanScreen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
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
  headerAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
  },
  headerActionLeft: { left: 0, alignItems: 'flex-start' },
  headerActionRight: { right: 0, alignItems: 'flex-end' },
  chainLogo: { width: 28, height: 28, borderRadius: 14 },
  balance: {
    marginTop: 28,
    fontSize: 48,
    lineHeight: 54,
    fontWeight: '800',
    letterSpacing: -2.4,
  },
  accountMeta: {
    marginTop: 7,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  networkCard: {
    marginTop: spacing.lg,
    padding: 12,
    borderWidth: 1,
  },
  networkSummary: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  networkValue: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  networks: { marginTop: 8, flexDirection: 'row' },
  network: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkLogo: { width: 27, height: 27, borderRadius: 14 },
  networkShare: {
    marginTop: 5,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  otherNetwork: {
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherNetworkText: { fontSize: 11, lineHeight: 13, fontWeight: '900' },
  emptyHero: {
    marginTop: 28,
    height: 174,
    padding: 18,
    justifyContent: 'space-between',
  },
  emptyTitle: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1.8,
  },
  sectionLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  pressed: { opacity: 0.62 },
});
