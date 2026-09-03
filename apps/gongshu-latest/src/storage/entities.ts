import { EntitySchema } from 'typeorm/browser';

export type AppStateRow = {
  key: string;
  value: string;
  updatedAt: number;
};

export type WalletAccountRow = {
  id: string;
  label: string;
  address: string;
  kind: 'mnemonic' | 'private-key' | 'watch-only';
  derivationPath: string | null;
  createdAt: number;
};

export type PortfolioCacheRow = {
  address: string;
  snapshotJson: string;
  updatedAt: number;
};

export const AppStateEntity = new EntitySchema<AppStateRow>({
  name: 'AppState',
  tableName: 'app_state',
  columns: {
    key: { type: 'text', primary: true },
    value: { type: 'text' },
    updatedAt: { name: 'updated_at', type: 'integer' },
  },
});

export const WalletAccountEntity = new EntitySchema<WalletAccountRow>({
  name: 'WalletAccount',
  tableName: 'wallet_accounts',
  columns: {
    id: { type: 'text', primary: true },
    label: { type: 'text' },
    address: { type: 'text' },
    kind: { type: 'text' },
    derivationPath: {
      name: 'derivation_path',
      type: 'text',
      nullable: true,
    },
    createdAt: { name: 'created_at', type: 'integer' },
  },
  indices: [
    {
      name: 'wallet_accounts_created_at',
      columns: ['createdAt', 'id'],
    },
  ],
});

export const PortfolioCacheEntity = new EntitySchema<PortfolioCacheRow>({
  name: 'PortfolioCache',
  tableName: 'portfolio_cache',
  columns: {
    address: { type: 'text', primary: true },
    snapshotJson: { name: 'snapshot_json', type: 'text' },
    updatedAt: { name: 'updated_at', type: 'integer' },
  },
});

export const entities = [
  AppStateEntity,
  WalletAccountEntity,
  PortfolioCacheEntity,
];
