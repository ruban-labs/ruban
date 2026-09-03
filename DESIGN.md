# Ruban Product and Design Charter

[简体中文](./DESIGN.zh-CN.md)

This document defines how Ruban Labs turns focused React Native libraries into
a coherent product, compatibility lab, and visual system. It is the source of
truth for humans and coding agents working on the Gongshu apps.

## Product Shape

Ruban has three connected surfaces:

1. **The ruler** — `awesome-native-react` measures ecosystem health and helps
   developers discover maintained libraries.
2. **The tools** — small, sharp `@ruban-labs/react-native-*` packages that work
   in bare React Native without a required platform runtime.
3. **The workbench** — the Gongshu apps demonstrate the tools, reproduce real
   compatibility problems, and produce release-grade evidence.

The apps may depend on application infrastructure such as React Navigation.
The zero-runtime-dependency charter applies to published Ruban libraries, not
to the apps that exercise them.

## Near-term Library Roadmap

The next refurbishment candidates are:

| Package | Product role | Initial proof in Gongshu |
| --- | --- | --- |
| `@ruban-labs/react-native-collapsible` | Focused expand/collapse primitives | Library catalogue sections and detail disclosure |
| `@ruban-labs/react-native-animatable` | Small declarative animation vocabulary | Page transitions, feedback, and component states |
| `@ruban-labs/react-native-keyboard-aware-scroll-view` | Reliable keyboard and form layout behavior | Search, forms, and interactive playground controls |

Building these packages and building the Ruban app are the same program: every
package must solve a real app need, and every app integration becomes a
compatibility scenario for the package.

## App Eras

Keep three independent bare React Native apps under `apps/`:

| App | React Native era | Navigation | Architecture capability |
| --- | --- | --- | --- |
| `gongshu-0.66` | 0.66.x | React Navigation 6 | Legacy Architecture only |
| `gongshu-0.77` | 0.77.x | React Navigation 7 | Legacy and New Architecture |
| `gongshu-latest` | current pinned release | React Navigation 7 | Follow upstream; 0.82+ is New Architecture only |

Each app owns its dependencies, package manager lockfile, native projects,
signing configuration, bundle identifiers, and release artifacts. They share
product scenarios and design rules, not `node_modules`.

All three apps keep the same application framework in independent source
trees: Root Stack, Home / Playground / Settings tabs, semantic themes,
component catalogue and details, Settings bottom sheets, and deterministic
deep links. Do not reduce duplication by introducing a required app runtime
that old projects must install. Cross-era parity is maintained through shared
scenarios, contracts, and screenshot comparison.

## Architecture Matrix

Architecture is a **build axis**, not a source fork.

- Keep one application source tree per React Native era.
- Compile every architecture officially supported by that era.
- Do not emulate New Architecture on 0.66 or revive Legacy Architecture on a
  React Native release that removed it.
- `gongshu-0.77` must remain buildable in both Legacy and New Architecture on
  Android and iOS.
- Name CI and release artifacts with the era, architecture, and platform, for
  example `gongshu-rn077-newarch-android`.
- Use separate build variants, schemes, caches, and install identifiers when
  two architecture builds need to coexist on a device.
- Run the same deterministic deep-link scenarios against every valid matrix
  cell so architecture differences are visible rather than hidden by separate
  test content.

The minimum compile matrix is:

| Era | Legacy Architecture | New Architecture |
| --- | --- | --- |
| RN 0.66 | Required | Unsupported |
| RN 0.77 | Required | Required |
| RN latest (currently 0.87) | Unsupported upstream | Required |

If Ruban needs a recent dual-architecture comparison after the latest line has
become New-Architecture-only, add a fourth pinned app at the last upstream
dual-architecture release (RN 0.81). Do not patch the latest line into an
unsupported state.

## Distribution Contract

All three app eras must be releasable products rather than disposable demos:

- independent Android application IDs and iOS bundle IDs;
- reproducible signed release builds;
- versioned APK/AAB and IPA/archive artifacts;
- deterministic deep links for every catalogue and playground scenario;
- a Build & Matrix Modal that shows RN, React, platform, package, and
  architecture versions.

Whether all compatibility editions receive public App Store listings is a
separate product decision. GitHub Releases, internal distribution, and
TestFlight remain valid release channels for historical editions.

## Information Architecture

The shared product model has three bottom-level destinations:

1. **Home** — the supported component catalogue, current state, and direct
   entry points without marketing narration.
2. **Playground** — design specimens, component states, and deterministic test
   scenarios.
3. **Settings** — item-group cards for Appearance, one Build & Matrix entry,
   and About.

About is not a primary tab. Brand, provenance, version, licence, sponsorship,
and solution links belong to its Settings group. Compatibility belongs in the
Build & Matrix Modal; low-frequency metadata must not consume primary
navigation or remain expanded on the page.

### Bottom Inset Ownership

The navigation route frame owns bottom safe-area policy. Individual screens do
not detect or guess Android gesture navigation versus the classic three-button
mode. Android Window Insets are the sole source of truth, and a mode change is
handled by consuming the new `insets.bottom`.

- `tab-owned` — Main Tabs screens add no bottom safe area. The tab bar applies
  `max(base spacing, insets.bottom)` and its background covers the complete
  system-navigation region.
- `screen-owned` — ordinary Root Stack screens without tabs receive the bottom
  edge from Screen Frame; page content keeps only its design spacing.
- `edge-to-edge` — immersive media or canvas routes opt in explicitly at route
  registration and consume no bottom safe area.
- A route branch has exactly one bottom inset owner. The tab bar, Screen Frame,
  and page must never compensate for the same inset together.
- Keyboard avoidance is a keyboard-aware layout concern, not part of system
  navigation inset compensation.

### System Bar Color Ownership

- The app root always paints `surface-page` behind transparent system bars.
- The focused route owns status and navigation icon appearance. A route-local
  theme, such as Playground dark mode, overrides the global appearance only
  while that route is focused.
- Android 15 and later use the platform's enforced edge-to-edge model. Earlier
  versions opt in through the native integration supported by that RN era.
- Gesture navigation remains transparent. Three-button navigation may use the
  system contrast background, while app layout still consumes its bottom inset
  exactly once.
- Modal and sheet windows opt into system-bar translucency where that RN era
  supports it. RN 0.66 keeps status translucency and delegates the remaining
  window policy to its small native compatibility module.

### Settings Choice Surfaces

- Multi-choice settings use a source-owned Bottom Sheet primitive. They do not
  require Expo, a design-system runtime, or an opaque platform foundation.
- A settings row shows only its name, current value, and entry affordance. The
  sheet contains a title, compact metadata, selection state, and close action;
  it does not add explanatory paragraphs.
- Appearance exposes `system`, `light`, and `dark` and controls the complete
  app theme. Playground theme is page-local state owned by its top switch and
  explicit route parameter; it does not belong in Settings or app preferences.
- Build and Support Matrix are not expanded on the Settings page. One
  `Build & matrix` entry opens a scrollable information Bottom Sheet with
  CURRENT BUILD and SUPPORT MATRIX sections.
- `ruban://settings?sheet=appearance` and
  `ruban://settings?sheet=build` reproduce those sheets from a cold launch;
  `ruban://lab/design?theme=dark` reproduces the local Playground theme.
- Backdrop press, the top CLOSE action, and Android system back dismiss the
  sheet. Its bottom safe-area inset is consumed exactly once. Appearance is
  session-scoped until persistence is deliberately introduced; the UI must not
  imply that it was saved.
- The same choice surface passes typecheck, native compilation, and real-device
  screenshot review in every Gongshu era. Do not use layout properties absent
  from RN 0.66 to fake parity.

### Deep Link Identity

Every simultaneously installable app owns exactly one URL scheme. Environment
and RN era are both part of that scheme because iOS custom URL schemes cannot
dispatch between apps by path after the scheme has been registered.

| Era | Production | Regression | Debug |
| --- | --- | --- | --- |
| latest | `ruban://` | `ruban-regression://` | `ruban-debug://` |
| RN 0.77 | `ruban-rn077://` | `ruban-rn077-regression://` | `ruban-rn077-debug://` |
| RN 0.66 | `ruban-rn066://` | `ruban-rn066-regression://` | `ruban-rn066-debug://` |

Paths remain identical across schemes, such as `components/switch`,
`settings?sheet=build`, and `lab/design?theme=dark`. Android manifest
placeholders and iOS build settings select the one scheme owned by each build;
do not restore shared aliases that make several installed apps claim one URL.

## Visual Direction

Use the philosophy of shadcn/ui, not a web styling stack:

- source-owned components instead of an opaque component runtime;
- composition over giant configurable components;
- semantic design tokens instead of one-off values;
- accessible defaults that remain easy to adapt per platform;
- no required NativeWind, CSS runtime, Expo module, or design-system base
  package.

Ruban should feel like a precise modern workbench:

- a neutral default canvas rather than a brand formula built from pale yellow
  surfaces, brown text, and vermilion accents;
- identity expressed first through proportion, type, density, alignment, and
  interaction feedback; color directions must be compared in the Playground
  before one is adopted;
- clear type hierarchy, measured spacing, fine borders, and restrained shadows;
- dense enough for technical information without feeling like an admin panel;
- craft expressed through precision, not literal wood textures, ancient
  ornaments, or costume-like Chinese styling;
- motion used to explain state and causality, never as decoration alone.

### Color Theme Structure

- Light and dark expose the same variant keys while mapping each key to an
  independently selected value. Dark is not a runtime inversion of light.
- The current Playground candidates are `ink`, `cobalt`, `signal`, and `acid`.
  Every role exposes `100`, `75`, `30`, and `15` opacity steps.
- Use `100` for solid emphasis, `75` for secondary emphasis, `30` for selected
  or status fills, and `15` for subtle backgrounds. The lower steps retain real
  alpha instead of being precomposited against one surface.
- A role may use a different base in each mode. Dark cobalt, signal, and acid
  are lifted slightly to preserve comparable visual weight.
- The theme table stores color facts. Components map those variants onto
  semantic roles such as primary, status, and surface; business meaning does
  not belong in a base color name.
- These values now feed the semantic mapping used as Gongshu's current design
  baseline. Playground remains the place to compare and refine primitives and
  opacity steps; components consume semantic colors rather than primitive
  variants directly.
- Bottom navigation consumes dedicated `surface-navigation` and
  `surface-navigation-active` semantic roles. The active destination uses one
  hard-edged background block without a redundant top indicator; light and dark
  map those roles independently.

### Interface Copy Discipline

- Do not cover screens in explanatory copy. Hierarchy, position, labels,
  states, and controls should explain the interface first.
- Do not automatically add a subtitle below every title, an explanation below
  every card, or marketing copy below every list item.
- Copy earns its place only when it helps someone decide, act, understand risk,
  or recover from an error.
- Prefer a name, value, state, or concrete example over a paragraph that
  narrates the same information.
- Set a copy budget before implementing each screen. If removing a sentence
  does not reduce comprehension, remove it.
- Playground specimen text may demonstrate type and composition, but it must
  not become product explanation.

## Brand Identity Core

Ruban's immutable geometry anchor is the transparent 1254×1254
[`brand/ruban-ruler-angle-r.png`](./brand/ruban-ruler-angle-r.png): the
selected stacked `R` plus `RUBAN` signature. Ruban's stable recognizer within
that reference is the **Ruler Angle R**: a precise uppercase `R` with a
measured bowl, diagonal leg, three calibration cuts in its full-size stem, and
one small cobalt-blue alignment triangle. Its construction must feel
structural rather than blocky: preserve a clearly open counter, a smooth,
continuous, vertically aligned outer bowl and inner counter return, separation
between the two R legs, and generous internal negative space. The diagonal leg
keeps an even, near-parallel outer and inner slant from the lower bowl to the
baseline; it must not pinch or kink. The blue triangle
rests in the natural triangular gap between the clean vertical and diagonal
legs—it must never require a cut, mask, or white halo in the primary R—and
has no added tick marks. It expresses the ruler, tools, and workbench as
precision rather than literal carpentry. It must not acquire
wood grain, a hammer, saw, chisel, Chinese seal, calligraphy, ribbon, React
atom, generic AI imagery, gradients, or decorative effects.

The PNG remains the immutable visual and sourcing reference, not a
platform-export master. The transparent
[`brand/ruban-core.svg`](./brand/ruban-core.svg) is the approved core vector
master, formed from a direct trace of that reference. Preserve its path in all
derivatives; if it is ever regenerated, it must pass an overlay comparison
against the PNG. Do not hand-adjust the `R` away from either core asset. Its
main mark is Ruban acid yellow `#d9ff45` and its essential alignment triangle is cobalt blue
`#2563eb`. This deliberately aligns with the established `acid-100` product
hue without making it a semantic product state. Present the default mark on an
ink-black or other sufficiently dark field; it is not a light-surface text
color. The explicit dark presentation is
[`brand/ruban-core-dark.svg`](./brand/ruban-core-dark.svg): black `#101114`
field, pure-white `#ffffff` mark, and lifted cobalt `#4c8dff` triangle. The
blue triangle is a required full-size recognition accent, not a disposable
state color. The micro mark is the deliberate one-color exception at 16–24 px;
other one-color technical reproductions omit the triangle only when their
production constraint makes two inks impossible.

Identity uses one source geometry with context-specific compositions:

- app and mini-program icons use the mark alone; the reference dark tile is
  [`brand/ruban-app-icon-dark.svg`](./brand/ruban-app-icon-dark.svg);
- favicons from 16–24 px use the simplified, one-color
  [`brand/ruban-mark-micro.svg`](./brand/ruban-mark-micro.svg), not a tiny
  rendering of the calibration cuts;
- website navigation uses a horizontal lockup: mark left, uppercase `RUBAN`
  right, one optical baseline, a 10 px clear gap for a 28 px mark, and no
  stacked composition; its vector source is
  [`brand/ruban-lockup-horizontal.svg`](./brand/ruban-lockup-horizontal.svg);
- covers and launch surfaces may use the stacked mark-over-`RUBAN` lockup;
  its vector source is
  [`brand/ruban-lockup-stacked.svg`](./brand/ruban-lockup-stacked.svg).

The mark is the recognizer; `RUBAN` is the formal signature. Lockups compose
these two elements and are not separate logos. The yellow is a stable brand
choice, not a live/status semantic; do not change the logo geometry or treat
the mark as a product-state indicator.

Mobile distribution lanes remain recognizable when installed together by
changing only the app-icon tile context: production uses ink with a white mark,
regression uses acid with an ink mark, and debug uses a light cobalt tint with
an ink mark. The cobalt triangle remains cobalt in every lane; no lane adds a
badge or changes the Ruler Angle geometry. Native launch surfaces do not repeat
the lane signal. They show one static 84 pt/dp acid/cobalt core mark, exactly
centered on one ink field. The native boot-splash lifecycle holds that same
surface until navigation is ready, then removes it without a second React logo
or a custom animation; an eight-second fallback prevents a permanent startup
block. `brand/mobile-assets.json` and
`scripts/brand/generate-mobile-assets.mjs` own every generated mobile asset;
platform outputs must not be edited manually.

For identity work, read the routing
[`skills/ruban-design/SKILL.md`](./skills/ruban-design/SKILL.md) and its
[`ruban-brand-identity` sub-skill](./skills/ruban-brand-identity/SKILL.md).
The selected PNG is deliberately tracked as the immutable visual and sourcing
reference; `ruban-core.svg` is the core vector master. Other exploratory
rasters remain decision aids only.

## Component Showcase Contract

Home is the component catalogue. Every usable component opens a dedicated
showcase screen. That screen serves as both product documentation and a
deterministic real-device scenario; component states do not accumulate inside
one unbounded generic Playground.

Component details live in the Root Stack outside Main Tabs. Entering a detail
screen removes the complete bottom tab bar; the full-screen transition and
explicit top back action communicate catalogue-to-detail hierarchy. An in-app
entry returns to the catalogue, while a cold deep link routes both the top back
action and Android system back to Components Home. Do not simulate this by
setting the tab bar to `display: none`; visual hierarchy, navigation state, and
transition semantics must agree.

Every showcase screen follows this hierarchy:

1. **Identity** — component name, index, category, delivery, and status.
   Delivery is exactly `SOURCE` or `PACKAGE`, so app-owned source primitives
   are not presented as published packages.
2. **LIVE** — a real interactive instance appears in the first viewport, with
   the component's relevant controls beside it.
3. **Capability surface** — variants, states, sizes, tones, anatomy, or
   composition as appropriate. Do not invent categories merely for symmetry.
4. **CONTRACT** — verifiable facts only, including runtime dependencies, bare
   React Native support, architecture coverage, and interaction boundaries.
5. **DEEP LINK** — theme and important state belong in parameters so a cold
   launch reproduces the same screen.

The light/dark selector is local to the showcase and updates the displayed deep
link. Labels, controls, specimens, and data rows are the documentation; do not
add instructional paragraphs to the screen. Build the complete screen in
`gongshu-latest` first, then port the same scenario to RN 0.77 and RN 0.66.

Source-owned components have one canonical registry under `registry/native`.
The registry sync writes committed copies into each standalone Gongshu source
tree and formats each copy with that app's own Prettier contract. It does not
create a shared runtime, workspace dependency, or symlink. `pnpm registry:check`
fails when an app copy drifts from the canonical source, while era-specific
navigation, native dependencies, and product framing remain local to each app.

The first source-owned primitives establish these contracts:

- **Button** — `primary`, `secondary`, `outline`, `ghost`, and `destructive`
  variants; `sm`, `md`, and `lg` sizes; pressed, loading, disabled, and
  full-width states.
- **Card** — static and composable through Header, Title, Description, Action,
  Content, Footer, and Meta; semantic `default`, `muted`, `selected`, `alert`,
  `live`, and `contrast` tones.
- **Badge** — `default`, `secondary`, `outline`, `destructive`, and `live`
  variants with `sm` and `md` sizes; labels remain single-line and consume no
  runtime dependency.
- **Separator** — horizontal or vertical orientation, `default`, `strong`, and
  `accent` tones, plus hairline, regular, and bold weight. It is decorative and
  hidden from accessibility by default.
- **Switch** — controlled through `checked` and `onCheckedChange`, with `sm` and
  `md` sizes, a minimum 44-point touch target, switch semantics, and explicit
  disabled state.
- **Form Kit** — `Field` owns required, description, error, disabled, and invalid
  semantics; `Input` and `Textarea` inherit that state; `Checkbox`, `RadioGroup`,
  and `Select` remain controlled. `Select` uses a source-owned React Native
  bottom sheet and introduces no external runtime dependency.

`ruban://components/form` opens the composed Form Workbench. It is a compact
recipe rather than another primitive: all six Form Kit components participate
in one validation and submit flow, and the submit action exposes a deterministic
`form-workbench-saved` state for device smoke verification.

## Agent Design Contract

Agents must not improvise a new visual language screen by screen.

1. Define the information hierarchy, component inventory, and copy budget
   before writing JSX.
2. Remove explanatory copy first, then justify every sentence that remains.
3. Build one golden screen in `gongshu-latest` first.
4. Make important states addressable by deterministic deep links.
5. Capture reference screenshots for light/dark modes and key device sizes.
6. Review hierarchy, density, alignment, touch targets, contrast, truncation,
   loading, empty, error, disabled, and platform-specific states.
7. Convert accepted human feedback into tokens, patterns, or explicit
   do/don't examples before expanding the surface.
8. Prefer composing existing primitives; document why a new primitive is
   necessary.
9. Port the approved screen to 0.77 and 0.66, then review screenshot diffs
   rather than accepting approximate visual similarity.

The long-term design kit should contain semantic tokens, reusable patterns,
reference screenshots, and deterministic scenario definitions. Those assets
are executable constraints for agents, not mood-board decoration.
