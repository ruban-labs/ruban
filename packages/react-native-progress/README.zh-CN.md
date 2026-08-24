# @ruban-labs/react-native-progress

React Native 进度指示器与加载动画组件库。

- **零运行时依赖**——只依赖裸 React Native 本体。不需要 `react-native-svg`、ART 或任何平台套件。
- **裸 RN 优先**——在全新的 `@react-native-community/cli` 工程里开箱即用，零配置。
- **新架构就绪**——纯 JS 组件，无原生模块，无 codegen。
- **TypeScript 严格模式**——全量类型化 props，默认值合理。

本库翻新自 Joel Arvidsson 的经典
[react-native-progress](https://github.com/oblador/react-native-progress)（MIT），
为现代 React Native 时代重写。来源追溯见 [NOTICE](./NOTICE)。

> **以尺量生态，以工具造生态。** —— Ruban Labs

## 安装

```sh
npm install @ruban-labs/react-native-progress
# 或
pnpm add @ruban-labs/react-native-progress
```

要求 `react-native >= 0.66`、`react >= 17`。见[版本支持](#版本支持)。

## 组件速览

### Bar 进度条

```tsx
import { Bar } from '@ruban-labs/react-native-progress';

<Bar progress={0.6} />
<Bar indeterminate color="#34c759" />
```

### Circle 进度环

分段式进度环，见[渲染说明](#渲染说明)。

```tsx
import { Circle } from '@ruban-labs/react-native-progress';

<Circle progress={0.7} showsText size={80} thickness={6} />
<Circle indeterminate color="#ff9500" />
```

### Pie 扇形进度

```tsx
import { Pie } from '@ruban-labs/react-native-progress';

<Pie progress={0.45} size={64} unfilledColor="#f0f0f0" />
```

### CircleSnail 蜗牛加载

不确定态加载器：旋转环 + 伸缩彗尾。

```tsx
import { CircleSnail } from '@ruban-labs/react-native-progress';

<CircleSnail color={['#ff3b30', '#ff9500', '#34c759']} />
```

## 属性文档

完整属性表见 [英文 README](./README.md#api)，两个版本保持同步。

## 版本支持

支持下限为 `react-native >= 0.66` / `react >= 17`。组件是纯 JavaScript，
在旧架构和新架构上行为完全一致——支持庞大的存量项目不花任何代价。
这个区间正好覆盖生态的几次关键分界：

| RN 版本 | 分界 |
| --- | --- |
| 0.68 | 新架构首次可选（Fabric / TurboModules） |
| 0.70 | Hermes 成为默认引擎 |
| 0.71 | TypeScript 成为默认模板 |
| 0.76 | 新架构成为默认 |
| 0.79 | React 19 |

发布产物使用保守语法（无可选链、无空值合并），保证在不转换
`node_modules` 的老 Metro/JSC 环境里也能解析；类型定义兼容
`@types/react` 17+。

## 渲染说明

原版库用 `react-native-svg` 绘制 `Circle`、`Pie`、`CircleSnail`。本翻新版为了保持零依赖：

- **Pie** 用裁剪 + 旋转半圆盘实现——几何上完全精确，动画完整，透明背景保留。
- **Circle** 和 **CircleSnail** 渲染为**分段环**（离散的圆头段）。用 `segmentCount`
  调节密度。这是刻意的品牌宪法决策：不引入 SVG 依赖、保留透明中心，代价是不再是
  原版的平滑圆弧观感。

## 从 `react-native-progress` 迁移

```diff
- import * as Progress from 'react-native-progress';
+ import { Bar, Circle, Pie, CircleSnail } from '@ruban-labs/react-native-progress';
```

- 上文文档化的 prop 面保持兼容。
- 不再需要 `react-native-svg`——没有其他地方用的话可以移除。
- Circle 渲染从平滑 SVG 圆弧变为分段环。
- 本包从 `6.0.0` 起步；原版止于 `5.x`。

## 开发

```sh
pnpm install
pnpm typecheck   # 严格 TS
pnpm test        # jest + @testing-library/react-native
pnpm build       # react-native-builder-bob（commonjs、module、typescript）
```

## 许可证

MIT——见 [LICENSE](../../LICENSE) 与 [NOTICE](./NOTICE)。
