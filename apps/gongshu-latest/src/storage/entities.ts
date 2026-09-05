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

export type AppIntentReceiptRow = {
  runId: string;
  action: string;
  source: 'ui' | 'deep-link' | 'background' | 'worker';
  status: 'succeeded' | 'failed';
  resultJson: string | null;
  errorCode: string | null;
  completedAt: number;
};

export type PortfolioDataSourceRow = {
  providerId: string;
  mode: 'mock' | 'byok';
  credentialState: 'mock' | 'missing' | 'configured';
  enabled: number;
  updatedAt: number;
};

export type PortfolioSyncStateRow = {
  providerId: string;
  address: string;
  runId: string;
  state: 'idle' | 'queued' | 'running' | 'succeeded' | 'failed';
  stage: string;
  completedChains: number;
  totalChains: number;
  startedAt: number;
  completedAt: number | null;
  durationMs: number;
  updatedAt: number;
  errorCode: string | null;
};

export type PortfolioAccountSnapshotRow = {
  providerId: string;
  address: string;
  totalValueUsd: number;
  observedAt: number;
};

export type PortfolioChainSnapshotRow = {
  providerId: string;
  address: string;
  chainId: number;
  chainKey: string;
  chainName: string;
  valueUsd: number;
  latencyMs: number;
  source: string;
  observedAt: number;
};

export type PortfolioTokenBalanceRow = {
  providerId: string;
  address: string;
  chainId: number;
  assetId: string;
  symbol: string;
  name: string;
  contractAddress: string | null;
  decimals: number;
  balance: string;
  displayBalance: string;
  priceUsd: number;
  valueUsd: number;
  observedAt: number;
};

export type PortfolioProtocolPositionRow = {
  providerId: string;
  address: string;
  chainId: number;
  protocolId: string;
  positionId: string;
  protocolName: string;
  category: string;
  assetValueUsd: number;
  debtValueUsd: number;
  netValueUsd: number;
  observedAt: number;
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

export const AppIntentReceiptEntity =
  new EntitySchema<AppIntentReceiptRow>({
    name: 'AppIntentReceipt',
    tableName: 'app_intent_receipts',
    columns: {
      runId: { name: 'run_id', type: 'text', primary: true },
      action: { type: 'text' },
      source: { type: 'text' },
      status: { type: 'text' },
      resultJson: { name: 'result_json', type: 'text', nullable: true },
      errorCode: { name: 'error_code', type: 'text', nullable: true },
      completedAt: { name: 'completed_at', type: 'integer' },
    },
  });

export const PortfolioDataSourceEntity =
  new EntitySchema<PortfolioDataSourceRow>({
    name: 'PortfolioDataSource',
    tableName: 'portfolio_data_sources',
    columns: {
      providerId: { name: 'provider_id', type: 'text', primary: true },
      mode: { type: 'text' },
      credentialState: { name: 'credential_state', type: 'text' },
      enabled: { type: 'integer' },
      updatedAt: { name: 'updated_at', type: 'integer' },
    },
  });

export const PortfolioSyncStateEntity =
  new EntitySchema<PortfolioSyncStateRow>({
    name: 'PortfolioSyncState',
    tableName: 'portfolio_sync_state',
    columns: {
      providerId: { name: 'provider_id', type: 'text', primary: true },
      address: { type: 'text', primary: true },
      runId: { name: 'run_id', type: 'text' },
      state: { type: 'text' },
      stage: { type: 'text' },
      completedChains: { name: 'completed_chains', type: 'integer' },
      totalChains: { name: 'total_chains', type: 'integer' },
      startedAt: { name: 'started_at', type: 'integer' },
      completedAt: { name: 'completed_at', type: 'integer', nullable: true },
      durationMs: { name: 'duration_ms', type: 'integer' },
      updatedAt: { name: 'updated_at', type: 'integer' },
      errorCode: { name: 'error_code', type: 'text', nullable: true },
    },
  });

export const PortfolioAccountSnapshotEntity =
  new EntitySchema<PortfolioAccountSnapshotRow>({
    name: 'PortfolioAccountSnapshot',
    tableName: 'portfolio_account_snapshots',
    columns: {
      providerId: { name: 'provider_id', type: 'text', primary: true },
      address: { type: 'text', primary: true },
      totalValueUsd: { name: 'total_value_usd', type: 'real' },
      observedAt: { name: 'observed_at', type: 'integer' },
    },
  });

export const PortfolioChainSnapshotEntity =
  new EntitySchema<PortfolioChainSnapshotRow>({
    name: 'PortfolioChainSnapshot',
    tableName: 'portfolio_chain_snapshots',
    columns: {
      providerId: { name: 'provider_id', type: 'text', primary: true },
      address: { type: 'text', primary: true },
      chainId: { name: 'chain_id', type: 'integer', primary: true },
      chainKey: { name: 'chain_key', type: 'text' },
      chainName: { name: 'chain_name', type: 'text' },
      valueUsd: { name: 'value_usd', type: 'real' },
      latencyMs: { name: 'latency_ms', type: 'integer' },
      source: { type: 'text' },
      observedAt: { name: 'observed_at', type: 'integer' },
    },
  });

export const PortfolioTokenBalanceEntity =
  new EntitySchema<PortfolioTokenBalanceRow>({
    name: 'PortfolioTokenBalance',
    tableName: 'portfolio_token_balances',
    columns: {
      providerId: { name: 'provider_id', type: 'text', primary: true },
      address: { type: 'text', primary: true },
      chainId: { name: 'chain_id', type: 'integer', primary: true },
      assetId: { name: 'asset_id', type: 'text', primary: true },
      symbol: { type: 'text' },
      name: { type: 'text' },
      contractAddress: {
        name: 'contract_address',
        type: 'text',
        nullable: true,
      },
      decimals: { type: 'integer' },
      balance: { type: 'text' },
      displayBalance: { name: 'display_balance', type: 'text' },
      priceUsd: { name: 'price_usd', type: 'real' },
      valueUsd: { name: 'value_usd', type: 'real' },
      observedAt: { name: 'observed_at', type: 'integer' },
    },
  });

export const PortfolioProtocolPositionEntity =
  new EntitySchema<PortfolioProtocolPositionRow>({
    name: 'PortfolioProtocolPosition',
    tableName: 'portfolio_protocol_positions',
    columns: {
      providerId: { name: 'provider_id', type: 'text', primary: true },
      address: { type: 'text', primary: true },
      chainId: { name: 'chain_id', type: 'integer', primary: true },
      protocolId: { name: 'protocol_id', type: 'text', primary: true },
      positionId: { name: 'position_id', type: 'text', primary: true },
      protocolName: { name: 'protocol_name', type: 'text' },
      category: { type: 'text' },
      assetValueUsd: { name: 'asset_value_usd', type: 'real' },
      debtValueUsd: { name: 'debt_value_usd', type: 'real' },
      netValueUsd: { name: 'net_value_usd', type: 'real' },
      observedAt: { name: 'observed_at', type: 'integer' },
    },
  });

export const entities = [
  AppStateEntity,
  WalletAccountEntity,
  AppIntentReceiptEntity,
  PortfolioDataSourceEntity,
  PortfolioSyncStateEntity,
  PortfolioAccountSnapshotEntity,
  PortfolioChainSnapshotEntity,
  PortfolioTokenBalanceEntity,
  PortfolioProtocolPositionEntity,
];
