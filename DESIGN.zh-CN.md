# Ruban 产品与设计章程

[English](./DESIGN.md)

本文定义 Ruban Labs 如何把一组专注的 React Native 库，做成统一的产品、
兼容性实验场和视觉体系。它也是人类与编码 Agent 开发 Gongshu App 时的共同依据。

## 产品结构

Ruban 由三个互相支撑的部分组成：

1. **尺**：`awesome-native-react` 衡量生态维护情况，帮助开发者找到仍然可靠的库。
2. **工具**：一组小而锋利的 `@ruban-labs/react-native-*` 包；支持 bare React
   Native，不强制用户安装某个平台运行时。
3. **工场**：Gongshu App 展示工具、复现真实兼容问题，并产出可以发布的验证结果。

App 可以使用 React Navigation 等应用基础设施。“零运行时依赖”约束的是对外发布的
Ruban 库，不是用于验证这些库的 App。

## 长期产品方向

Ruban 将从组件工场逐步发展为真正可用的、自托管 EVM DApp 工作台。latest Gongshu
App 是主要产品载体；较早的 Gongshu 版本继续作为兼容版本，用来证明发布包在历史 React
Native 环境中的真实可用性。

钱包第一版刻意收窄边界：

- 只支持 EVM 外部账户（EOA）；
- 支持创建或导入助记词、导入私钥，以及添加观察地址；
- 提供本地加密 Vault 与 Native 签名，同时把 WalletConnect 作为额外的外部签名方式；
- 提供 DApp 发现、浏览会话、按来源隔离的权限、交易确认、提交和本地活动记录；
- 第一阶段采用直接发行和受控内测。是否公开上架应用商店，是后续产品与合规决策，
  不是 V1 的前置条件。

私钥、助记词和派生种子不得进入 React Native JavaScript 运行时。独立 Rust Core
通过经过审查的密码学依赖负责派生、解析与签名；平台包装层负责安全存储与用户在场验证；
React Native 只能获得不透明的 Vault/账户标识和公开结果。同一个 Core 同时服务 Legacy
Native Module 与 TurboModule 适配层。

Ruban 不自行实现密码学原语，也不把“第三方依赖经过审查”宣传成“Ruban 已通过安全审计”。
依赖来源、许可证、测试向量、差分测试、模糊测试、可复现构建和独立审计，都是明确的发行门槛。

Ruban 对外强调的是**源码公开与 Native Speed**。安全仍是不可退让的工程底线，但不作为
营销口号。V1 包含一个 cache-first Portfolio，用来展示配置网络中的原生资产和经过明确
选择的 ERC-20 资产。链上读取、价格/Indexer 请求、数据新鲜度、取消、批处理和 Provider
延迟都是可观察的产品契约，不藏在实现细节里。

速度拆成三条独立衡量的轴：

- **构建快**：按受影响目录运行 CI，Native 产物使用内容寻址，并复用 Cargo、Gradle、
  Xcode、CocoaPods 与 Metro 缓存；
- **运行快**：衡量冷启动、可交互时间、帧稳定性、内存压力、DApp Ready 与确认耗时；
- **同步快**：缓存首屏、增量补水、批量链上读取、自适应 Provider 选择和可替换 Indexer。

快不能牺牲数据新鲜度和来源解释。节点竞速与缓存渲染只有在网络、观察时间、来源和过期
状态都明确时才算有效。

完整的能力门槛路线见
[EVM 钱包 V1 路线图](./docs/wallet-v1-roadmap.zh-CN.md)。

## 近期库路线

下一批翻新候选：

| 包 | 产品作用 | 在 Gongshu 中的第一处真实用法 |
| --- | --- | --- |
| `@ruban-labs/react-native-collapsible` | 专注的展开、收起能力 | 库目录分组与详情渐进展示 |
| `@ruban-labs/react-native-animatable` | 小而清晰的声明式动画语言 | 页面切换、操作反馈与组件状态 |
| `@ruban-labs/react-native-keyboard-aware-scroll-view` | 稳定处理键盘与表单布局 | 搜索、表单和 Playground 控件 |

做这些库和做 Ruban App 是同一件事：每个库都要解决 App 里的真实需求，每次 App
集成都要沉淀成这个库的兼容性场景。

## 三个 RN 时代

在 `apps/` 下保留三个彼此独立的 bare React Native App：

| App | React Native 时代 | 导航 | 架构能力 |
| --- | --- | --- | --- |
| `gongshu-0.66` | 0.66.x | React Navigation 6 | 只支持旧架构 |
| `gongshu-0.77` | 0.77.x | React Navigation 7 | 同时支持旧架构与 New Architecture |
| `gongshu-latest` | 当前固定的最新版本 | React Navigation 7 | 跟随上游；0.82 起只支持 New Architecture |

每个 App 独立管理依赖、锁文件、原生工程、签名配置、Bundle ID 和发布产物。它们共享
产品场景与设计规范，但不共享 `node_modules`。

三套 App 必须保持同一套应用框架：Root Stack、Home / Playground / Settings 三个 Tab、
语义主题、组件目录与详情、Settings Bottom Sheet 和确定性 deep link 都要分别存在于每个
时代的独立源码树中。不得为了减少复制而把 App 源码提升成要求旧项目安装的基础运行时；
跨时代一致性通过同一场景、同一契约和截图对比维持。

## 架构矩阵

架构是一个**构建维度**，不是一套新的业务源码。

- 每个 RN 时代只保留一份 App 业务源码。
- 上游正式支持哪些架构，就编译哪些架构。
- 不给 RN 0.66 伪造 New Architecture，也不在已经移除旧架构的 RN 版本里强行续命。
- `gongshu-0.77` 的 Android 和 iOS 必须同时保持旧架构、New Architecture 可编译。
- CI 和发布产物名必须带 RN 时代、架构与平台，例如
  `gongshu-rn077-newarch-android`。
- 两种架构需要同时装到真机时，用独立构建 variant、scheme、缓存和安装标识区分。
- 每个有效矩阵槽位都跑同一套 deterministic deep link 场景，不能用两套测试内容掩盖差异。

最低编译矩阵：

| RN 时代 | 旧架构 | New Architecture |
| --- | --- | --- |
| RN 0.66 | 必须 | 上游不支持 |
| RN 0.77 | 必须 | 必须 |
| RN latest（当前固定为 0.87） | 上游不支持 | 必须 |

如果未来仍需要一个较新的双架构对照组，就新增第四个 App，固定在上游最后一个双架构
版本 RN 0.81。不要把 `latest` 改造成上游不支持的状态。

## 发行约束

三个时代的 App 都必须是可发行产品，不是用完即弃的 Demo：

- Android application ID 与 iOS bundle ID 相互独立；
- 可以复现的签名 release 构建；
- 有版本号的 APK/AAB 与 IPA/archive 产物；
- 每个目录页和 Playground 场景都有确定的 deep link；
- Settings 的 Build & Matrix Modal 明确展示 RN、React、平台、包版本与架构。

三个兼容版本是否都在公开应用商店单独上架，是后续产品决策。历史版本可以先通过
GitHub Releases、内部发行和 TestFlight 发放。

## 信息架构

三个 App 共用三个底部一级入口：

1. **Home**：直接展示 Ruban 支持的组件目录、状态和入口，不铺品牌说明文案。
2. **Playground**：集中承载设计样本、组件状态与确定性测试场景。
3. **Settings**：使用 Item Group 卡片组织 Appearance、单一 Build & Matrix 入口与 About。

About 不是一级 Tab。品牌、来源、版本、许可证、赞助与解决方案入口都归入 Settings
中的 About 分组。兼容矩阵归入 Build & Matrix Modal，避免把低频信息抬成一级导航或
在页面上平铺。

### 顶部安全区归属

每个 Screen 都必须且只能消费一次状态栏区域。新页面默认使用 `RubanScreen`，或使用
`react-native-safe-area-context` 并包含 top edge。React Navigation 自带 Header
可以成为安全区 owner；显式采用沉浸式设计的页面可以把背景绘制到状态栏后方，但工具栏、
交互控件与主体内容仍必须根据 `insets.top` 定位。

- 每条路由必须明确一个顶部安全区 owner：Navigation Header、路由 Frame 或沉浸式布局。
- 隐藏 Navigation Header 不代表页面内容可以从物理屏幕坐标零开始。
- 禁止使用 React Native 自带的 `SafeAreaView`；它不能提供这里需要的 Android
  edge-to-edge 契约，统一使用 `react-native-safe-area-context`。
- Header 已经消费顶部安全区时，页面不得再次增加 top inset。

### 底部安全区归属

底部安全区由导航路由壳统一决定，不允许每个页面自行猜测全面屏手势或经典三按钮模式。
Android 提供的 Window Insets 是唯一事实来源，导航模式变化后直接消费新的
`insets.bottom`。

- `tab-owned`：Main Tabs 页面不增加底部安全区；Tab Bar 统一使用
  `max(基础留白, insets.bottom)`，背景延伸覆盖整个系统导航区域。
- `screen-owned`：没有 Tab 的普通 Root Stack 页面由 Screen Frame 增加 bottom edge，
  页面内容只保留自己的设计留白。
- `edge-to-edge`：沉浸式媒体或画布页面由路由注册显式选择，不消费底部安全区。
- 同一条路由分支只能有一个 bottom inset owner，禁止 Tab Bar、Screen Frame 和页面
  同时补距离。
- 键盘遮挡属于 keyboard-aware 布局，不与系统导航安全区共用一套补偿值。

### 系统栏颜色归属

- App 根节点始终在透明系统栏后绘制 `surface-page`。
- 当前获得焦点的路由负责状态栏和导航栏图标明暗。Playground 暗色模式等页面局部主题
  只在该路由获得焦点时覆盖全局 Appearance。
- Android 15 及以上遵循平台强制 edge-to-edge；更早的系统通过对应 RN 时代可支持的
  原生接入方式主动开启。
- 手势导航区域保持透明；三按钮导航可以使用系统对比背景，但 App 布局仍只消费一次
  bottom inset。
- Modal 与 Sheet 在对应 RN 时代支持时开启系统栏透明。RN 0.66 保持状态栏透明，其余
  窗口兼容策略由小型原生模块负责。

### Settings 选择面与 Bottom Sheet

- Settings 中的多选偏好统一使用项目自有的 Bottom Sheet primitive，不把选择器交给
  Expo、设计系统 runtime 或不透明的第三方基础层。
- 列表行只展示名称、当前值和进入符号；Sheet 只展示标题、紧凑 meta、选中状态和关闭
  操作，不增加解释段落。
- Appearance 提供 `system` / `light` / `dark`，控制整个 App 的语义主题。Playground
  theme 是 Playground 页面自己的局部状态，只由顶部 Switch 与显式路由参数控制，
  不进入 Settings 或全局偏好上下文。
- Build 与 Support Matrix 不在 Settings 平铺。Settings 只保留一个 `Build & matrix`
  入口，点击后用可滚动的信息型 Bottom Sheet 展示 CURRENT BUILD 和 SUPPORT MATRIX。
- `ruban://settings?sheet=appearance` 与 `ruban://settings?sheet=build` 必须能在冷启动后
  直接复现对应 Sheet；`ruban://lab/design?theme=dark` 负责复现 Playground 局部主题。
- Sheet 支持遮罩点击、顶部 CLOSE 和 Android 系统返回关闭；底部只消费一次 safe-area
  inset。Appearance 当前是会话级状态，在引入持久化前不得向用户暗示“已保存”。
- 同一选择面必须在三个 Gongshu 时代分别通过类型检查、原生编译和真机截图；旧时代不
  使用 RN 0.66 尚未支持的布局属性来伪造一致性。

### Deep Link 安装身份

每个可同时安装的 App 只拥有一个 URL scheme。环境和 RN 时代都进入 scheme，因为
iOS 自定义 URL Scheme 注册后，系统不能再根据路径把链接分发给不同 App。

| 时代 | Production | Regression | Debug |
| --- | --- | --- | --- |
| latest | `ruban://` | `ruban-regression://` | `ruban-debug://` |
| RN 0.77 | `ruban-rn077://` | `ruban-rn077-regression://` | `ruban-rn077-debug://` |
| RN 0.66 | `ruban-rn066://` | `ruban-rn066-regression://` | `ruban-rn066-debug://` |

不同 scheme 复用相同路径，例如 `components/switch`、`settings?sheet=build`、
`lab/design?theme=dark`。Android 用 manifest placeholder、iOS 用 build setting 为每个
构建选中唯一 scheme；禁止恢复让多个安装包同时声明同一链接的共享别名。

## 视觉方向

采用 shadcn/ui 的方法，不照搬 Web 样式栈：

- 组件源码归项目所有，不依赖不透明的组件运行时；
- 优先组合，不制造参数巨大、什么都做的组件；
- 用语义化设计 token，不散落一次性数值；
- 默认可访问，同时允许按平台做自然调整；
- 不强制 NativeWind、CSS runtime、Expo module 或某个设计系统基础包。

Ruban 应该像一张现代而精确的工作台：

- 默认画布保持中性，不把淡黄色背景、棕色文字和朱砂色强调绑定成品牌公式；
- 品牌识别优先来自比例、字形、密度、对齐和交互反馈，颜色方案必须经过
  Playground 并排比较后再确定；
- 清晰字号层级、经过测量的间距、细边框和轻阴影；
- 能承载技术信息，但不做成管理后台；
- 用精确体现工匠感，不堆木纹、古典纹样或戏服式“中国风”；
- 动效只用于解释状态和因果，不做无意义装饰。

### 颜色主题结构

- light 与 dark 使用完全相同的 variant key，但每个模式独立决定实际色值；dark 不是
  light 的运行时反相。
- 当前 Playground 候选角色为 `ink`、`cobalt`、`signal`、`acid`，每个角色固定展示
  `100`、`75`、`30`、`15` 四级不透明度。
- `100` 用于实色主体，`75` 用于次级强调，`30` 用于选中或状态填充，`15` 用于弱背景；
  后三级保留真实 alpha，不预先与某个背景合成为不透明色。
- 同一个角色可以在 light 与 dark 下调整基色。例如 dark 的 cobalt、signal 和 acid
  会适度提亮，以保持相近的视觉权重。
- 主题表只保存颜色事实，组件再把颜色 variant 映射为 primary、status、surface 等
  语义角色；不要把某个业务用途写进基础色名。
- 当前色值通过语义映射用于 Gongshu App 的阶段性设计基线；Playground 继续负责比较和
  微调基础色与透明度，组件只消费语义色，不直接依赖基础 variant。
- 底部导航使用独立的 `surface-navigation` 与 `surface-navigation-active` 语义色。
  active 项是硬边整块背景，不再叠加重复的顶部指示线；light 与 dark 分别映射自己的值。

### 页面文案纪律

- 不在页面上铺说明文案。界面应先用层级、位置、标签、状态和控件自身说明用途。
- 标题下方不默认追加副标题，卡片下方不默认追加解释句，列表项不默认追加营销描述。
- 文案只有在帮助用户做决定、完成操作、理解风险或恢复错误时才有存在理由。
- 能用名称、数值、状态或示例表达的内容，不改写成完整说明段落。
- 每个页面在实现前必须明确文案预算；删掉一句不影响理解，就应该删掉。
- Playground 可以使用样本文字展示字形与排版，但样本文字不承担产品说明职责。

## 品牌识别核心

Ruban 不可变的几何锚点是透明、1254×1254 的
[`brand/ruban-ruler-angle-r.png`](./brand/ruban-ruler-angle-r.png)：已选定的“`R` +
`RUBAN`”竖版署名。其中稳定的识别符是 **Ruler Angle R**：一个精确的大写 `R`，有经过
测量的上半圆、斜腿、完整尺寸版本左竖上的三道校准缺口，以及内侧的一枚小 cobalt 蓝对齐三角。其构造
必须有结构感而不显笨重：上半圆外弧与内腔回转上下竖向对齐、连续平滑，R 的两条腿之间必须保留
清晰且充足的留白。右斜腿
从下半圆到基线的内外边应近似平行、等宽，不能收尖或折断。蓝色
三角放在干净竖腿与斜腿之间自然形成的三角负空间中，绝不能通过切割、蒙版或白色描边
去破坏主体 R；不得额外添加刻度。它用“精确”同时表达尺、工具和工场，不把鲁班做成字面的
木工图案。不得加入木纹、锤子、锯、
凿、印章、书法、丝带、React atom、泛 AI 图形、渐变或装饰特效。

该 PNG 是不可变的视觉与供稿参考，但不直接用作平台导出母版。透明的
[`brand/ruban-core.svg`](./brand/ruban-core.svg) 是已经确认的核心矢量母版，直接描摹自该参考图。
所有派生版都必须保留它的路径；如有重新生成，必须先与 PNG 叠图比对。不得再凭手感把 `R`
调离任一核心资产。主图形固定为 Ruban acid 黄 `#d9ff45`，内侧
对齐三角则是识别关键的 cobalt 蓝 `#2563eb`。黄色刻意与现有产品
的 `acid-100` 色相对齐，但不是产品语义状态。默认黄图形应放在墨黑或其他足够深的底上，
不可当作浅色表面的文字色。明确的深色呈现版本是
[`brand/ruban-core-dark.svg`](./brand/ruban-core-dark.svg)：黑色 `#101114` 底、纯白
`#ffffff` 图形和提亮 cobalt `#4c8dff` 三角。蓝色三角是完整尺寸标志必须保留的识别点，
不是可随意去掉的状态色；16–24 px 微标是有意采用单色的例外，其他单色技术制版也仅在
无法使用双色油墨时才省略三角。

同一套几何根据场景组成不同版本：

- App 和小程序图标只用符号；深色圆角图标参考
  [`brand/ruban-app-icon-dark.svg`](./brand/ruban-app-icon-dark.svg)；
- 16–24 px favicon 使用简化的一色版
  [`brand/ruban-mark-micro.svg`](./brand/ruban-mark-micro.svg)，不能把三道校准缺口
  直接缩小成噪点；
- 网站导航使用横版：符号在左，右侧是大写 `RUBAN`，共用一条视觉基线；符号为 28 px
  时，净间距为 10 px，不使用上下堆叠；矢量源文件为
  [`brand/ruban-lockup-horizontal.svg`](./brand/ruban-lockup-horizontal.svg)；
- 封面或发布页面可以使用“符号在上、`RUBAN` 在下”的竖版；矢量源文件为
  [`brand/ruban-lockup-stacked.svg`](./brand/ruban-lockup-stacked.svg)。

符号负责识别，`RUBAN` 负责正式署名；它们的组合不是另一枚 Logo。品牌黄是稳定的识别
选择，不是 live/status 等产品状态；不要通过改变 Logo 几何或颜色去表达 App 状态。

多种移动端分发包同机安装时，只通过 App 图标底色区分：正式版使用墨黑底和白色符号，
回归版使用 acid 黄底和墨黑符号，调试版使用浅 cobalt 蓝底和墨黑符号。所有版本都保留
cobalt 蓝三角，不增加角标，也不改变 Ruler Angle 的几何。原生开屏不重复环境信号，统一
使用墨黑底，以及严格居中的 84 pt/dp acid 黄 / cobalt 蓝静态核心符号。原生开屏生命周期
持续持有同一画面，导航就绪后直接撤下；不再叠加第二个 React Logo，也不添加自定义动画，
仅保留八秒超时兜底以避免启动永久阻塞。`brand/mobile-assets.json` 与
`scripts/brand/generate-mobile-assets.mjs` 共同管理所有移动端生成素材，平台输出不得手改。

涉及品牌资产时，先读取设计路由
[`skills/ruban-design/SKILL.md`](./skills/ruban-design/SKILL.md) 与其
[`ruban-brand-identity` 子 skill](./skills/ruban-brand-identity/SKILL.md)。上述已选 PNG
刻意作为不可变的视觉与供稿参考纳入仓库；`ruban-core.svg` 则是核心矢量母版。其他探索 PNG
仍只用于决策。

## 组件展示页规范

Home 是组件目录；每个可用组件进入独立展示页。展示页既是产品文档，也是确定性
真机测试场景，不再把组件状态塞进一个无限增长的通用 Playground。

组件详情属于 Main Tabs 之外的 Root Stack 层级。进入详情后隐藏整个底部 Tab Bar，
用全屏切换和明确的顶部返回入口表达“目录 → 详情”。从目录进入时返回原目录；通过
deep link 冷启动时，顶部返回和 Android 系统返回都落到 Components 首页。不要用
`display: none` 临时隐藏 Tab，否则视觉层级、导航状态和转场语义会互相矛盾。

每个展示页固定包含这些层次：

1. **身份**：组件名、编号、类别、交付方式和状态。交付方式只分 `SOURCE` 与
   `PACKAGE`，避免把 App 内源码组件误写成已发布包。
2. **LIVE**：页面首屏提供一个真实可操作实例，并紧邻组件自身的关键控制项。
3. **能力面**：按组件需要展示 variants、states、sizes、tones、anatomy 或 composition；
   不为凑齐栏目制造不存在的概念。
4. **CONTRACT**：只列可验证事实，例如运行时依赖、bare RN、架构和交互边界。
5. **DEEP LINK**：主题和关键状态必须进入参数，同一个链接可在冷启动后复现相同画面。

展示页的 light/dark 切换只影响当前样本，并同步更新 deep link。页面不铺使用说明；
标签、控件、实物状态和数据表就是文档。新的组件先在 `gongshu-latest` 完成这套页面，
再把同一场景移植到 RN 0.77 与 0.66。

source-owned 组件以 `registry/native` 作为唯一 canonical registry。同步脚本把源码复制为
三套 Gongshu 应用各自提交到仓库的文件，并按目标应用自己的 Prettier 规则格式化。它不引入
共享运行时、workspace 依赖或软链接；`pnpm registry:check` 负责阻止副本漂移，而各时代的
导航、原生依赖和产品表达仍归各应用独立维护。

第一批 source-owned primitive 定义如下：

- **Button**：`primary`、`secondary`、`outline`、`ghost`、`destructive` 五种 variant，
  `sm`、`md`、`lg` 三种 size，并覆盖 pressed、loading、disabled、full-width 状态。
- **Card**：保持静态、可组合；由 Header、Title、Description、Action、Content、Footer、
  Meta 组成，并用 `default`、`muted`、`selected`、`alert`、`live`、`contrast` 表达语义 tone。
- **Badge**：提供 `default`、`secondary`、`outline`、`destructive`、`live` 五种 variant
  与 `sm`、`md` 两种 size；标签保持单行，运行时依赖为零。
- **Separator**：支持 horizontal / vertical、`default` / `strong` / `accent` tone，以及
  hairline / regular / bold 粗细；默认只承担装饰作用，不进入无障碍树。
- **Switch**：由 `checked` 与 `onCheckedChange` 完全受控，提供 `sm`、`md` 两种 size，
  保证最小 44pt 触控区，并明确暴露 switch 语义和 disabled 状态。
- **Form Kit**：`Field` 统一承载 required、description、error、disabled 与 invalid 语义；
  `Input`、`Textarea` 自动继承状态；`Checkbox`、`RadioGroup`、`Select` 保持受控。
  `Select` 使用 source-owned 的纯 React Native Bottom Sheet，不增加外部运行时依赖。

`ruban://components/form` 打开组合式 Form Workbench。它是 recipe 而不是新的 primitive：
六个 Form Kit 组件共同完成一次校验与提交，并暴露确定性的 `form-workbench-saved` 状态，
供真机 smoke 验证实际状态转换。

## Agent 设计契约

Agent 不能每写一个页面就临场发明一套视觉语言。

1. 写 JSX 前，先写清信息层级、组件清单和页面文案预算。
2. 先删除解释性文案，再证明剩余每句话为什么必须存在。
3. 先在 `gongshu-latest` 做出一个 golden screen。
4. 关键状态必须能由 deterministic deep link 直接到达。
5. 为明暗模式和关键设备尺寸保留参考截图。
6. 固定检查层级、密度、对齐、触控面积、对比度、截断，以及 loading、empty、
   error、disabled 和平台差异状态。
7. 人类确认后的反馈，先沉淀成 token、pattern 或明确的 do/don't，再继续扩页面。
8. 优先组合已有 primitive；新增 primitive 时说明为什么旧能力不够。
9. latest 版本通过后再移植到 0.77 和 0.66，并检查截图差异，不接受“大概长得一样”。

长期设计资产至少包括：语义 token、复用 pattern、参考截图和确定的场景定义。对 Agent
来说，这些是可以执行的约束，不是只负责营造气氛的 mood board。
