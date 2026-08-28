# Gongshu Release Engineering

Gongshu uses four explicit runtime/build lanes:

- `dev`: Metro-backed UI iteration; never a performance baseline.
- `release-fast`: release runtime with content-keyed Metro and native caches.
- `release-clean`: clean high-order outputs while retaining dependency downloads.
- `release-repro`: two isolated no-build-cache runs whose payload and source-map hashes must match.

Package one valid matrix cell from the repository root:

```bash
pnpm gongshu:package \
  --app 0.76 \
  --platform android \
  --arch new \
  --mode release-fast
```

`0.66` infers `old`; `latest` infers `new`. The `0.76` app requires an explicit
`--arch old|new` selector. Invalid architecture cells fail before Gradle or Xcode runs.

Android can install and verify the produced release package on a real device in one command:

```bash
pnpm gongshu:package \
  --app 0.66 \
  --platform android \
  --mode release-fast \
  --device <adb-serial>
```

The runtime health deep link verifies three facts from the running package: release mode,
Hermes, and the expected architecture. A successful run updates `manifest.json` from
`runtimeVerified: false` to `true`.

## Cache Location

The default cache root is `.cache/release` inside the Ruban checkout. Because the checkout
currently lives on the external development volume, this avoids consuming the internal disk.

Override it with `RUBAN_BUILD_CACHE_ROOT`. A path under `/Volumes/<name>` fails before build
when that volume is not mounted; it never silently creates a replacement cache elsewhere.

Each native configuration key owns Gradle transforms and build-cache state; ordinary JS/TS edits
do not create another Gradle home. Wrapper distributions and dependency metadata/artifact bytes
are linked from `RUBAN_GRADLE_MIRROR` (default: `~/.gradle`) so a new native key does not redownload
multi-gigabyte toolchains and Maven files.

iOS package commands also use an isolated `ios-home` below the same cache root. React Native
prebuilt tarballs and CocoaPods state therefore stay on the configured development volume instead
of silently growing `~/Library/Caches` on the internal disk.

## iOS Simulator Matrix

The local iOS release lane builds universal `arm64`/`x86_64` Simulator apps with signing disabled:

```bash
pnpm gongshu:package --app 0.66 --platform ios --mode release-fast
pnpm gongshu:package --app 0.76 --platform ios --arch old --mode release-fast
pnpm gongshu:package --app 0.76 --platform ios --arch new --mode release-fast
pnpm gongshu:package --app latest --platform ios --mode release-fast
```

All four cells are validated on Xcode 26.3 with Hermes bytecode and composed source maps. Their
manifests use the `simulator-unsigned` signing class; an ad-hoc Simulator signature does not contain
a Team ID, provisioning profile or device-install entitlement.

RN 0.76 and newer use React Native's `scripts/bundle.js` entry, while RN 0.66 retains the legacy
`cli.js` entry. RN 0.76's fixed-tag third-party source Pods are fetched as official GitHub codeload
tarballs so CocoaPods can cache archives instead of relying on Git clones. RN 0.66 release builds
raise the app deployment target to iOS 12.4, disable the obsolete bundled Flipper lane, and accept
the Hermes 0.9 source-map output location used by current Xcode tooling.

## Metro Policy

The React Native bundling command is wrapped only when the release dispatcher runs:

- `release-fast` removes `--reset-cache` and uses a content-keyed `TMPDIR`.
- `release-clean` and `release-repro` force `--reset-cache`.
- ordinary `react-native run-*` and Metro development commands keep their original behavior.

RN 0.66's legacy Gradle `Exec` bundle task is incompatible with Gradle 8 state tracking. The
dispatcher therefore creates the Metro bundle, optimized Hermes bytecode and composed source map
before Gradle, then gives Gradle generated asset/resource directories. Native Gradle tasks remain
tracked and cacheable while `release-fast` reuses the content-keyed prebundle.

## Artifacts

Outputs live under:

```text
artifacts/<app>/<platform>/<architecture>/<mode>/<content-key>/
```

Each output includes the package/app, source map and `manifest.json`. The manifest records the
commit and dirty state, matrix cell, Hermes assertions, toolchains, cache key, signing class and
hashes without absolute paths or signing credentials.

Android reproducibility records both the raw APK hash and a normalized payload hash. Development
APK signing may produce a different APK Signing Block on each run, so the gate excludes only that
block, normalizes the central-directory offset, and still hashes every packaged entry plus ZIP
metadata. The manifest reports raw, payload, signing-block and source-map hashes separately; a raw
APK mismatch never passes unless payload and source-map hashes both match.
