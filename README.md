# Ruban Labs

Small, sharp, foundation-independent React Native tools. Named after **Lu Ban** (鲁班), the legendary
master craftsman - the **R** stands for React.

> **Measure with the ruler. Build with the tools.**

Product direction, the Gongshu compatibility matrix, and the shared visual
contract live in [DESIGN.md](./DESIGN.md) ([简体中文](./DESIGN.zh-CN.md)).
The long-term wallet direction and its gated first-release plan live in the
[EVM Wallet V1 roadmap](./docs/wallet-v1-roadmap.md)
([简体中文](./docs/wallet-v1-roadmap.zh-CN.md)).

Three surfaces, one program:

- **The ruler** - [awesome-native-react](https://github.com/richardo2016/awesome-native-react):
  a machine-audited index of the React Native ecosystem. Every library measured
  for maintenance health and new-architecture readiness, every two days.
- **The tools** - this monorepo: focused, dependency-free React Native libraries.
  One tool does one thing, to the extreme.
- **The product** - Ruban Mobile: an open-source, native-speed EVM wallet and
  DApp workbench. Security is an engineering baseline; inspectability and
  measurable speed are the public promise.

## Charter

**Bare React Native first. No platform dependency.** Every library here must
work in a bare RN project out of the box, keep runtime dependencies at zero,
and avoid Expo Modules, Nitro runtime, or required config plugins. Additional
native peers are rare, explicit, and package-specific. Expo compatibility is a
welcome by-product, never a requirement.

## Packages

| Package | Status | Description |
| --- | --- | --- |
| [`@ruban-labs/react-native-progress`](./packages/react-native-progress) | v6.0.0 | Progress bars, segmented rings, pies, spinners. Zero-dependency refurbishment of `react-native-progress`. |
| [`@ruban-labs/react-native-collapsible`](./packages/react-native-collapsible) | v2.0.0 | Focused expand/collapse and accordion primitives. |
| [`@ruban-labs/react-native-ui-theme`](./packages/react-native-ui-theme) | 0.1.0, incubating | Semantic colors, spacing, radii, provider, and hooks. |
| [`@ruban-labs/react-native-ui-overlay`](./packages/react-native-ui-overlay) | 0.1.0, incubating | A single native Modal host with queue, stack, and replace policies. |
| [`@ruban-labs/react-native-ui-dialog`](./packages/react-native-ui-dialog) | 0.1.0, incubating | Composable dialogs built on the Theme and Overlay peers. |
| [`@ruban-labs/react-native-ui-sheet`](./packages/react-native-ui-sheet) | 0.1.0, incubating | Bottom sheets and selection sheets with an explicit Safe Area peer. |
| [`@ruban-labs/react-native-ui-form`](./packages/react-native-ui-form) | 0.1.0, incubating | Field, Input, Textarea, Checkbox, RadioGroup, and Select controls. |
| `@ruban-labs/react-native-wallet-core` | In development | Native EVM key derivation, vault, and signing with a Rust core. |
| `@ruban-labs/react-native-evm-client` | In development | Fast RPC selection, batching, normalization, and portfolio primitives. |
| `@ruban-labs/react-native-dapp-bridge` | In development | Preloaded EIP-1193 content script and typed WebView host bridge. |
| `@ruban-labs/react-native-animatable` | Planned | Small declarative animation vocabulary. |
| `@ruban-labs/react-native-keyboard-aware-scroll-view` | Planned | Reliable keyboard-aware layout and scrolling. |

## Repository layout

```
packages/          one directory per published package
apps/              independent Gongshu apps for each RN era
.changeset/        changesets versioning config
.github/workflows  CI (typecheck, test, build)
```

## Development

Requires Node >= 20 and pnpm.

```sh
pnpm install
pnpm typecheck     # strict TS across all packages
pnpm test          # jest suites
pnpm build         # react-native-builder-bob per package
```

## License

MIT - see [LICENSE](./LICENSE). Individual packages carry provenance notices
where they refurbish prior MIT work.
