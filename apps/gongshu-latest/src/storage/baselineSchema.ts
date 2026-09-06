import type { DataSource } from 'typeorm/browser';

export async function ensureUnreleasedBaselineSchema(
  dataSource: DataSource,
): Promise<void> {
  await dataSource.transaction(async manager => {
    await manager.query(`CREATE TABLE IF NOT EXISTS "app_state" (
      "key" TEXT PRIMARY KEY NOT NULL,
      "value" TEXT NOT NULL,
      "updated_at" INTEGER NOT NULL
    ) WITHOUT ROWID`);
    await manager.query(`CREATE TABLE IF NOT EXISTS "wallet_accounts" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "label" TEXT NOT NULL,
      "address" TEXT NOT NULL,
      "kind" TEXT NOT NULL CHECK ("kind" IN ('mnemonic', 'private-key', 'watch-only')),
      "derivation_path" TEXT,
      "created_at" INTEGER NOT NULL
    ) WITHOUT ROWID`);
    await manager.query(
      'CREATE INDEX IF NOT EXISTS "wallet_accounts_created_at" ON "wallet_accounts" ("created_at", "id")',
    );
    await manager.query(`CREATE TABLE IF NOT EXISTS "app_intent_receipts" (
      "run_id" TEXT PRIMARY KEY NOT NULL,
      "action" TEXT NOT NULL,
      "source" TEXT NOT NULL CHECK ("source" IN ('ui', 'deep-link', 'background', 'worker')),
      "status" TEXT NOT NULL CHECK ("status" IN ('succeeded', 'failed')),
      "result_json" TEXT,
      "error_code" TEXT,
      "completed_at" INTEGER NOT NULL
    ) WITHOUT ROWID`);
    await manager.query(
      'CREATE INDEX IF NOT EXISTS "app_intent_receipts_completed_at" ON "app_intent_receipts" ("completed_at" DESC)',
    );
    await manager.query('DROP TABLE IF EXISTS "portfolio_cache"');
    await manager.query(`CREATE TABLE IF NOT EXISTS "portfolio_data_sources" (
      "provider_id" TEXT PRIMARY KEY NOT NULL,
      "mode" TEXT NOT NULL CHECK ("mode" IN ('mock', 'byok')),
      "credential_state" TEXT NOT NULL CHECK ("credential_state" IN ('mock', 'missing', 'configured')),
      "enabled" INTEGER NOT NULL CHECK ("enabled" IN (0, 1)),
      "updated_at" INTEGER NOT NULL
    ) WITHOUT ROWID`);
    await manager.query(`CREATE TABLE IF NOT EXISTS "portfolio_sync_state" (
      "provider_id" TEXT NOT NULL,
      "address" TEXT NOT NULL,
      "run_id" TEXT NOT NULL,
      "state" TEXT NOT NULL CHECK ("state" IN ('idle', 'queued', 'running', 'succeeded', 'failed')),
      "stage" TEXT NOT NULL,
      "completed_chains" INTEGER NOT NULL,
      "total_chains" INTEGER NOT NULL,
      "started_at" INTEGER NOT NULL,
      "completed_at" INTEGER,
      "duration_ms" INTEGER NOT NULL,
      "updated_at" INTEGER NOT NULL,
      "error_code" TEXT,
      PRIMARY KEY ("provider_id", "address")
    ) WITHOUT ROWID`);
    await manager.query(`CREATE TABLE IF NOT EXISTS "portfolio_account_snapshots" (
      "provider_id" TEXT NOT NULL,
      "address" TEXT NOT NULL,
      "total_value_usd" REAL NOT NULL,
      "observed_at" INTEGER NOT NULL,
      PRIMARY KEY ("provider_id", "address")
    ) WITHOUT ROWID`);
    await manager.query(`CREATE TABLE IF NOT EXISTS "portfolio_chain_snapshots" (
      "provider_id" TEXT NOT NULL,
      "address" TEXT NOT NULL,
      "chain_id" INTEGER NOT NULL,
      "chain_key" TEXT NOT NULL,
      "chain_name" TEXT NOT NULL,
      "value_usd" REAL NOT NULL,
      "latency_ms" INTEGER NOT NULL,
      "source" TEXT NOT NULL,
      "observed_at" INTEGER NOT NULL,
      PRIMARY KEY ("provider_id", "address", "chain_id")
    ) WITHOUT ROWID`);
    await manager.query(`CREATE TABLE IF NOT EXISTS "portfolio_token_balances" (
      "provider_id" TEXT NOT NULL,
      "address" TEXT NOT NULL,
      "chain_id" INTEGER NOT NULL,
      "asset_id" TEXT NOT NULL,
      "symbol" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "contract_address" TEXT,
      "decimals" INTEGER NOT NULL,
      "balance" TEXT NOT NULL,
      "display_balance" TEXT NOT NULL,
      "price_usd" REAL NOT NULL,
      "value_usd" REAL NOT NULL,
      "observed_at" INTEGER NOT NULL,
      PRIMARY KEY ("provider_id", "address", "chain_id", "asset_id")
    ) WITHOUT ROWID`);
    await manager.query(`CREATE TABLE IF NOT EXISTS "portfolio_protocol_positions" (
      "provider_id" TEXT NOT NULL,
      "address" TEXT NOT NULL,
      "chain_id" INTEGER NOT NULL,
      "protocol_id" TEXT NOT NULL,
      "position_id" TEXT NOT NULL,
      "protocol_name" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "asset_value_usd" REAL NOT NULL,
      "debt_value_usd" REAL NOT NULL,
      "net_value_usd" REAL NOT NULL,
      "observed_at" INTEGER NOT NULL,
      PRIMARY KEY ("provider_id", "address", "chain_id", "protocol_id", "position_id")
    ) WITHOUT ROWID`);
    await manager.query(
      'CREATE INDEX IF NOT EXISTS "portfolio_chain_value" ON "portfolio_chain_snapshots" ("address", "value_usd" DESC)',
    );
    await manager.query(
      'CREATE INDEX IF NOT EXISTS "portfolio_token_value" ON "portfolio_token_balances" ("address", "chain_id", "value_usd" DESC)',
    );
    await manager.query(
      'CREATE INDEX IF NOT EXISTS "portfolio_protocol_value" ON "portfolio_protocol_positions" ("address", "chain_id", "net_value_usd" DESC)',
    );
  });
}
