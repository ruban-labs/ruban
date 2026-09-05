import {
  addWatchOnly,
  deleteSecret,
  isWalletCoreAvailable,
  presentCreateMnemonic,
  presentImportMnemonic,
  presentImportPrivateKey,
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
import { Linking } from 'react-native';
import { appEnvironment } from '../runtime/appEnvironment';
import { repositories } from '../storage/repositories';

type WalletContextValue = {
  available: boolean;
  loading: boolean;
  accounts: WalletAccount[];
  selectedAccount: WalletAccount | null;
  selectedChainId: number;
  selectAccount: (accountId: string) => void;
  selectChain: (chainId: number) => void;
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
const handledDeveloperLinks = new Set<string>();

type DeveloperWatchAddress = {
  address: string;
  label: string;
};

function parseQuery(
  query: string,
  allowedKeys: ReadonlySet<string>,
): Record<string, string> | null {
  const values: Record<string, string> = {};
  for (const pair of query.split('&')) {
    const separator = pair.indexOf('=');
    if (separator < 1) return null;
    const key = decodeURIComponent(pair.slice(0, separator));
    if (!allowedKeys.has(key) || Object.hasOwn(values, key)) return null;
    const value = decodeURIComponent(
      pair.slice(separator + 1).replace(/\+/g, '%20'),
    );
    values[key] = value;
  }
  return values;
}

function parseDeveloperWatchAddress(
  url: string | null | undefined,
): DeveloperWatchAddress | null {
  if (!url || url.length > 512 || appEnvironment === 'production') return null;
  const scheme = appEnvironment === 'debug' ? 'ruban-debug' : 'ruban-regression';
  const prefix = `${scheme}://dev/watch-address?`;
  if (!url.startsWith(prefix)) return null;
  try {
    const query = parseQuery(
      url.slice(prefix.length),
      new Set(['address', 'label']),
    );
    if (!query) return null;
    const address = query.address?.toLowerCase();
    const label = query.label?.trim() || 'Watch account';
    const hasControlCharacter = Array.from(label).some(character => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    });
    if (
      !/^0x[0-9a-f]{40}$/.test(address || '') ||
      label.length > 64 ||
      hasControlCharacter
    ) {
      return null;
    }
    return { address, label };
  } catch {
    return null;
  }
}

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
    await repositories.setSelectedAccountId(nextSelected);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    reload().catch(() => setLoading(false));
  }, [reload]);

  React.useEffect(() => {
    let active = true;
    const handleDeveloperLink = async (url: string | null | undefined) => {
      const command = parseDeveloperWatchAddress(url);
      if (!active || !url || !command || handledDeveloperLinks.has(url)) return;
      if (handledDeveloperLinks.size >= 128) handledDeveloperLinks.clear();
      handledDeveloperLinks.add(url);
      try {
        const existing = (await repositories.listWalletAccounts()).find(
          account => account.address.toLowerCase() === command.address,
        );
        if (existing) {
          await repositories.setSelectedAccountId(existing.id);
          await reload(existing.id);
          return;
        }
        const account = await addWatchOnly(command.label, command.address);
        await repositories.saveWalletAccount(account);
        await reload(account.id);
      } catch {
        handledDeveloperLinks.delete(url);
      }
    };

    Linking.getInitialURL().then(handleDeveloperLink);
    const subscription = Linking.addEventListener('url', event => {
      handleDeveloperLink(event.url);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [reload]);

  const selectAccount = React.useCallback((accountId: string) => {
    setSelectedAccountId(accountId);
    repositories.setSelectedAccountId(accountId).catch(() => {});
  }, []);

  const selectChain = React.useCallback((chainId: number) => {
    if (!isSupportedChain(chainId))
      throw new Error(`Unsupported chain ${chainId}`);
    setSelectedChainId(chainId);
    repositories.setSelectedChainId(chainId).catch(() => {});
  }, []);

  const runCreate = React.useCallback(
    async (action: () => Promise<WalletAccount>) => {
      const account = await action();
      try {
        await repositories.saveWalletAccount(account);
      } catch (error) {
        if (account.kind !== 'watch-only') await deleteSecret(account.id);
        throw error;
      }
      await reload(account.id);
    },
    [reload],
  );

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
      createMnemonic: () => runCreate(() => presentCreateMnemonic('Primary')),
      importMnemonic: () =>
        runCreate(() => presentImportMnemonic('Imported phrase')),
      importPrivateKey: () =>
        runCreate(() => presentImportPrivateKey('Imported key')),
      addWatchAccount: async (label, address) => {
        const account = await addWatchOnly(label, address);
        await repositories.saveWalletAccount(account);
        await reload(account.id);
      },
      deleteAccount: async accountId => {
        const account = accounts.find(candidate => candidate.id === accountId);
        if (!account) throw new Error('Account not found');
        if (account.kind !== 'watch-only') await deleteSecret(accountId);
        await repositories.deleteWalletAccount(accountId);
        await reload();
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
      accounts,
      available,
      loading,
      reload,
      requireSigner,
      runCreate,
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
