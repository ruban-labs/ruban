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
| `../../brand/ruban-core.svg` | Transparent default R mark: Ruban acid yellow `#d9ff45` with essential cobalt `#2563eb` triangle. |
| `../../brand/ruban-core-dark.svg` | Explicit black `#101114` field with a pure-white R and lifted cobalt `#4c8dff` triangle. |
| `../../brand/ruban-mark-micro.svg` | Simplified acid-yellow one-color mark for 16–24 px favicon and other very small uses. |
| `../../brand/ruban-app-icon-dark.svg` | Black rounded-square app-icon reference with a white mark and lifted cobalt triangle. |
| `../../brand/ruban-lockup-horizontal.svg` | Outlined horizontal website-header lockup. |
| `../../brand/ruban-lockup-stacked.svg` | Outlined stacked lockup for covers and launch surfaces. |

The raster explorations that selected this direction are not product assets and
must not be committed or used as a source for tracing.

## Core construction

The selected identity is **Ruler Angle R**:

- an engineered uppercase `R`, built from a controlled medium-weight vertical
  stem, measured bowl, and one diagonal leg;
- three small calibration cuts in the full-size stem;
- one small cobalt-blue alignment triangle at the interior diagonal, inset into
  a slightly larger transparent socket with two tiny transparent ruler ticks;
- precision and reduction, never literal carpentry.

Preserve this silhouette, its open counter, the transparent socket around the
accent, the space between diagonal leg and accent, and the accent's position.
The mark may change color by context, but it must not gain
gradients, shadows, outlines, rounded mascot features, wood grain, a hammer,
a saw, a Chinese seal, calligraphy, a ribbon, a React atom, or AI sparkle.

## Lockups and contexts

| Context | Composition |
| --- | --- |
| App icon / mini-program icon | Mark only. Use a deliberately chosen tile background; the dark reference uses ink-black, a pure-white mark, and a cobalt triangle. Keep the mark inside the platform safe area. |
| Favicon at 16–24 px | Use `ruban-mark-micro.svg`; do not scale the calibration cuts down into noise and do not add text. |
| Website header | Horizontal lockup: mark on the left, then uppercase `RUBAN` on one optical baseline. At a 28 px mark, use a 16 px wordmark cap height and a 10 px clear gap. |
| Brand cover / launch surface | Stacked lockup is allowed: mark above uppercase `RUBAN`; use it sparingly, never in a navigation bar. |
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

Generate platform rasters from the listed SVG sources; do not draw a new `R`
for each platform.

| Target | Source and export contract |
| --- | --- |
| iOS App Store / iOS app icon | Start from `ruban-app-icon-dark.svg`; export a 1024×1024 opaque PNG. Keep the existing tile and do not pre-round the exported bitmap beyond the supplied artwork. |
| Android adaptive icon | Use `ruban-core.svg` with a declared ink-black background. Keep the full mark inside the adaptive safe zone; do not use the iOS tile as Android foreground artwork. |
| Favicon | Start from `ruban-mark-micro.svg`; export 16×16, 32×32, and 48×48 raster sizes, then package the required ICO or PNG forms. |
| Website navigation | Use `ruban-lockup-horizontal.svg` directly or preserve its viewBox when building an inline component. Do not rasterize it for ordinary responsive headers. |
| Launch, repository, or social cover | Use `ruban-lockup-stacked.svg` and create a composition-specific background around it. The lockup itself remains transparent. |

For each export, inspect 16, 24, 32, and 1024 px equivalents on both light and
dark presentation surfaces as applicable. Any optical correction belongs in a
named new derivative SVG with a documented target; it must not overwrite the
master or silently fork the core geometry.

## Delivery rules

1. Start from the SVG masters, not a generated PNG.
2. Keep source artwork vector and transparent unless the target explicitly
   needs a tile, as an app icon does.
3. Test the mark at 16, 24, 32, and 1024 px on both light and dark surfaces.
4. A new lockup or exported platform asset must preserve the core mark and add
   its source SVG plus a short update to `DESIGN.md` when it changes a rule.
5. Do not modify application UI merely to display the identity; app adoption is
   a separately scoped product change.
