# Ruban Labs

Small, sharp React Native tools. Named after **Lu Ban** (鲁班), the legendary
master craftsman - the **R** stands for React.

> **Measure with the ruler. Build with the tools.**

Two surfaces, one program:

- **The ruler** - [awesome-native-react](https://github.com/richardo2016/awesome-native-react):
  a machine-audited index of the React Native ecosystem. Every library measured
  for maintenance health and new-architecture readiness, every two days.
- **The tools** - this monorepo: focused, dependency-free React Native libraries.
  One tool does one thing, to the extreme.

## Charter

**Bare React Native first. No platform dependency.** Every library here must
work in a bare RN project out of the box: `react` and `react-native` as the
only peers, zero runtime dependencies, no Expo Modules, no Nitro runtime, no
config plugins required. Expo compatibility is a welcome by-product, never a
requirement.

## Packages

| Package | Status | Description |
| --- | --- | --- |
| [`@ruban-labs/react-native-progress`](./packages/react-native-progress) | v6.0.0 | Progress bars, segmented rings, pies, spinners. Zero-dependency refurbishment of `react-native-progress`. |

## Repository layout

```
packages/          one directory per published package
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
