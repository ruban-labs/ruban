# @ruban-labs/react-native-worker-thread

面向 bare React Native 的具名 Worker Runtime 基础包。它定义 JSON 消息协议、能力边界、队列上限、Worker entry API 与原生生命周期核心；不会回退到主 JavaScript Runtime。

Hermes bundle 执行与 Inspector 注册是独立后续阶段。未链接引擎适配器时，创建 Worker 会明确返回 `E_ENGINE_NOT_READY`。

完整的架构、兼容矩阵和阶段边界见仓库中的 [Worker Runtime 文档](../../docs/architecture/worker-runtime.md)。
