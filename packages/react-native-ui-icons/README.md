# @ruban-labs/react-native-ui-icons

Theme-aware SVG icons for bare React Native 0.66 and newer.

## Install

```sh
pnpm add @ruban-labs/react-native-ui-icons react-native-svg
pnpm add -D react-native-svg-transformer
```

Configure Metro to treat `svg` as source and use
`react-native-svg-transformer/react-native`, then pass a semantic theme color:

```tsx
import { RefreshIcon } from "@ruban-labs/react-native-ui-icons";

<RefreshIcon size={20} color={colors.accent} />;
```

Every icon uses `currentColor`; no palette is embedded in the component.
New assets may start from ordinary SVG files, but their semantic foreground
must be normalized to `currentColor` and the published file renamed to
`*-cc.svg`.

[简体中文](./README.zh-CN.md)
