# @ruban-labs/react-native-ui-theme

Semantic colors, spacing, radii, and a small theme provider for bare React Native.

[简体中文](./README.zh-CN.md)

```sh
npm install @ruban-labs/react-native-ui-theme
```

```tsx
import {RubanThemeProvider, useRubanColors} from '@ruban-labs/react-native-ui-theme';

function App() {
  return <RubanThemeProvider mode="dark"><Screen /></RubanThemeProvider>;
}
```

Without a provider, `useRubanColors` follows the system color scheme. The package supports React
Native 0.66+ and has no runtime dependencies beyond React and React Native peers.

## License

MIT
