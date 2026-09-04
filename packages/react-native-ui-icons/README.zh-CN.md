# @ruban-labs/react-native-ui-icons

适用于 bare React Native 0.66 及以上版本的主题感知 SVG 图标。

## 安装

```sh
pnpm add @ruban-labs/react-native-ui-icons react-native-svg
pnpm add -D react-native-svg-transformer
```

在 Metro 中将 `svg` 作为源码交给 `react-native-svg-transformer/react-native`，
使用时传入语义主题色：

```tsx
import { RefreshIcon } from "@ruban-labs/react-native-ui-icons";

<RefreshIcon size={20} color={colors.accent} />;
```

所有图标都使用 `currentColor`，组件内部不绑定固定配色。
新增资源可以来自普通 SVG，但必须先把语义前景色归一化为 `currentColor`，
并将发布文件重命名为 `*-cc.svg`。

[English](./README.md)
