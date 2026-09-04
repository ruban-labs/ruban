import {
  defaultEvmChains,
  type PortfolioSnapshot,
} from '@ruban-labs/react-native-evm-client';
import type {
  PortfolioDataSource,
  PortfolioSyncState,
} from '@ruban-labs/react-native-data-engine';
import type { WalletAccount } from '@ruban-labs/react-native-wallet-core';
import {
  AppStateEntity,
  PortfolioAccountSnapshotEntity,
  PortfolioChainSnapshotEntity,
  PortfolioDataSourceEntity,
  PortfolioProtocolPositionEntity,
  PortfolioSyncStateEntity,
  PortfolioTokenBalanceEntity,
  WalletAccountEntity,
  type PortfolioProtocolPositionRow,
  type WalletAccountRow,
} from './entities';
import { getDataSource } from './dataSource';

const selectedAccountKey = 'wallet.selected-account';
const selectedChainKey = 'wallet.selected-chain';
const portfolioProviderId = 'debank';

function toWalletAccount(row: WalletAccountRow): WalletAccount {
  return {
    id: row.id,
    label: row.label,
    address: row.address,
    kind: row.kind,
    ...(row.derivationPath ? { derivationPath: row.derivationPath } : {}),
    createdAt: row.createdAt,
  };
}

export const repositories = {
  async listWalletAccounts(): Promise<WalletAccount[]> {
    const dataSource = await getDataSource();
    const rows = await dataSource.getRepository(WalletAccountEntity).find({
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map(toWalletAccount);
  },

  async saveWalletAccount(account: WalletAccount): Promise<void> {
    const dataSource = await getDataSource();
    await dataSource.transaction(async manager => {
      await manager.getRepository(WalletAccountEntity).upsert(
        {
          id: account.id,
          label: account.label,
          address: account.address,
          kind: account.kind,
          derivationPath: account.derivationPath || null,
          createdAt: account.createdAt,
        },
        ['id'],
      );
    });
  },

  async deleteWalletAccount(accountId: string): Promise<void> {
    const dataSource = await getDataSource();
    await dataSource.transaction(async manager => {
      await manager
        .getRepository(WalletAccountEntity)
        .delete({ id: accountId });
      await manager.getRepository(AppStateEntity).delete({
        key: selectedAccountKey,
        value: accountId,
      });
    });
  },

  async getSelectedAccountId(): Promise<string | null> {
    const dataSource = await getDataSource();
    const row = await dataSource
      .getRepository(AppStateEntity)
      .findOneBy({ key: selectedAccountKey });
    return row?.value || null;
  },

  async setSelectedAccountId(accountId: string | null): Promise<void> {
    const dataSource = await getDataSource();
    await dataSource.transaction(async manager => {
      const repository = manager.getRepository(AppStateEntity);
      if (!accountId) {
        await repository.delete({ key: selectedAccountKey });
        return;
      }
      await repository.upsert(
        {
          key: selectedAccountKey,
          value: accountId,
          updatedAt: Date.now(),
        },
        ['key'],
      );
    });
  },

  async getSelectedChainId(): Promise<number | null> {
    const dataSource = await getDataSource();
    const row = await dataSource
      .getRepository(AppStateEntity)
      .findOneBy({ key: selectedChainKey });
    if (!row) return null;
    const chainId = Number(row.value);
    return Number.isSafeInteger(chainId) && chainId > 0 ? chainId : null;
  },

  async setSelectedChainId(chainId: number): Promise<void> {
    const dataSource = await getDataSource();
    await dataSource.transaction(async manager => {
      await manager.getRepository(AppStateEntity).upsert(
        {
          key: selectedChainKey,
          value: String(chainId),
          updatedAt: Date.now(),
        },
        ['key'],
      );
    });
  },

  async getPortfolioSnapshot(
    address: string,
  ): Promise<PortfolioSnapshot | null> {
    const normalizedAddress = address.toLowerCase();
    const dataSource = await getDataSource();
    const [account, chains, tokens] = await Promise.all([
      dataSource.getRepository(PortfolioAccountSnapshotEntity).findOneBy({
        providerId: portfolioProviderId,
        address: normalizedAddress,
      }),
      dataSource.getRepository(PortfolioChainSnapshotEntity).find({
        where: {
          providerId: portfolioProviderId,
          address: normalizedAddress,
        },
        order: { valueUsd: 'DESC', chainId: 'ASC' },
      }),
      dataSource.getRepository(PortfolioTokenBalanceEntity).find({
        where: {
          providerId: portfolioProviderId,
          address: normalizedAddress,
        },
        order: { valueUsd: 'DESC', chainId: 'ASC', assetId: 'ASC' },
      }),
    ]);
    if (!account) return null;

    const assets = tokens.map(token => ({
      chainId: token.chainId,
      chainName: chains.find(chain => chain.chainId === token.chainId)
        ?.chainName || String(token.chainId),
      symbol: token.symbol,
      name: token.name,
      ...(token.contractAddress
        ? { contractAddress: token.contractAddress }
        : {}),
      balance: token.balance,
      displayBalance: token.displayBalance,
      priceUsd: token.priceUsd,
      valueUsd: token.valueUsd,
    }));

    return {
      address: normalizedAddress,
      chains: chains.map(chain => {
        const registryChain = defaultEvmChains.find(
          candidate => candidate.id === chain.chainId,
        );
        if (!registryChain) {
          throw new Error(`Unsupported portfolio chain ${chain.chainId}`);
        }
        return {
          chain: registryChain,
          assets: assets.filter(asset => asset.chainId === chain.chainId),
          latencyMs: chain.latencyMs,
          source: chain.source,
          updatedAt: chain.observedAt,
        };
      }),
      assets,
      totalValueUsd: account.totalValueUsd,
      updatedAt: account.observedAt,
    };
  },

  async getPortfolioDataSource(): Promise<PortfolioDataSource | null> {
    const dataSource = await getDataSource();
    const row = await dataSource
      .getRepository(PortfolioDataSourceEntity)
      .findOneBy({ providerId: portfolioProviderId });
    if (!row) return null;
    return {
      providerId: 'debank',
      mode: row.mode,
      credentialState: row.credentialState,
      enabled: row.enabled === 1,
      updatedAt: row.updatedAt,
    };
  },

  async getPortfolioSyncState(
    address: string,
  ): Promise<PortfolioSyncState | null> {
    const dataSource = await getDataSource();
    const row = await dataSource
      .getRepository(PortfolioSyncStateEntity)
      .findOneBy({
        providerId: portfolioProviderId,
        address: address.toLowerCase(),
      });
    if (!row) return null;
    return {
      providerId: 'debank',
      address: row.address,
      runId: row.runId,
      state: row.state,
      stage: row.stage,
      completedChains: row.completedChains,
      totalChains: row.totalChains,
      updatedAt: row.updatedAt,
      ...(row.errorCode ? { errorCode: row.errorCode } : {}),
    };
  },

  async listPortfolioProtocolPositions(
    address: string,
    chainId?: number,
  ): Promise<PortfolioProtocolPositionRow[]> {
    const dataSource = await getDataSource();
    return dataSource.getRepository(PortfolioProtocolPositionEntity).find({
      where: {
        providerId: portfolioProviderId,
        address: address.toLowerCase(),
        ...(chainId == null ? {} : { chainId }),
      },
      order: { netValueUsd: 'DESC', protocolId: 'ASC', positionId: 'ASC' },
    });
  },
};
