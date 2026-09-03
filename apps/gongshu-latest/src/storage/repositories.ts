import type { PortfolioSnapshot } from '@ruban-labs/react-native-evm-client';
import type { WalletAccount } from '@ruban-labs/react-native-wallet-core';
import {
  AppStateEntity,
  PortfolioCacheEntity,
  WalletAccountEntity,
  type WalletAccountRow,
} from './entities';
import { getDataSource } from './dataSource';

const selectedAccountKey = 'wallet.selected-account';

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

  async getPortfolioSnapshot(
    address: string,
  ): Promise<PortfolioSnapshot | null> {
    const normalizedAddress = address.toLowerCase();
    const dataSource = await getDataSource();
    const row = await dataSource
      .getRepository(PortfolioCacheEntity)
      .findOneBy({ address: normalizedAddress });
    if (!row) return null;
    const snapshot = JSON.parse(row.snapshotJson) as PortfolioSnapshot;
    return snapshot.address.toLowerCase() === normalizedAddress
      ? snapshot
      : null;
  },

  async savePortfolioSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
    const dataSource = await getDataSource();
    await dataSource.transaction(async manager => {
      await manager.getRepository(PortfolioCacheEntity).upsert(
        {
          address: snapshot.address.toLowerCase(),
          snapshotJson: JSON.stringify(snapshot),
          updatedAt: Date.now(),
        },
        ['address'],
      );
    });
  },
};
