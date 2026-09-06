# @ruban-labs/react-native-data-engine

[中文](./README.zh-CN.md)

Native portfolio synchronization and SQLite projection primitives for bare
React Native. C++ owns provider-independent projections and provider response
mapping. Platform modules own secure credentials, bounded HTTP transport, and
serialized writes to the application's WAL database. JavaScript reads the
normalized tables and observes sync-state events.

The DeBank adapter supports a deterministic official-shape mock and BYOK. Both
use the same parser and full or chain-incremental replacement contract. DeBank
credentials live in iOS Keychain or Android Keystore-backed app storage and are
never returned from the native module.

```ts
await dataEngine.initialize(databasePath);

await dataEngine.configureMockDeBank();
await dataEngine.syncPortfolio(address);
await dataEngine.syncPortfolio(address, {
  mode: 'incremental',
  chains: [{ id: 1, key: 'eth' }],
});

await dataEngine.importDeBankAccessKey(accessKey);
await dataEngine.configureByokDeBank();
await dataEngine.syncPortfolio(address);
```

The application owns the SQLite schema. This package never creates or migrates
tables. See [`docs/architecture/native-sync-storage.md`](../../docs/architecture/native-sync-storage.md).
