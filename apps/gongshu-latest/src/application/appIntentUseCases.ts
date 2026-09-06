import { dataEngine } from '@ruban-labs/react-native-data-engine';
import { defaultEvmChains } from '@ruban-labs/react-native-evm-client';
import {
  addWatchOnly,
  deleteSecret,
  presentCreateMnemonic,
  presentImportMnemonic,
  presentImportPrivateKey,
  type WalletAccount,
} from '@ruban-labs/react-native-wallet-core';
import { buildInfo } from '../buildInfo';
import {
  appRpcReviewQueue,
  type RpcReviewRequest,
} from '../dapp/rpcReviewQueue';
import { ensureDataEngine } from '../data/DataEngineContext';
import { checkpointDataSourceForNativeWrite } from '../storage/dataSource';
import { repositories } from '../storage/repositories';
import {
  AppIntentFailure,
  type AppIntent,
  type AppIntentResult,
} from './appIntent';
import type { AppIntentUseCases } from './appIntentDispatcher';

function isSupportedChain(chainId: number): boolean {
  return defaultEvmChains.some(chain => chain.id === chainId);
}

async function findAccount(
  selector: { accountId?: string; address?: string },
): Promise<WalletAccount> {
  const hasAccountId = !!selector.accountId;
  const hasAddress = !!selector.address;
  if (hasAccountId === hasAddress) {
    throw new AppIntentFailure('account_selector_invalid');
  }
  const accounts = await repositories.listWalletAccounts();
  const account = selector.accountId
    ? accounts.find(candidate => candidate.id === selector.accountId)
    : accounts.find(
        candidate =>
          candidate.address.toLowerCase() === selector.address?.toLowerCase(),
      );
  if (!account) throw new AppIntentFailure('account_not_found');
  return account;
}

async function saveAndSelectAccount(
  account: WalletAccount,
): Promise<AppIntentResult> {
  try {
    await repositories.saveWalletAccount(account);
  } catch (error) {
    if (account.kind !== 'watch-only') await deleteSecret(account.id);
    throw error;
  }
  await repositories.setSelectedAccountId(account.id);
  return {
    accountId: account.id,
    address: account.address.toLowerCase(),
    kind: account.kind,
  };
}

function waitForReview(
  expectedMethod: string | undefined,
  timeoutMs: number,
): Promise<RpcReviewRequest> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe = () => {};
    const finish = (request: RpcReviewRequest) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      resolve(request);
    };
    const check = () => {
      const active = appRpcReviewQueue.getActive();
      if (active && (!expectedMethod || active.method === expectedMethod)) {
        finish(active);
      }
    };
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      reject(new AppIntentFailure('review_not_found'));
    }, timeoutMs);
    unsubscribe = appRpcReviewQueue.subscribe(check);
    check();
  });
}

async function execute(intent: AppIntent): Promise<AppIntentResult> {
  switch (intent.action) {
    case 'runtime.ready':
      return {
        edition: buildInfo.edition,
        reactNative: buildInfo.reactNative,
        architecture: buildInfo.architecture,
        engine: buildInfo.engine,
        platform: buildInfo.platform,
        environment: buildInfo.environment,
      };
    case 'wallet.add-watch-address': {
      const existing = (await repositories.listWalletAccounts()).find(
        account =>
          account.address.toLowerCase() === intent.address.toLowerCase(),
      );
      if (existing) {
        await repositories.setSelectedAccountId(existing.id);
        return {
          accountId: existing.id,
          address: existing.address.toLowerCase(),
          kind: existing.kind,
          created: false,
        };
      }
      const account = await addWatchOnly(intent.label, intent.address);
      return {
        ...(await saveAndSelectAccount(account)),
        created: true,
      };
    }
    case 'wallet.select-account': {
      const account = await findAccount(intent);
      await repositories.setSelectedAccountId(account.id);
      return {
        accountId: account.id,
        address: account.address.toLowerCase(),
      };
    }
    case 'wallet.delete-account': {
      const account = await findAccount(intent);
      const selectedAccountId = await repositories.getSelectedAccountId();
      if (account.kind !== 'watch-only') await deleteSecret(account.id);
      await repositories.deleteWalletAccount(account.id);
      const remaining = await repositories.listWalletAccounts();
      if (selectedAccountId === account.id) {
        await repositories.setSelectedAccountId(remaining[0]?.id || null);
      }
      return {
        accountId: account.id,
        address: account.address.toLowerCase(),
        remainingAccounts: remaining.length,
      };
    }
    case 'wallet.create-mnemonic':
      return saveAndSelectAccount(await presentCreateMnemonic('Primary'));
    case 'wallet.import-mnemonic':
      return saveAndSelectAccount(
        await presentImportMnemonic('Imported phrase'),
      );
    case 'wallet.import-private-key':
      return saveAndSelectAccount(await presentImportPrivateKey('Imported key'));
    case 'wallet.select-chain':
      if (!isSupportedChain(intent.chainId)) {
        throw new AppIntentFailure('unsupported_chain');
      }
      await repositories.setSelectedChainId(intent.chainId);
      return { chainId: intent.chainId };
    case 'portfolio.sync': {
      await ensureDataEngine();
      await checkpointDataSourceForNativeWrite();
      const result =
        intent.providerMode === 'mock'
          ? await dataEngine.syncMockPortfolio(intent.address)
          : await dataEngine.syncPortfolio(intent.address);
      const snapshot = await repositories.getPortfolioSnapshot(intent.address);
      if (!snapshot) throw new AppIntentFailure('portfolio_snapshot_missing');
      return {
        address: result.address.toLowerCase(),
        providerMode: intent.providerMode,
        completedChains: result.completedChains,
        requestCount: result.requestCount,
        assetCount: snapshot.assets.length,
        totalValueUsd: snapshot.totalValueUsd,
      };
    }
    case 'dapp.resolve-review': {
      const request = await waitForReview(
        intent.expectedMethod,
        intent.timeoutMs,
      );
      if (intent.decision === 'approve') appRpcReviewQueue.approve();
      else appRpcReviewQueue.reject();
      return {
        requestId: request.id,
        method: request.method,
        decision: intent.decision,
      };
    }
    default: {
      const exhaustive: never = intent;
      return exhaustive;
    }
  }
}

export const appIntentUseCases: AppIntentUseCases = { execute };
