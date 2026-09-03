---
name: ruban-design
description: Use when designing or changing Ruban and Gongshu product surfaces, visual tokens, component specimens, or brand assets. Routes focused identity work to the Ruban brand-identity sub-skill.
---

# Ruban Design

Read `../../DESIGN.md` and `../../DESIGN.zh-CN.md` before changing a Gongshu
product surface. They are the durable product and visual charter.

## Skill routing

| Work                                                                             | Required source                                                        |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Product hierarchy, component specimens, themes, copy, or cross-era screenshots   | `../../DESIGN.md` plus the matching Gongshu source tree                |
| Ruban logo, app icon, favicon, wordmark lockup, social asset, or brand color use | [`../ruban-brand-identity/SKILL.md`](../ruban-brand-identity/SKILL.md) |

Do not turn the brand mark into a parallel app design system. Brand identity is
the stable recognizer; the app's semantic token system remains independently
owned by the Gongshu apps.

## Default to no explanation

Treat every page and component as a product surface, not documentation. Keep
only copy that the user needs to understand, choose, act, or recover. Omit all
other explanatory text, implementation terminology, architecture concepts,
decorative metadata, and labels that merely restate what the interface already
shows. Accessibility copy remains user-facing copy and must stay meaningful.

Before adding visible text, ask whether removing it would prevent the user from
completing the task. If not, do not add it.

## Semantic SVG icons

Theme-aware icon assets use a `-cc.svg` suffix and express their primary
foreground with `currentColor`. An icon may originate without that suffix, but
must be normalized before entering the shared icon package: replace semantic
foreground paints with `currentColor`, preserve intentional multicolor detail,
and rename the resulting asset to `*-cc.svg`. Consumers pass semantic theme
colors through the SVG component's `color` prop; they do not fork assets by
light or dark mode.

## Screen frame default

Every new Screen must identify one status-bar inset owner. Default to
`RubanScreen` or `react-native-safe-area-context` with the top edge. A React
Navigation header may own it instead. Immersive screens may paint through the
status bar only when their controls and primary content still use `insets.top`.
Never use React Native core `SafeAreaView`, and never apply the top inset twice.
