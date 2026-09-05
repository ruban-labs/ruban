---
name: ruban-device-debugging
description: Define and validate Ruban debug and regression device automation through deterministic deep links. Use when adding a non-production test action, changing deep-link routes or device smoke scripts, seeding watch addresses, driving DApp Provider tests, or exposing developer playgrounds on real devices.
---

# Ruban Device Debugging

Keep development automation deterministic without expanding the production
product surface.

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

- `dev/watch-address`: add or select a validated watch-only EVM address; accepts
  `address` and optional `label`.
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
3. Reject malformed, unknown, oversized, duplicate, or unsupported inputs.
4. Make repeated commands idempotent whenever they mutate local test state.
5. Route through the same application service used by the UI; do not create a
   second product implementation solely for automation.
6. Correlate asynchronous tests with a bounded `runId` when the runner needs a
   terminal result.
7. Expose a stable UI test id, bounded log marker, or SQLite fact that proves
   completion without inspecting secrets.

## Device Verification

Cold-start or foreground the exact package through its environment scheme,
then verify the real resulting state. Keep Metro ports, package ids, and device
serials explicit. A navigation success alone is insufficient when the action
is expected to persist, synchronize, or execute Provider RPC.

Example:

```text
ruban-debug://dev/watch-address?address=0x...&label=Watch%20account
```
