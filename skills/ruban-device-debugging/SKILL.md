---
name: ruban-device-debugging
description: Define and validate Ruban intent-driven debug and regression automation through deterministic deep links. Use when adding a product workflow, non-production test action, deep-link adapter, machine-readable operation receipt, device smoke runner, watch-address seed, DApp Provider test, or developer playground on real devices and CI simulators.
---

# Ruban Device Debugging

Keep development automation deterministic without expanding the production
product surface.

## Workflow Architecture

Treat a Deep Link as an input adapter, never as the product implementation:

```text
UI action -------\
Deep Link --------> typed AppIntent -> application use case -> Native/DB/network
background work --/                                      -> AppIntentReceipt
```

- UI controls and test links must invoke the same application use case.
- Keep persistence, synchronization, network calls, Native IO, and feature
  enablement out of screen callbacks, React effects, and navigation handlers.
- Navigation-only links such as `components/*` may reproduce a visual fixture,
  but they do not count as business-workflow coverage.
- Each intent declares its supported RN/platform/architecture cells. Run the
  same fixture and expected receipt in every declared cell.
- Multi-step workflows compose typed intents and receipts; do not encode them
  as a sequence of UI coordinates or labels.

Every asynchronous or mutating intent returns or records an
`AppIntentReceipt` with a bounded `runId`, action name, terminal status,
redacted result/error code, and completion time. The UI consumes the same
resulting state as any other projection; it is not the test oracle.

## Deep Link Namespace

Use exactly this shape for debug and regression actions:

```text
<environment-scheme>://dev/<action>?<query>
```

- Keep `dev` as the common path prefix.
- Put the action name only in the remaining path.
- Put typed, bounded inputs only in query fields.
- Use `ruban-debug` for Debug and `ruban-regression` for Regression.
- Reject every `dev/*` action in Production even if a route is accidentally reachable.
- Never put credentials, private keys, mnemonics, arbitrary JavaScript, or other secrets in a URL.

Current actions:

- `dev/runtime-ready`: verify the exact app era, engine, architecture, platform,
  and environment through a correlated receipt.
- `dev/address/add`, `dev/address/select`, and `dev/address/delete`: operate on
  validated watch-only EVM addresses through the same wallet use cases as UI.
- `dev/chain/select`: select one supported chain through the wallet use case.
- `dev/portfolio/sync`: synchronize one validated address through `current` or
  deterministic `mock` provider mode.
- `dev/dapp/review`: approve or reject one matching pending Provider request;
  accepts no secret material and is disabled in Production.
- `dev/dapp-provider`: execute one bounded EIP-1193 request; follow
  `skills/ruban-dapp-provider/SKILL.md`.
- `dev/lab/<tool>`: open a registered developer playground; accept only
  tool-specific bounded query fields.

Do not move release-health checks into `dev/*`: they validate distributable
Release packages, including Production, and form a separate operational contract.

For a latest Android Debug BYOK test, use
`scripts/dev/import-debank-access-key.mjs`. Pass only the operator-authorized
source file path; never read or print its content. The helper must stream the
file through ADB stdin, import it into Android Keystore-backed storage through
the Debug-only receiver, and remove its app-private plaintext stage.

## Handler Contract

1. Check the native app environment before parsing the action.
2. Match one exact scheme, prefix, action, and query schema.
3. Translate the request into one typed `AppIntent`; do not call navigation,
   React state, repositories, or Native modules from the adapter.
4. Reject malformed, unknown, oversized, duplicate, or unsupported inputs.
5. Make repeated commands idempotent whenever they mutate local test state.
6. Dispatch through the same application use case used by the UI; never create
   a second product implementation solely for automation.
7. Correlate every asynchronous or mutating run with a bounded `runId` and
   produce one terminal receipt.
8. Expose a bounded log marker and/or SQLite fact that proves completion without
   inspecting secrets. A visible screen alone is insufficient.

Actions that must have an intent path include account/address create, select,
and delete; chain selection; portfolio synchronization; persisted settings;
feature enablement; Provider permission/review decisions; and every operation
that writes SQLite, Keychain/Keystore, or Native state. Pure navigation and
temporary specimen controls do not need business intents.

## CI Boundary

Keep these merge-blocking:

- pure intent/use-case, parser, reducer, queue, and package tests;
- Deep Link-to-intent adapter validation;
- headless device workflows only when the hosted runner reliably delivers the
  platform intent and exposes a deterministic completion oracle;
- package, typecheck, bundle, native compile, and architecture matrices;
- one thin cold-launch/scheme-dispatch smoke per platform where the runner has
  proven stable.

If the same workflow repeatedly passes on local simulators or physical devices
but fails only because a hosted runner does not deliver the URL, device event,
or lifecycle callback, remove it from required CI checks. Keep parser,
dispatcher, use-case, receipt, native compile, installability, and bundle
coverage merge-blocking; keep the complete workflow in the local/physical
device runner. Re-enable the hosted check only after its transport is stable.

Do not make broad component tours, copy assertions, repeated text taps, theme
previews, or modal open/close tours merge-blocking. Use Maestro or another UI
driver only when the contract is inherently visual or gestural, such as
keyboard avoidance, safe-area behavior, accessibility, drag dismissal, Android
Back handling, or overlay stacking. Run those as focused manual, scheduled, or
non-blocking checks.

Headless runners should use platform primitives such as `adb am start` or
`xcrun simctl openurl`; they do not need Maestro. Prefer logs or app-sandbox
state over accessibility labels as the completion oracle. Do not add retries,
private injection channels, or test-only business implementations merely to
make an unreliable hosted device transport pass.

## Device Verification

Cold-start or foreground the exact package through its environment scheme,
then verify the real resulting state. Keep Metro ports, package ids, and device
serials explicit. A navigation success alone is insufficient when the action
is expected to persist, synchronize, or execute Provider RPC.

Example:

```text
ruban-debug://dev/address/add?runId=smoke-1&address=0x...&label=Watch%20account
```
