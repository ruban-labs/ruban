---
name: ruban-brand-identity
description: Use when creating or changing Ruban identity assets: logo marks, app icons, favicons, website-header lockups, social/profile images, or brand-color applications.
---

# Ruban Brand Identity

Read `../../DESIGN.md` first. This skill fixes the identity core selected on
2026-08-28; it does not authorize a new visual direction.

## Source assets

| Asset | Purpose |
| --- | --- |
| `../../brand/ruban-ruler-angle-r.png` | Immutable, transparent 1254×1254 selected visual and sourcing reference. |
| `../../brand/ruban-core.svg` | Approved transparent core vector master, directly traced from the selected reference: Ruban acid yellow `#d9ff45` with essential cobalt `#2563eb` triangle. |
| `../../brand/ruban-core-dark.svg` | Explicit black `#101114` field with a pure-white R and lifted cobalt `#4c8dff` triangle. |
| `../../brand/ruban-mark-micro.svg` | Simplified acid-yellow one-color mark for 16–24 px favicon and other very small uses. |
| `../../brand/ruban-app-icon-dark.svg` | Black rounded-square app-icon reference with a white mark and lifted cobalt triangle. |
| `../../brand/ruban-lockup-horizontal.svg` | Outlined horizontal website-header lockup. |
| `../../brand/ruban-lockup-stacked.svg` | Outlined stacked lockup for covers and launch surfaces. |

The selected PNG above has been explicitly promoted from exploration to a
tracked visual and sourcing reference. `ruban-core.svg` is the accepted core
vector master. Preserve the SVG path in all derivatives; a future replacement
must be traced or rebuilt against the PNG and verified with an overlay before
adoption. Other raster explorations remain untracked decision aids and must
not become product assets.

## Core construction

The selected identity is **Ruler Angle R**:

- an engineered uppercase `R`, built from a controlled medium-weight vertical
  stem, measured bowl, and one diagonal leg;
- three small calibration cuts in the full-size stem;
- one small cobalt-blue alignment triangle, placed in the natural negative
  space between the clean vertical and diagonal legs, with no added ruler ticks;
- precision and reduction, never literal carpentry.

Preserve this silhouette, its smooth vertically aligned outer bowl and inner
counter return, clean continuous vertical and
diagonal legs, the diagonal leg's even near-parallel inner and outer edges,
the natural space between them, and the accent's position. The
blue triangle must never cut, mask, or create a white halo in the primary R.
The mark may change color by context, but it must not gain
gradients, shadows, outlines, rounded mascot features, wood grain, a hammer,
a saw, a Chinese seal, calligraphy, a ribbon, a React atom, or AI sparkle.

## Lockups and contexts

| Context | Composition |
| --- | --- |
| App icon / mini-program icon | Mark only. Use a deliberately chosen tile background; the dark reference uses ink-black, a pure-white mark, and a cobalt triangle. Keep the mark inside the platform safe area. |
| Favicon at 16–24 px | Use `ruban-mark-micro.svg`; do not scale the calibration cuts down into noise and do not add text. |
| Website header | Horizontal lockup: mark on the left, then uppercase `RUBAN` on one optical baseline. At a 28 px mark, use a 16 px wordmark cap height and a 10 px clear gap. |
| Brand cover | Stacked lockup is allowed: mark above uppercase `RUBAN`; use it sparingly, never in a navigation bar or native app startup surface. |
| Native app startup | Core mark only, 84 pt/dp, exactly centered on an ink field. Do not add a wordmark, lane badge, animation, or a second React-rendered logo. |
| One-color reproduction | The 16–24 px micro mark is deliberately one color. At other sizes, retain the cobalt triangle; omit it only when a technical one-ink constraint makes a two-color reproduction impossible. |

The `R` mark is the recognizer. `RUBAN` is the formal signature. A lockup is a
composition of those two elements, not a second logo.

## Color by context

- Default brand presentation: acid-yellow `#d9ff45` mark with a cobalt-blue
  `#2563eb` triangle on an ink-black or otherwise sufficiently dark field.
  The yellow is aligned with existing product `acid-100`, but is a stable
  identity color, not a live/status state.
- Dark presentation: black `#101114` field with a pure-white `#ffffff` mark
  and lifted cobalt `#4c8dff` triangle.
- App-icon tile: ink-black `#101114` field with a pure-white mark and lifted
  cobalt triangle.
- The cobalt triangle is the Ruler Angle's required full-size accent; never
  replace it with another color or turn it into a product-state signal.

Use the supplied yellow/blue or white/blue/black presentation as a complete
composition. Never recolor individual strokes independently or add extra brand
colors to communicate a state.

## Platform export map

Generate platform rasters from `ruban-core.svg` or a faithful listed SVG
derivative; do not draw a new `R` for each platform.

| Target | Source and export contract |
| --- | --- |
| iOS App Store / iOS app icon | Start from `ruban-app-icon-dark.svg`; export a 1024×1024 opaque PNG. Keep the existing tile and do not pre-round the exported bitmap beyond the supplied artwork. |
| Android adaptive icon | Use `ruban-core.svg` with a declared ink-black background. Keep the full mark inside the adaptive safe zone; do not use the iOS tile as Android foreground artwork. |
| Favicon | Start from `ruban-mark-micro.svg`; export 16×16, 32×32, and 48×48 raster sizes, then package the required ICO or PNG forms. |
| Website navigation | Use `ruban-lockup-horizontal.svg` directly or preserve its viewBox when building an inline component. Do not rasterize it for ordinary responsive headers. |
| Native launch | Use the transparent acid/cobalt `ruban-core.svg` mark at 84 pt/dp on ink `#101114`; keep it exactly centered. |
| Repository or social cover | Use `ruban-lockup-stacked.svg` and create a composition-specific background around it. The lockup itself remains transparent. |

For each export, inspect 16, 24, 32, and 1024 px equivalents on both light and
dark presentation surfaces as applicable. Any optical correction belongs in a
named new derivative SVG with a documented target; it must not overwrite the
master or silently fork the core geometry.

## Mobile environment lanes

App distribution lanes use tile color, not badges or modified geometry, to
stay distinguishable when multiple builds are installed on one device:

| Lane | Tile | Mark | Triangle |
| --- | --- | --- | --- |
| Production | ink `#101114` | white `#ffffff` | lifted cobalt `#4c8dff` |
| Regression | acid `#d9ff45` | ink `#101114` | cobalt `#2563eb` |
| Debug | light cobalt tint `#dce8ff` | ink `#101114` | cobalt `#2563eb` |

The triangle remains cobalt in every lane. The lane palette is a launcher
recognition aid, not a new product-state API and not permission to recolor
individual strokes elsewhere.

All Gongshu apps share one native launch identity: ink `#101114` field with
the transparent acid/cobalt core mark at 84 pt/dp, exactly centered. Keep the
launch mark independent from the app lane. Native boot splash is the only
visual and lifecycle owner: hold that one static surface until React Navigation
reports ready, then hide it with `fade: false`. Keep an eight-second bounded
fallback to prevent a permanent block. Never render a matching React overlay,
because a second image creates a visible scale or position handoff.

Android launch drawables use a transparent 288 dp density-aware canvas with the
84 dp core mark centered inside it. Both the Android system splash slot and the
native hold layer consume that same canvas. Exporting a bare 84 dp bitmap is
forbidden because the 288 dp slot scales it into an oversized logo and creates
a visible handoff.

Each independently installed sample locks the package line compatible with its
React Native era: `react-native-bootsplash@7.3.2` for latest,
`react-native-bootsplash@6.3.12` for RN 0.76, and
`react-native-bootsplash@4.7.5` for RN 0.66. Preserve each era's native setup
contract rather than copying the newest AppDelegate or Android theme API into
historical apps.

`brand/mobile-assets.json` is the mobile export source of truth.
`scripts/brand/generate-mobile-assets.mjs` derives every iOS AppIcon catalog,
Android legacy/adaptive/monochrome icon, native launch image, launch storyboard,
and Android boot theme from the tracked SVG masters. Run:

```bash
pnpm brand:mobile:generate
pnpm brand:mobile:check
```

Generated PNG, Android XML, iOS storyboard, and asset-catalog files must not be
edited by hand. Change the manifest or SVG master, regenerate, inspect the
1024 px icons plus the launch mark, then build all three app eras.

## Delivery rules

1. Start from `ruban-core.svg`. If the core vector is ever regenerated, compare
   it against `ruban-ruler-angle-r.png`; do not use hand-retouched geometry.
2. Keep source artwork vector and transparent unless the target explicitly
   needs a tile, as an app icon does.
3. Test the mark at 16, 24, 32, and 1024 px on both light and dark surfaces.
4. A new lockup or exported platform asset must preserve the core mark and add
   its source SVG plus a short update to `DESIGN.md` when it changes a rule.
5. Do not modify application UI merely to display the identity; app adoption is
   a separately scoped product change.

## Public provenance boundary

- Present every public design and engineering decision as Ruban-owned rationale.
- Never name or link private employer projects, internal codebases, or unpublished
  reference implementations in repository files, commit messages, pull requests,
  reviews, comments, generated metadata, or release notes.
- Before updating a public pull request, scan tracked and untracked files, branch
  commit messages, and the complete pull-request conversation for provenance leaks.
- Keep reusable lessons as neutral principles and reproducible tests rather than
  attribution to an internal source.
