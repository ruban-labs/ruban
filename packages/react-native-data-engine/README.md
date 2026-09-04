# @ruban-labs/react-native-data-engine

[中文](./README.zh-CN.md)

Native portfolio synchronization and SQLite projection primitives for bare
React Native. C++ owns provider-independent projection types and deterministic
mock data. Platform modules serialize writes to the application's WAL database,
while JavaScript reads normalized tables and observes sync-state events.

The initial DeBank adapter is an explicit mock and performs no network calls.
A future BYOK adapter can replace it without changing the database contract.
Provider credentials belong in Keychain or Keystore, never SQLite or JavaScript.
