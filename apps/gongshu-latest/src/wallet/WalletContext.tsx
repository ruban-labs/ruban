import {
  isWalletCoreAvailable,
  signEip1559Transaction,
  signPersonalMessage,
  signTypedData,
  type Eip1559Transaction,
  type SignRequestContext,
  type SignedEip1559Transaction,
  type WalletAccount,
} from '@ruban-labs/react-native-wallet-core';
import { defaultEvmChains } from '@ruban-labs/react-native-evm-client';
import * as React from 'react';
import {
  runUiAppIntent,
  subscribeAppIntentReceipts,
} from '../application/AppIntentRuntime';
import { repositories } from '../storage/repositories';

type WalletContextValue = {
  available: boolean;
  loading: boolean;
  accounts: WalletAccount[];
  selectedAccount: WalletAccount | null;
  selectedChainId: number;
  selectAccount: (accountId: string) => Promise<void>;
  selectChain: (chainId: number) => Promise<void>;
  createMnemonic: () => Promise<void>;
  importMnemonic: () => Promise<void>;
  importPrivateKey: () => Promise<void>;
  addWatchAccount: (label: string, address: string) => Promise<void>;
  deleteAccount: (accountId: string) => Promise<void>;
  signPersonal: (
    messageHex: string,
    context: SignRequestContext,
  ) => Promise<string>;
  signTyped: (
    typedDataJson: string,
    context: SignRequestContext,
  ) => Promise<string>;
  signTransaction: (
    transaction: Eip1559Transaction,
    context: SignRequestContext,
  ) => Promise<SignedEip1559Transaction>;
};

const WalletContext = React.createContext<WalletContextValue | null>(null);
const defaultChainId = defaultEvmChains[0]?.id || 1;

function isSupportedChain(chainId: number): boolean {
  return defaultEvmChains.some(chain => chain.id === chainId);
}

export function WalletProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const available = isWalletCoreAvailable();
  const [loading, setLoading] = React.useState(true);
  const [accounts, setAccounts] = React.useState<WalletAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = React.useState<
    string | null
  >(null);
  const [selectedChainId, setSelectedChainId] = React.useState(defaultChainId);

  const reload = React.useCallback(async (preferredId?: string) => {
    const [nextAccounts, storedId, storedChainId] = await Promise.all([
      repositories.listWalletAccounts(),
      repositories.getSelectedAccountId(),
      repositories.getSelectedChainId(),
    ]);
    const candidate = preferredId || storedId;
    const nextSelected = nextAccounts.some(account => account.id === candidate)
      ? candidate
      : nextAccounts[0]?.id || null;
    setAccounts(nextAccounts);
    setSelectedAccountId(nextSelected);
    setSelectedChainId(
      storedChainId && isSupportedChain(storedChainId)
        ? storedChainId
        : defaultChainId,
    );
    setLoading(false);
  }, []);

  React.useEffect(() => {
    reload().catch(() => setLoading(false));
  }, [reload]);

  React.useEffect(
    () =>
      subscribeAppIntentReceipts(receipt => {
        if (
          receipt.status === 'succeeded' &&
          receipt.action.startsWith('wallet.')
        ) {
          reload().catch(() => {});
        }
      }),
    [reload],
  );

  const selectAccount = React.useCallback(async (accountId: string) => {
    await runUiAppIntent({ action: 'wallet.select-account', accountId });
  }, []);

  const selectChain = React.useCallback(async (chainId: number) => {
    await runUiAppIntent({ action: 'wallet.select-chain', chainId });
  }, []);

  const selectedAccount =
    accounts.find(account => account.id === selectedAccountId) || null;

  const requireSelected = React.useCallback((): WalletAccount => {
    if (!selectedAccount) throw new Error('Select an account first');
    return selectedAccount;
  }, [selectedAccount]);

  const requireSigner = React.useCallback((): WalletAccount => {
    const account = requireSelected();
    if (account.kind === 'watch-only') {
      throw new Error('Watch-only accounts cannot sign');
    }
    return account;
  }, [requireSelected]);

  const signingContext = React.useCallback(
    (context: SignRequestContext): SignRequestContext => ({
      ...context,
      accountAddress: requireSigner().address,
    }),
    [requireSigner],
  );

  const value = React.useMemo<WalletContextValue>(
    () => ({
      available,
      loading,
      accounts,
      selectedAccount,
      selectedChainId,
      selectAccount,
      selectChain,
      createMnemonic: async () => {
        await runUiAppIntent({ action: 'wallet.create-mnemonic' });
      },
      importMnemonic: async () => {
        await runUiAppIntent({ action: 'wallet.import-mnemonic' });
      },
      importPrivateKey: async () => {
        await runUiAppIntent({ action: 'wallet.import-private-key' });
      },
      addWatchAccount: async (label, address) => {
        await runUiAppIntent({
          action: 'wallet.add-watch-address',
          label,
          address,
        });
      },
      deleteAccount: async accountId => {
        await runUiAppIntent({ action: 'wallet.delete-account', accountId });
      },
      signPersonal: (messageHex, context) => {
        const account = requireSigner();
        return signPersonalMessage(
          account.id,
          messageHex,
          signingContext(context),
        );
      },
      signTyped: (typedDataJson, context) => {
        const account = requireSigner();
        return signTypedData(
          account.id,
          typedDataJson,
          signingContext(context),
        );
      },
      signTransaction: (transaction, context) => {
        const account = requireSigner();
        return signEip1559Transaction(
          account.id,
          transaction,
          signingContext(context),
        );
      },
    }),
    [
      available,
      loading,
      requireSigner,
      selectAccount,
      selectChain,
      selectedAccount,
      selectedChainId,
      signingContext,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const wallet = React.useContext(WalletContext);
  if (!wallet) throw new Error('useWallet must be used within WalletProvider');
  return wallet;
}
