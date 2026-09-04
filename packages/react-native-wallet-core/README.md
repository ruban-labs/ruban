# @ruban-labs/react-native-wallet-core

[简体中文](./README.zh-CN.md)

Native EVM account derivation, vault storage, and signing for bare React Native.
The cryptographic core is written in Rust and shared by the Android and iOS
wrappers. Private keys and mnemonics are entered and stored by native surfaces;
the JavaScript API receives opaque account identifiers and public results.

This package is incubating and has not completed an independent security audit.
Do not use it for valuable assets yet.

## Principles

- Bare React Native; no Expo Modules or Nitro runtime.
- One Rust core across Android and iOS.
- Legacy Native Module and New Architecture interop from one package.
- No plaintext secrets in JavaScript, SQLite, logs, or error messages.
- The host App owns account metadata and product caches; Wallet Core owns only the native vault.
- No `eth_sign` or blind-signing API.

## Development

```sh
pnpm test:rust
pnpm typecheck
pnpm build
```
