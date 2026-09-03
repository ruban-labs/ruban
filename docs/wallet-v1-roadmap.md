# Ruban EVM Wallet V1 Roadmap

[简体中文](./wallet-v1-roadmap.zh-CN.md)

This roadmap turns Ruban into a real self-custodial EVM DApp workbench while
producing a reusable bare React Native package. Progress is controlled by
capability and security gates, not dates or screen count. A phase may begin in
parallel, but it cannot be called complete until its exit gate is proven.

Every release records three separate performance budgets: build, runtime, and
data synchronization. Improving one budget must not hide a regression in
another.

## V1 Product Contract

V1 includes:

- EVM externally owned accounts;
- mnemonic creation and import, private-key import, account derivation, and
  watch-only addresses;
- an encrypted local vault protected by platform facilities and optional user
  presence;
- native transaction and message signing;
- WalletConnect as an external signer and session transport;
- an EIP-1193 provider for DApps running in the owned WebView surface;
- origin-scoped account and chain permissions;
- human-readable confirmation for supported messages and transactions;
- configurable EVM networks and RPC endpoints;
- a cache-first portfolio for native assets and selected ERC-20 assets, with
  fiat estimates, source attribution, freshness, and incremental refresh;
- local activity and deterministic deep links for testing.

V1 excludes:

- non-EVM chain families;
- smart accounts and account abstraction;
- hardware wallets;
- cloud mnemonic backup or account recovery services;
- swaps, bridges, staking, fiat on-ramp, exchange, DeFi positions, profit and
  loss analytics, and NFT products;
- blind signing and the ambiguous `eth_sign` method;
- arbitrary native capability exposure to loaded DApps.

The first release is distributed directly and to a controlled tester group.
App Store and Google Play listing work may continue independently, but store
approval is not an architecture requirement for V1.

## Target Package Shape

The implementation has three boundaries:

```text
Rust wallet core
    ↓ stable C ABI
iOS and Android vault/platform wrappers
    ↓ Legacy Native Module / TurboModule adapters
@ruban-labs/react-native-wallet-core
    ↓ opaque identifiers and public results only
Ruban application and DApp runtime
```

- The Rust core has no React Native dependency.
- Platform wrappers own Keychain/Keystore integration, user-presence policy,
  lifecycle locking, and native secret-entry surfaces.
- The React Native package supports bare projects without Expo Modules, Nitro,
  or another required foundation runtime.
- Cryptographic libraries are pinned, license-reviewed, provenance-recorded,
  and compiled into the native artifact. They are not reimplemented by Ruban.
- The package targets RN 0.66 Legacy Architecture, RN 0.77 Legacy and New
  Architecture, and the latest supported New Architecture release.

## App Structured Data Layer

The Ruban App uses `@op-engineering/op-sqlite` as its sole SQLite connection
implementation and TypeORM for TypeScript-side queries. An App process owns one
global `DataSource` and one initialization promise; Fast Refresh must not open a
second connection to the same database.

- Before the first release, maintain one editable baseline schema without a
  migration class or migration table. Reset test data when that baseline
  changes.
- After a real release freezes its schema, later schema changes may add TypeORM
  migrations only from that published baseline. Production always keeps
  `synchronize` disabled.
- Public account metadata, selected-account state, portfolio caches, DApp
  permissions, and activity indexes use structured tables. Querying, sorting,
  and filtering go through repositories or query builders rather than KV JSON
  lists.
- Mnemonics, private keys, and derived seeds remain inside the native vault.
  SQLite stores no plaintext secret and does not replace Keychain or Keystore.
- The default connection uses WAL, `synchronous=NORMAL`, and a bounded busy
  timeout. One-off user writes use transactions; future bulk synchronization
  adds coalescing, cancellation, batch limits, and timing diagnostics.
- A future C++ synchronizer may write the same database through OP-SQLite's
  native interface, but it must consume a published schema version, transact
  every write, and notify the JS query layer after commit. Native code never
  migrates the schema independently.

## Phase 0 — Freeze Boundaries

Deliverables:

- product contract and explicit non-goals;
- threat model covering a malicious DApp, compromised RPC, hostile clipboard,
  rooted/jailbroken device, logs, crash reports, backups, screenshots, and a
  compromised React Native JavaScript context;
- native/JavaScript data-flow diagram;
- allowlisted signing and RPC method table;
- dependency and license evaluation criteria;
- versioned vault format and deletion/recovery semantics.

Exit gate:

- every secret-bearing value has one documented owner and lifetime;
- no required user flow depends on returning a mnemonic or private key to JS;
- unsupported signing requests fail closed before implementation begins.

## Phase 1 — Prove the Rust Core

Build an in-memory, persistence-free core first:

- BIP-39 mnemonic handling;
- BIP-32/BIP-44 EVM derivation with explicit path and account index;
- secp256k1 public key and signature operations;
- Keccak-256 and checksummed EVM addresses;
- legacy and EIP-1559 transaction parsing and serialization;
- EIP-191 personal messages and EIP-712 typed data;
- stable, versioned C ABI with owned-buffer and error contracts.

Verification:

- official and independently sourced test vectors;
- differential results against at least two mature reference implementations;
- property tests and fuzzing for parsers, serializers, and ABI inputs;
- malformed-input and cross-chain replay cases;
- baseline benchmarks for derivation, parsing, and signing.

Exit gate:

- deterministic results match every accepted vector and reference;
- fuzzing finds no crash, out-of-bounds access, or unbounded allocation in the
  agreed run budget;
- the ABI exposes no secret through errors, debug output, or ownership bugs.

## Phase 2 — Build the Native Vault

Add platform persistence without React Native:

- random data-encryption key per vault;
- authenticated encryption for seed/private-key records;
- wrapping key protected by iOS Keychain and Android Keystore;
- biometric/passcode user-presence option with a defined fallback policy;
- automatic lifecycle lock, explicit lock, destructive delete, and interrupted
  write recovery;
- native mnemonic/private-key entry and mnemonic confirmation surfaces;
- memory zeroization where the selected libraries and platforms permit it.

The Secure Enclave and Android Keystore are used to protect wrapping keys; V1
does not assume they can directly store or sign with an imported EVM key.

Exit gate:

- app storage, JS heap, AsyncStorage, logs, clipboard, crash metadata, and
  screenshots contain no secret material during the test scenarios;
- interrupted writes recover to the previous complete state or a locked,
  diagnosable state, never a partially accepted vault;
- delete removes all owned encrypted records and platform wrapping keys.

## Phase 3 — Publish the React Native Boundary

Create `@ruban-labs/react-native-wallet-core` around opaque handles:

- create/import flows return `vaultId` and public account descriptors;
- list, derive, rename, lock, unlock, and delete operations use opaque IDs;
- signing accepts a structured request and returns only its public result;
- errors use stable codes and redacted messages;
- Legacy Native Module and TurboModule adapters share the same native core;
- app lifecycle and concurrent requests have one serialized vault policy.

Verification matrix:

- RN 0.66 old architecture;
- RN 0.77 old architecture;
- RN 0.77 new architecture;
- RN latest new architecture;
- Android and iOS compile, package, install, and deterministic native scenarios.

Exit gate:

- packed-tarball consumers pass every valid matrix cell;
- one scenario produces the same address and signature result in every cell;
- bridge cancellation, reload, backgrounding, and process restart cannot leave
  the vault unintentionally unlocked.

## Phase 4 — Build the Portfolio Data Engine

Make speed observable before adding DApp breadth:

- render the latest complete local snapshot before network hydration;
- query native balances directly and selected ERC-20 balances through batched
  calls where the network supports them;
- keep token discovery and fiat prices behind replaceable indexer adapters;
- refresh networks concurrently with per-host limits, cancellation, request
  coalescing, and stale-response rejection;
- record provider latency, freshness, source, and failure without exposing
  account data to unrelated services;
- keep watch-only addresses on the same read path as signing accounts.

Exit gate:

- an offline launch renders the last complete snapshot without waiting for a
  request or unlocking a vault;
- a refresh never replaces newer data with an older response;
- every displayed amount names its chain, block or observation time, and data
  source;
- cold-start, cached-first-paint, chain-refresh, and full-refresh budgets are
  measured on the reference devices.

## Phase 5 — Build the DApp Runtime

Turn the latest Gongshu app into the primary Ruban product:

- curated DApp catalogue, recents, favourites, and controlled custom URLs;
- owned WebView wrapper with HTTPS-first navigation policy;
- a separately published TypeScript bridge package that injects its static
  EIP-1193 provider before page content runs;
- strict message schema, origin binding, navigation/session nonce, timeouts,
  request limits, and unsupported-method rejection;
- independent app and browser RPC lanes; browser origin/session metadata stays
  local and is never forwarded to public RPC endpoints;
- per-origin account, chain, and capability grants;
- local signer and WalletConnect connector behind one signer interface;
- configurable RPC with chain-ID verification and mismatch handling.

The WebView is adversarial. It never receives native platform APIs, vault
handles that can be reused as authority, or account access before an explicit
grant.

Exit gate:

- origin changes invalidate the previous page authority;
- a DApp cannot obtain accounts or request a signature without the matching
  permission and visible user action;
- malformed, duplicated, replayed, backgrounded, and cross-origin requests are
  rejected deterministically.

## Phase 6 — Make Signing Understandable

Build product confirmation and recovery surfaces with Ruban UI packages:

- connect-account and chain-permission sheets;
- message, typed-data, and transaction confirmation screens;
- canonical origin, account, chain, recipient, value, fee, nonce, and decoded
  call information where supported;
- an explicit unsupported/opaque-data state that refuses local signing rather
  than presenting blind hex as safe;
- submission state, replacement/failure state, local activity, and revocation;
- concise risk copy only where it changes a decision or recovery action.

Exit gate:

- every locally supported signature type has a dedicated deterministic review
  scenario;
- displayed fields are derived from the exact bytes passed to the signer;
- changing any reviewed field changes or invalidates the final signing payload.

## Phase 7 — Harden and Distribute

Release preparation includes:

- dependency SBOM, license report, source and binary provenance;
- reproducible unsigned core artifacts and content hashes;
- static analysis, fuzzing, sanitizer runs, and secret-redaction checks;
- Android 16 KB compatibility and supported-device routing;
- old/new architecture and RN-era release matrix;
- real-device cold start, vault recovery, DApp connection, signing, submission,
  backgrounding, upgrade, and uninstall scenarios;
- privacy policy, security model, vulnerability reporting, and recovery guide;
- independent review before claiming production security or broadening access.

Exit gate for the controlled V1 release:

- all security-critical tests are green on both platforms;
- no open critical or high-severity issue affects secret ownership or signing;
- a clean installation can complete the primary DApp flow without developer
  tools, Metro, sample data, or manual storage repair;
- rollback and vault-format compatibility are proven for the release candidate.

## Execution Order

The shortest safe vertical slice is:

1. threat model and method allowlist;
2. ephemeral mnemonic to one deterministic EVM address in Rust;
3. encrypted native vault with one account;
4. packed React Native package in every valid matrix cell;
5. cached native-asset portfolio followed by an incremental live refresh;
6. one owned test DApp requesting account access;
7. one readable EIP-712 confirmation and native signature;
8. one signed transaction submitted on an EVM test network;
9. WalletConnect as the second signer;
10. product catalogue, activity, and controlled distribution.

This slice proves the hardest boundaries before Ruban invests in breadth. New
networks, assets, DApps, and visual surfaces come only after the signing path is
complete and observable.
