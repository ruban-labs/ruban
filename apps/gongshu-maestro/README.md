# gongshu-maestro

Maestro harness for the gongshu sample apps. One deterministic demo-smoke
flow per platform per era, generated from a single template.

## Layout

- `templates/demo-smoke.<platform>.yaml.tpl` - single source of truth, with
  `{{appId}}` / `{{era}}` / `{{scheme}}` placeholders.
- `src/gen-flows.mjs` - era table (app ids and Debug schemes) + generator. Run
  `pnpm gen`.
- `flows/` - generated, committed, so CI can gate on `maestro check-syntax`
  without running the generator.

Era app ids must stay in sync with `apps/gongshu-*`:

| era | Debug app id | Debug scheme |
| --- | --- | --- |
| 0.66 | `com.rubanlabs.mobile.gongshu.rn066.debug` | `ruban-rn066-debug://` |
| 0.76 | `com.rubanlabs.mobile.gongshu.rn076.debug` | `ruban-rn076-debug://` |
| latest | `com.rubanlabs.mobile.debug` | `ruban-debug://` |

## Running

Install the target gongshu app on a connected device first (Android: gradle
assembleDebug + adb install; iOS: Xcode to device/simulator), then:

```sh
maestro test flows/android-latest-demo-smoke.yaml --device <adb-serial>
maestro test flows/ios-latest-demo-smoke.yaml
```

The flow walks the shared Ruban app shell deterministically: Home inventory ->
Button, Badge, Separator, and Switch showcases -> Playground -> Settings ->
Build & Matrix. It verifies tab-free detail screens, exact Debug deep-link
routing, and the Switch controlled-state transition. The layout uses
platform-prefixed names, hierarchy-driven selectors instead of coordinates,
and `maestro check-syntax` as the cheap gate.
