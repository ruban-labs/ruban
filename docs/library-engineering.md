# Ruban Library Engineering Contract

Ruban packages are focused tools for bare React Native. The package, consumer fixtures, Gongshu apps, and release archive are one product surface.

## Compatibility

- React Native floor: `0.66.0`.
- React floor: `17.0.0`.
- Published packages must not require Expo, Nitro, NativeWind, or another foundation runtime.
- Architecture support follows React Native itself. JavaScript-only packages must work in both architectures whenever that RN era supports both.

## Package shape

- `react-native` resolves to owned TypeScript source for Metro.
- `main`, `module`, and `types` resolve to generated CommonJS, ESM, and declaration output.
- `exports` preserves the React Native source condition, declarations, and a safe CommonJS default. The legacy `module` field remains available to bundlers without pretending its `.js` output is Node-native ESM.
- Every refurbishment carries a `NOTICE` file. Public history describes upstream provenance without referring to private applications or repositories.
- Runtime dependencies are declared explicitly. Packages marked `zero-dependency` must keep `dependencies` empty.

## Verification ladder

1. Unit tests cover behavior, accessibility state, and exports.
2. Consumer fixtures type-check against RN 0.66, RN 0.76, and latest.
3. Metro bundles the packed tarballs in each era.
4. Every valid native architecture cell compiles in its standalone Gongshu app.
5. Deterministic deep links reproduce the package's primary states on real devices.

The standalone apps keep independent package managers, lockfiles, native projects, and `node_modules`. They consume locally packed tarballs rather than a hoisted workspace package.

## Release

- Changesets own package version changes.
- `npm pack` output is inspected before publication.
- Public packages use provenance-ready metadata and `publishConfig.access=public`.
- npm publication is a separate, explicit operation after the package and matrix are green.
