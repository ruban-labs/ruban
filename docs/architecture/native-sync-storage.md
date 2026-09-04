# Native Portfolio Sync and Storage

## Ownership

- `@ruban-labs/react-native-data-engine` owns provider adapters, normalized C++
  projections, sync state, and one serialized native writer per process.
- The App owns the SQLite baseline and future TypeORM migrations.
- OP-SQLite and the global TypeORM `DataSource` are the JavaScript query layer.
- Native code receives the resolved database path after App schema setup. It
  never creates, alters, or migrates tables.

## Data flow

```text
Provider adapter (mock now, BYOK later)
    -> normalized C++ projection
    -> serial native writer
    -> one WAL transaction per provider/address
    -> post-commit sync-state event
    -> TypeORM repository re-query
    -> React Native screen
```

JavaScript does not receive the complete provider payload over the bridge.
Workers may observe state and query projections, but they do not write sync
results.

## Tables

- `portfolio_data_sources`: provider mode and credential readiness metadata;
- `portfolio_sync_state`: current run, stage, progress, duration, and redacted
  failure code;
- `portfolio_account_snapshots`: account-level total at one observation time;
- `portfolio_chain_snapshots`: chain summaries and source latency;
- `portfolio_token_balances`: normalized token balances and valuation;
- `portfolio_protocol_positions`: normalized protocol-level positions.

Provider credentials never enter these tables. A future DeBank AccessKey must
be imported and resolved entirely through Keychain or Keystore.

## Write policy

- One native queue serializes synchronization writes.
- WAL and a bounded busy timeout coordinate the native writer with OP-SQLite
  readers and ordinary TypeORM transactions.
- A sync first records `running`, then deletes and replaces only the matching
  provider/address projection inside `BEGIN IMMEDIATE` / `COMMIT`.
- `succeeded` is committed in the same transaction as the projection.
- Failure rolls back the projection and writes only a redacted failed state.
- The native module emits an event only after the final state is durable.

## Schema lifecycle

Version `0.0.1` has not shipped. Until the first real release, edit the one
baseline directly and reset test data when it changes. Do not add migration
classes or a migration table yet. Once a published build freezes the baseline,
all later schema changes must be explicit TypeORM migrations from that release.

## Mock boundary

The current DeBank adapter is deterministic C++ test data. It performs no HTTP
request and consumes no DeBank units. A real BYOK adapter must preserve the
same normalized projection and sync-state contracts so the database and UI do
not branch by provider implementation.
