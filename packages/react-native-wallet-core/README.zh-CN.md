# @ruban-labs/react-native-wallet-core

[English](./README.md)

面向 bare React Native 的 Native EVM 账户派生、Vault 存储与签名包。密码学 Core
使用 Rust 编写，由 Android 和 iOS 包装层共同使用。私钥和助记词由 Native 界面输入并
保存；JavaScript API 只能获得不透明账户标识和公开结果。

该包仍在孵化，尚未完成独立安全审计，请勿用于有价值的真实资产。

## 原则

- 支持 bare React Native，不要求 Expo Modules 或 Nitro runtime。
- Android/iOS 共用一个 Rust Core。
- 同一个包提供 Legacy Native Module 与 New Architecture 互操作能力。
- 明文敏感数据不进入 JavaScript、SQLite、日志或错误信息。
- 账户目录和产品缓存由宿主 App 的结构化数据库维护；Wallet Core 只持有 Native Vault。
- 不提供 `eth_sign` 或盲签接口。

## 开发

```sh
pnpm test:rust
pnpm typecheck
pnpm build
```
