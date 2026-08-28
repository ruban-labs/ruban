# gongshu-maestro

Maestro harness for the gongshu sample apps. One deterministic demo-smoke
flow per platform per era, generated from a single template.

## Layout

- `templates/demo-smoke.<platform>.yaml.tpl` - single source of truth, with
  `{{appId}}` / `{{era}}` placeholders.
- `src/gen-flows.mjs` - era table (app ids) + generator. Run `yarn gen`.
- `flows/` - generated, committed, so CI can gate on `maestro check-syntax`
  without running the generator.

Era app ids must stay in sync with `apps/gongshu-*`:

| era    | android                                           | ios                                               |
| ------ | ------------------------------------------------- | ------------------------------------------------- |
| 0.66   | com.rubanlabs.mobile.gongshu.rn066.debug          | com.rubanlabs.mobile.gongshu.rn066.debug          |
| 0.76   | com.rubanlabs.mobile.gongshu.rn076.debug          | com.rubanlabs.mobile.gongshu.rn076.debug          |
| latest | com.rubanlabs.mobile.debug                        | com.rubanlabs.mobile.debug                        |

## Running

Install the target gongshu app on a connected device first (Android: gradle
assembleDebug + adb install; iOS: Xcode to device/simulator), then:

```sh
maestro test flows/android-latest-demo-smoke.yaml --device <adb-serial>
maestro test flows/ios-latest-demo-smoke.yaml
```

The flow walks the shared Ruban app shell deterministically: Home inventory ->
Button showcase -> Playground -> Settings -> Build & Matrix. It also verifies
that bottom tabs are hidden on a component detail screen. Conventions follow
RabbyHub/rabby-mobile: platform-prefixed flow names, hierarchy-driven
selectors (visible product labels, never coordinates), `maestro check-syntax`
as the cheap gate.

Pixel 10 Pro (serial 59271FDCH002CB) is reserved by another session - do not
target it.
