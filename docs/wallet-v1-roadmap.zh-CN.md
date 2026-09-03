# Ruban EVM 钱包 V1 路线图

[English](./wallet-v1-roadmap.md)

这份路线图用于把 Ruban 做成真正可用的、自托管 EVM DApp 工作台，同时产出一个支持
bare React Native 的独立钱包包。进度按能力与安全门槛推进，不按日期或页面数量推进。
不同阶段可以并行探索，但只有通过退出门槛，才能宣布该阶段完成。

每次发行分别记录构建、运行和数据同步三套性能预算。任何一项的优化，都不能掩盖另外两项
的退步。

## V1 产品约束

V1 包含：

- EVM 外部账户（EOA）；
- 创建和导入助记词、导入私钥、派生账户，以及观察地址；
- 由平台安全能力与可选用户在场验证保护的本地加密 Vault；
- Native 交易与消息签名；
- 把 WalletConnect 作为外部签名方式和会话通道；
- 为自有 WebView 中的 DApp 提供 EIP-1193 Provider；
- 按来源隔离账户与网络权限；
- 对支持的消息和交易提供人类可读的确认界面；
- 可配置 EVM 网络与 RPC；
- cache-first Portfolio：展示原生资产和经过选择的 ERC-20 资产，并提供法币估值、
  数据来源、新鲜度和增量刷新；
- 本地活动记录和用于测试的确定性 deep link。

V1 不包含：

- 非 EVM 链族；
- 智能账户与账户抽象；
- 硬件钱包；
- 云端助记词备份或账户恢复服务；
- Swap、Bridge、质押、法币入口、交易所、DeFi 仓位、盈亏分析和 NFT 产品；
- 盲签以及语义模糊的 `eth_sign`；
- 向加载的 DApp 暴露任意 Native 能力。

第一版采用直接发行和受控测试名单。App Store 与 Google Play 上架可以作为独立工作继续，
但商店审核不是 V1 架构成立的前置条件。

## 目标包结构

实现分成三道边界：

```text
Rust Wallet Core
    ↓ 稳定 C ABI
iOS / Android Vault 与平台包装层
    ↓ Legacy Native Module / TurboModule 适配
@ruban-labs/react-native-wallet-core
    ↓ 只返回不透明标识和公开结果
Ruban App 与 DApp Runtime
```

- Rust Core 不依赖 React Native。
- 平台包装层负责 Keychain/Keystore、用户在场策略、生命周期锁定和 Native 密钥输入界面。
- React Native 包支持 bare 项目，不要求 Expo Modules、Nitro 或其他基础运行时。
- 密码学依赖固定版本，审核许可证并记录来源，最终编译进 Native 产物；Ruban 不重复实现。
- 包目标覆盖 RN 0.66 旧架构、RN 0.77 新旧架构，以及最新受支持 RN 的 New Architecture。

## App 结构化数据层

Ruban App 使用 `@op-engineering/op-sqlite` 作为唯一 SQLite 连接实现，并在 TypeScript
查询层使用 TypeORM。一个 App 进程只允许存在一个全局 `DataSource` 和一个初始化
Promise；Fast Refresh 也不得重复打开同一个数据库。

- 首个版本发布前只维护一份可直接修改的基线 schema，不创建 migration class 或
  migration 表；测试数据在基线变化后直接重置。
- 某个版本真实发布并冻结 schema 后，后续 schema 变更才允许以该已发布版本为起点
  添加 TypeORM Migration。生产代码始终关闭 `synchronize`。
- 账户公开元数据、当前账户、Portfolio 缓存、DApp 权限和活动索引进入结构化表；查询、
  排序和筛选走 Repository 或 QueryBuilder，不退回 KV JSON 列表。
- 助记词、私钥和派生种子仍由 Native Vault 持有；SQLite 不保存这些明文，也不成为
  Keychain/Keystore 的替代品。
- 默认使用 WAL、`synchronous=NORMAL` 和有限 `busy_timeout`。单条用户写入使用事务；
  后续批量同步必须具备合并、取消、批次边界和耗时观测。
- 后续 C++ 数据同步器可以通过 OP-SQLite 的 Native 接口直接写同一数据库，但只能消费
  已发布 schema，必须检查版本、使用事务，并在提交后通知 JS 查询层失效；Native 不得
  私自迁移 schema。

## 阶段 0：冻结边界

交付物：

- 产品范围和明确不做的内容；
- 威胁模型，覆盖恶意 DApp、被污染的 RPC、危险剪贴板、root/越狱设备、日志、
  崩溃上报、备份、截图和被攻破的 React Native JavaScript 上下文；
- Native/JavaScript 数据流图；
- 允许签名和 RPC 方法表；
- 依赖与许可证评估条件；
- 有版本号的 Vault 格式，以及删除和恢复语义。

退出门槛：

- 每种敏感数据都有唯一、明确的持有者和生命周期；
- 所有必要用户流程都不要求把助记词或私钥返回 JS；
- 尚未实现的签名请求默认拒绝。

## 阶段 1：证明 Rust Core

先做只在内存运行、不落盘的 Core：

- BIP-39 助记词；
- BIP-32/BIP-44 EVM 派生，显式指定路径和账户索引；
- secp256k1 公钥与签名；
- Keccak-256 与 EVM checksum 地址；
- Legacy 与 EIP-1559 交易解析和序列化；
- EIP-191 个人消息与 EIP-712 Typed Data；
- 稳定、带版本的 C ABI，以及明确的 Buffer 所有权和错误契约。

验证：

- 官方测试向量和独立来源测试向量；
- 至少与两个成熟参考实现做差分测试；
- 针对解析器、序列化器和 ABI 输入的属性测试与模糊测试；
- 畸形输入和跨链重放场景；
- 派生、解析和签名性能基线。

退出门槛：

- 所有接受的向量和参考实现结果完全一致；
- 在约定运行预算内，模糊测试没有发现崩溃、越界或无限制分配；
- ABI 不通过错误、调试输出或所有权问题泄露敏感数据。

## 阶段 2：建设 Native Vault

在不接 React Native 的前提下加入平台持久化：

- 每个 Vault 使用独立随机数据加密密钥；
- 对 Seed/私钥记录进行认证加密；
- 由 iOS Keychain 和 Android Keystore 保护包装密钥；
- 可选生物识别/设备密码用户在场验证，并定义清楚降级策略；
- 自动生命周期锁定、显式锁定、破坏性删除和写入中断恢复；
- Native 助记词/私钥输入和助记词确认界面；
- 在依赖和平台允许的范围内及时清零敏感内存。

Secure Enclave 与 Android Keystore 用于保护包装密钥；V1 不假设它们可以直接保存或使用
导入的 EVM 私钥完成签名。

退出门槛：

- 测试场景中的 App 文件、JS Heap、AsyncStorage、日志、剪贴板、崩溃元数据和截图均不
  包含敏感材料；
- 写入中断后只能恢复到上一个完整状态，或进入可诊断的锁定状态，不能接受半个 Vault；
- 删除操作清除全部自有密文记录与平台包装密钥。

## 阶段 3：发布 React Native 边界

围绕不透明 Handle 创建 `@ruban-labs/react-native-wallet-core`：

- 创建/导入流程只返回 `vaultId` 与公开账户描述；
- 列表、派生、改名、锁定、解锁和删除都使用不透明 ID；
- 签名接受结构化请求，只返回公开签名结果；
- 错误使用稳定错误码和脱敏信息；
- Legacy Native Module 与 TurboModule 共用同一个 Native Core；
- 生命周期和并发请求使用一套串行 Vault 策略。

验证矩阵：

- RN 0.66 旧架构；
- RN 0.77 旧架构；
- RN 0.77 New Architecture；
- RN latest New Architecture；
- Android/iOS 编译、打包、安装和确定性 Native 场景。

退出门槛：

- 安装打包后 tarball 的真实消费者通过每个有效矩阵槽位；
- 同一场景在所有槽位得到相同地址和签名结果；
- Bridge 取消、Reload、进入后台和进程重启都不会让 Vault 意外保持解锁。

## 阶段 4：建设 Portfolio Data Engine

先让速度可观察，再扩展 DApp 广度：

- 网络加载前先展示最近一次完整本地快照；
- 原生资产直接查询；网络支持时，经过选择的 ERC-20 使用批量调用；
- Token 发现和法币价格位于可替换 Indexer Adapter 后面；
- 多网络并行刷新，同时限制单 Host 并发、支持取消、请求合并和过期响应拒绝；
- 记录 Provider 延迟、数据新鲜度、来源与失败，不把账户数据发送给无关服务；
- 观察地址与签名账户使用同一条只读数据链路。

退出门槛：

- 离线启动无需网络请求或解锁 Vault，就能显示最近一次完整快照；
- 较旧响应不能覆盖较新数据；
- 每个展示金额都标明网络、区块或观察时间，以及数据来源；
- 在参考设备上测量冷启动、缓存首屏、单链刷新和完整刷新预算。

## 阶段 5：建设 DApp Runtime

把 latest Gongshu App 逐步变成主要 Ruban 产品：

- 精选 DApp 目录、最近使用、收藏和受控自定义 URL；
- 自有 WebView 包装层和 HTTPS 优先的导航策略；
- 单独发布 TypeScript Bridge 包，在网页内容执行前注入静态 EIP-1193 Provider；
- 严格消息 Schema、来源绑定、导航/会话 Nonce、超时、请求限额和未知方法拒绝；
- App 内部请求与浏览器请求使用独立 RPC 通道；浏览器 origin/session 只参与本地调度，
  不发送给公开 RPC 节点；
- 按来源保存账户、网络和能力授权；
- 本地签名与 WalletConnect Connector 共用一个 Signer 接口；
- 可配置 RPC，并验证 Chain ID 和处理不一致情况。

WebView 按不可信环境处理。它不能获得任意 Native 平台 API、可作为授权重复利用的 Vault
Handle，也不能在用户明确授权前读取账户。

退出门槛：

- 页面来源变化后，上一个页面的权限立即失效；
- 没有匹配权限和可见用户动作，DApp 无法读取账户或请求签名；
- 畸形、重复、重放、后台和跨来源请求都按确定规则拒绝。

## 阶段 6：让签名真正可理解

使用 Ruban UI 包完成产品确认和恢复界面：

- 连接账户和网络权限 Sheet；
- 消息、Typed Data 和交易确认页；
- 明确展示规范化来源、账户、网络、接收方、金额、费用、Nonce，以及可支持的调用解析；
- 无法理解的数据进入明确的“不支持/不透明”状态，拒绝本地签名，不把一串 Hex 包装成安全；
- 提交中、替换、失败、本地活动和撤销状态；
- 只在影响决定或帮助恢复时使用简短风险文案。

退出门槛：

- 每种本地支持的签名类型都有独立、确定的确认测试场景；
- 页面展示字段来自最终交给签名器的同一份字节；
- 修改任何已确认字段都会改变或使最终签名 Payload 失效。

## 阶段 7：加固与发行

发行准备包括：

- 依赖 SBOM、许可证报告、源码与二进制来源；
- 可复现的未签名 Core 产物和内容 Hash；
- 静态分析、模糊测试、Sanitizer 和敏感信息脱敏检查；
- Android 16 KB 兼容与设备能力路由；
- 新旧架构与 RN 时代 Release 矩阵；
- 真机冷启动、Vault 恢复、DApp 连接、签名、提交、切后台、升级和卸载场景；
- 隐私政策、安全模型、漏洞报告和恢复指南；
- 在宣传生产安全或扩大测试范围前完成独立审查。

受控 V1 发行退出门槛：

- 两个平台全部安全关键测试通过；
- 没有影响密钥归属或签名的未解决严重/高危问题；
- 全新安装无需开发工具、Metro、样本数据或手工修复存储，即可完成主要 DApp 流程；
- Release Candidate 已证明可以回滚，并验证 Vault 格式兼容策略。

## 实施顺序

最短且安全的纵向切片：

1. 威胁模型和方法白名单；
2. Rust 中从临时助记词派生一个确定的 EVM 地址；
3. 只含一个账户的加密 Native Vault；
4. React Native 包通过每个有效矩阵槽位；
5. 先显示缓存原生资产，再完成一次增量实时刷新；
6. 一个自有测试 DApp 请求账户权限；
7. 一次可读的 EIP-712 确认和 Native 签名；
8. 在 EVM 测试网络提交一笔签名交易；
9. 把 WalletConnect 加为第二种 Signer；
10. 补齐产品目录、活动记录和受控发行。

这条纵向切片会在投入大量页面和网络适配前，先证明最困难的安全边界。只有签名链路完整、
可观察之后，才扩展更多网络、资产、DApp 和视觉页面。
