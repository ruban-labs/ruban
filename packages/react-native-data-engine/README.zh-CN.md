# @ruban-labs/react-native-data-engine

[English](./README.md)

面向 bare React Native 的原生资产同步与 SQLite 投影基础能力。C++ 负责与供应商
无关的投影和响应映射；平台模块负责安全凭据、受限 HTTP 传输，并串行写入应用的
SQLite 数据库；JavaScript 只读取规范化表并订阅同步状态事件。

当应用与本包使用不同的 SQLite 实现时，应采用 rollback journal，而不是 WAL。本包只
保留一个 Native 写入者，由 rollback journal 文件锁协调 Native 写入连接与应用读取连接，
避免跨实现共享 WAL/SHM 生命周期状态。

DeBank 适配器同时支持确定性的官方数据结构 Mock 与 BYOK，两者经过同一套解析器，
并共享全量或按链增量替换契约。DeBank 凭据只进入 iOS Keychain 或由 Android
Keystore 保护的应用私有存储，原生模块不会把它返回给 JavaScript。

```ts
await dataEngine.initialize(databasePath);

await dataEngine.configureMockDeBank();
await dataEngine.syncPortfolio(address);
await dataEngine.syncPortfolio(address, {
  mode: "incremental",
  chains: [{ id: 1, key: "eth" }],
});

await dataEngine.importDeBankAccessKey(accessKey);
await dataEngine.configureByokDeBank();
await dataEngine.syncPortfolio(address);

await dataEngine.cancelPortfolioSync(address);
```

相同的进行中同步会合并到同一个任务。同一地址发起不同同步时，新任务会替换旧任务，
取消正在执行的原生请求；旧结果也不能覆盖更新的已提交快照。

SQLite 表结构由应用持有，本包不创建或迁移数据表。具体约束见
[`docs/architecture/native-sync-storage.md`](../../docs/architecture/native-sync-storage.md)。
