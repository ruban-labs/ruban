# @ruban-labs/react-native-data-engine

[English](./README.md)

面向 bare React Native 的原生资产同步与 SQLite 投影基础能力。C++ 负责与数据供应商
无关的投影类型和确定性 Mock 数据；平台模块串行写入应用的 WAL 数据库，JavaScript
只读取规范化表并订阅同步状态事件。

首个 DeBank 适配器明确为 Mock，不产生网络请求。后续 BYOK 适配器可以在不改变
数据库契约的前提下替换它。供应商凭据只应进入 Keychain 或 Keystore，绝不写入
SQLite，也不返回 JavaScript。
