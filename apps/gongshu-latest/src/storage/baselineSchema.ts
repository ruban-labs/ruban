import type { DataSource } from 'typeorm/browser';

export async function ensureUnreleasedBaselineSchema(
  dataSource: DataSource,
): Promise<void> {
  await dataSource.transaction(async manager => {
    await manager.query(`CREATE TABLE IF NOT EXISTS "app_state" (
      "key" TEXT PRIMARY KEY NOT NULL,
      "value" TEXT NOT NULL,
      "updated_at" INTEGER NOT NULL
    ) STRICT, WITHOUT ROWID`);
    await manager.query(`CREATE TABLE IF NOT EXISTS "wallet_accounts" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "label" TEXT NOT NULL,
      "address" TEXT NOT NULL,
      "kind" TEXT NOT NULL CHECK ("kind" IN ('mnemonic', 'private-key', 'watch-only')),
      "derivation_path" TEXT,
      "created_at" INTEGER NOT NULL
    ) STRICT, WITHOUT ROWID`);
    await manager.query(
      'CREATE INDEX IF NOT EXISTS "wallet_accounts_created_at" ON "wallet_accounts" ("created_at", "id")',
    );
    await manager.query(`CREATE TABLE IF NOT EXISTS "portfolio_cache" (
      "address" TEXT PRIMARY KEY NOT NULL,
      "snapshot_json" TEXT NOT NULL,
      "updated_at" INTEGER NOT NULL
    ) STRICT, WITHOUT ROWID`);
  });
}
