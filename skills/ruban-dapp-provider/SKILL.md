---
name: ruban-dapp-provider
description: Use when developing or validating the Ruban WebView Provider, EIP-1193/EIP-6963 injection, App-side RPC routing, DApp permissions, signing requests, or Deep Link driven real-device DApp tests.
---

# Ruban DApp Provider Development

Use this workflow for the complete DApp path:

```text
test DApp -> window.ethereum -> WebView bridge -> App RPC controller
          <- response/event script <- App result/approval
```

The DApp is the stimulus, never the implementation owner. App behavior must be
validated through the same injected Provider that a real external DApp uses.

## Test DApps

Keep two complementary targets:

- `https://metamask.github.io/test-dapp/` is the external compatibility baseline.
- `ruban-labs/web3-test-dapp` is the stable Ruban-owned workbench. It uses Ruban
  visual tokens but must call standard Provider APIs rather than private App APIs.

Do not couple device tests to either site's button labels or DOM structure. The
App's Deep Link test control executes a Provider request directly in the loaded
WebView, so a visual redesign cannot break the RPC regression suite.

## Deep Link Contract

The latest Debug and Regression apps expose one dedicated path:

```text
<environment-scheme>://dapp-test
```

Query fields:

| Field       | Required | Contract                                     |
| ----------- | -------- | -------------------------------------------- |
| `dapp`      | no       | Registered target id; defaults to `metamask` |
| `method`    | yes      | One EIP-1193/JSON-RPC method name            |
| `params`    | no       | URL-encoded JSON array; defaults to `[]`     |
| `runId`     | yes      | Unique 1-64 character test correlation id    |
| `timeoutMs` | no       | Provider timeout from 1000 through 60000 ms  |

Example:

```text
ruban-debug://dapp-test?dapp=metamask&method=eth_chainId&params=%5B%5D&runId=chain-id-1
```

The query never contains arbitrary JavaScript. It describes one bounded
`window.ethereum.request({method, params})` call. Production builds reject the
test route even though their scheme remains registered for ordinary product
Deep Links.

## Runtime Contract

1. Navigation validates the environment, target, method, params, run id, and timeout.
2. The WebView injects the Ruban Provider before the page loads.
3. After the main document finishes loading, the App uses
   `WebView.injectJavaScript` to execute the structured request.
4. The Provider sends the request through `ReactNativeWebView.postMessage` with
   its bridge session and document ids.
5. The App validates session, document, origin, replay limits, and method policy.
6. Account and chain methods resolve locally. Read methods use the browser RPC
   lane. Signing and transaction methods require an App-owned confirmation UI.
7. The App injects the EIP-1193 response or event back into the same document.
8. The test command posts a bounded `ruban-dapp-test-v1` result containing
   `runId`, method, status, and result/error.
9. The screen exposes `dapp-test-running`, `dapp-test-pass`, or
   `dapp-test-fail` for a real-device runner and emits one correlation marker.

Never satisfy a signing test by bypassing the confirmation surface. Automation
may trigger the request and assert that the review UI appears; approval or
rejection remains an explicit test action.

## App Review Queue

The App owns one bounded FIFO queue for interactive Provider requests. WebView
screens submit typed review facts and await a Promise; they do not mount their
own Alerts or competing Modals.

- Queue connection, chain switch, message signing, typed-data signing, and
  transaction requests.
- Keep chain reads and account-state reads non-interactive.
- Reject backdrop, close, navigation, and unmount cancellation with EIP-1193
  code `4001`.
- Reject unsupported methods with `4200`, unknown chains with `4902`, and a
  saturated queue with a bounded internal error.
- Cancel every active and queued request for a WebView session when its main
  document navigates or the screen unmounts.
- Keep the Native wallet confirmation as the final key-use boundary. The App
  Bottom Sheet explains the DApp request; Native code authorizes secret-key use.

The review UI displays facts, not trust claims: origin, account, network,
recipient, value, spender/operator, raw amount, decoded function, and bounded
calldata. Avoid risk verdicts until simulation and trusted metadata exist.

## Transaction Parsing

Use `@ruban-labs/web3-tx-parser` as a pure, deterministic input-to-facts layer:

```text
eth_sendTransaction params -> trusted App metadata -> parser -> review rows
```

The parser must not fetch RPC data, request approval, sign, broadcast, or infer
token standards from an ambiguous selector. The App may enrich input with
trusted chain/token/contract metadata, prices, simulation, and address labels.
Without trusted metadata, phrase ambiguous approvals as asset access and keep
the raw amount and calldata visible.

## Development Loop

For each Provider method:

1. Define the expected EIP-1193 result and error codes.
2. Add pure bridge/parser tests before App IO.
3. Implement or extend the App RPC handler without putting secrets in WebView JS.
4. Verify the request on the Ruban-owned test DApp for deterministic iteration.
5. Repeat it against the external MetaMask Test DApp for compatibility evidence.
6. Exercise success, user rejection, unsupported chain/method, timeout, stale
   document, duplicate request, and navigation cancellation where applicable.
7. Run package tests, package typecheck/build, app typecheck, Metro bundle smoke,
   and the matching real-device Deep Link scenario.

Use the Android real-device runner for non-interactive methods:

```bash
pnpm gongshu:dapp-smoke -- --device <serial> --lane debug \
  --dapp metamask --method eth_chainId --params '[]'
```

Debug requires Metro on the app's configured port. Regression runs from its
embedded Hermes bundle. Keep unique run ids when collecting concurrent or
historical evidence.

## Method Order

Build the first complete loop in this order:

1. `eth_chainId`, `net_version`, `eth_accounts`
2. `eth_requestAccounts` and account-change events
3. read-only chain RPC methods
4. `wallet_switchEthereumChain`
5. `personal_sign` and `eth_signTypedData_v4`
6. `eth_sendTransaction`

Each stage must work through both ordinary page controls and the Deep Link test
path before the next stage becomes the default development target.

## Safety Boundaries

- Private keys, mnemonics, derived seeds, and unsigned secret material never
  enter WebView or React Native JavaScript.
- The top-level WebView URL determines origin. DApp messages cannot claim one.
- Permissions are origin- and session-scoped and reset deliberately.
- Browser RPC and App portfolio RPC use independent bounded lanes.
- Test scripts accept data, not code, and are disabled in Production.
- Page messages and result payloads remain size-bounded and stale run ids fail closed.

## Persistence Contract

- Use one process-global TypeORM `DataSource` backed by
  `@op-engineering/op-sqlite`; never open feature-local database connections.
- Before the first App release, update one baseline schema in place and do not
  create a migration class or migration table. Reset development data after an
  incompatible baseline change.
- Add TypeORM migrations only after a real published version has frozen the
  source schema, and make each migration start from that published baseline.
  Keep `synchronize` disabled in every build.
- Store public account metadata, selected-account state, caches, permissions,
  and activity indexes in structured tables so they remain queryable.
- Keep plaintext mnemonics, private keys, and derived seeds in the Native Vault,
  never in SQLite or JavaScript.
- Future C++ sync writers may share the database only after checking the schema
  version, writing transactionally, and emitting a post-commit invalidation to
  the TypeScript query layer.
