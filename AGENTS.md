# Ruban Agent Guidance

## Skill routing

| Work                                                                                                                   | Required skill                               |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Product surfaces, visual tokens, layout, copy, or component interaction                                                | `skills/ruban-design/SKILL.md`               |
| Logo, app icon, favicon, lockup, or identity asset                                                                     | `skills/ruban-brand-identity/SKILL.md`       |
| React rendering, state subscriptions, high-cardinality lists, remote images, navigation loading, or frontend profiling | `skills/ruban-frontend-performance/SKILL.md` |
| Debug/regression intents, Deep Links, device smoke tests, or operation receipts                                        | `skills/ruban-device-debugging/SKILL.md`     |
| WebView Provider, EIP-1193/EIP-6963, App-side RPC, or DApp tests                                                       | `skills/ruban-dapp-provider/SKILL.md`        |

## Design sources

- Product and visual source of truth: `DESIGN.md` and `DESIGN.zh-CN.md`.
- Before changing a Gongshu product surface, read
  `skills/ruban-design/SKILL.md`.
- Before creating or changing a logo, app icon, favicon, website-header lockup,
  or other identity asset, also read
  `skills/ruban-brand-identity/SKILL.md`.

The selected Ruban mark is a stable shared asset. Do not regenerate or replace
it while working on an app feature; use the tracked SVG masters in `brand/`.
