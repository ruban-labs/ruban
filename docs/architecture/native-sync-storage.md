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
Provider adapter (deterministic mock or DeBank BYOK)
    -> fixed native HTTP request plan
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

## Client cache policy

- Read the selected address from SQLite before considering provider IO.
- When a committed snapshot exists, render it without an automatic provider
  request, including after a cold start.
- Run a provider sync automatically only when the selected address has no
  committed snapshot.
- Treat the visible refresh action as an explicit paid refresh: synchronize,
  commit, refresh the TypeORM data source, then re-query SQLite.
- Keep the last committed projection readable when the network is unavailable;
  failed refreshes update sync state without deleting cached assets.

## Tables

- `portfolio_data_sources`: provider mode and credential readiness metadata;
- `portfolio_sync_state`: current run, stage, progress, duration, and redacted
  failure code;
- `portfolio_account_snapshots`: account-level total at one observation time;
- `portfolio_chain_snapshots`: chain summaries and source latency;
- `portfolio_token_balances`: normalized token balances and valuation;
- `portfolio_protocol_positions`: normalized protocol-level positions.

Provider credentials never enter these tables. A DeBank AccessKey is imported
directly into iOS Keychain or an Android Keystore-backed private value. It is
resolved only while the platform HTTP client builds the `AccessKey` header; it
is never returned to JavaScript, C++, SQLite, events, logs, or sync results.

## Provider contract

The first BYOK adapter uses three documented DeBank User API reads:

- `GET /v1/user/total_balance` for the account total and chain summaries;
- `GET /v1/user/all_token_list?is_all=false` for token balances;
- `GET /v1/user/all_simple_protocol_list` for protocol summaries.

The selected endpoints return all matching rows and do not document pagination.
Do not invent cursor handling for them. Incremental refresh adds the documented
`chain_ids` filter to token and protocol requests, then replaces only those
chain IDs in SQLite. The account total still comes from `total_balance`, so an
incremental refresh cannot accidentally recompute a partial total.

The platform transport accepts only the fixed HTTPS host and endpoint allowlist.
One sync permits exactly three logical requests, up to three attempts per
request, a 30-second total wall-clock budget, seven-second per-attempt timeout,
and four MiB per response. Only transport failures, HTTP 408, 429, and 5xx are
retryable. `Retry-After` and exponential backoff are capped at five seconds.
Local request and attempt counts are diagnostics; they are not presented as
DeBank billing units because the public Units documentation does not define a
stable per-endpoint cost table.

## Write policy

- One native queue serializes synchronization writes.
- WAL and a bounded busy timeout coordinate the native writer with OP-SQLite
  readers and ordinary TypeORM transactions.
- A sync records `queued`, then `running`, then deletes and replaces the
  provider/address projection inside `BEGIN IMMEDIATE` / `COMMIT`.
- Full sync deletes all chain projections for that provider/address. Incremental
  sync deletes only explicitly selected chain IDs, including a selected chain
  that returns no assets, so stale rows cannot survive.
- `succeeded` is committed in the same transaction as the projection.
- Failure rolls back the projection and writes only a redacted failed state.
- The native module emits an event only after the final state is durable.
- Initialization converts any persisted `queued` or `running` state into
  `failed/sync_interrupted` without touching the last committed projection.
- Concurrent refreshes of the same provider/address are rejected; different
  addresses remain serialized by the single platform writer.

## Schema lifecycle

Version `0.0.1` has not shipped. Until the first real release, edit the one
baseline directly and reset test data when it changes. Do not add migration
classes or a migration table yet. Once a published build freezes the baseline,
all later schema changes must be explicit TypeORM migrations from that release.

## Mock and test boundary

The deterministic DeBank mock is shaped like the documented API responses and
passes through the same C++ parser and normalized projection as BYOK data. It
performs no HTTP request and consumes no DeBank units. C++ doctest coverage
includes full and incremental projections, exact large integer balances,
malformed and duplicate JSON, missing or duplicate endpoint envelopes,
non-retryable authentication failures, bounded retry behavior, and empty-chain
replacement semantics.

The latest Android Debug app may import a development AccessKey with
`scripts/dev/import-debank-access-key.mjs`. The helper streams the authorized
file through ADB stdin into app-private storage, triggers a Debug-only receiver,
and immediately deletes the plaintext device staging file. Never add an
AccessKey to a Deep Link, repository file, command argument, log, or SQLite.

References: [DeBank User API](https://docs.cloud.debank.com/en/readme/api-pro-reference/user),
[OpenAPI authentication](https://docs.cloud.debank.com/en/readme/open-api), and
[Units Usage](https://docs.cloud.debank.com/en/readme/auxiliary-feature/units).
