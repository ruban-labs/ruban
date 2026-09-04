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

Prefer a familiar semantic icon when it can communicate an action or state
without ambiguity. Do not repeat the same meaning as adjacent text. Preserve an
accessible label and use text whenever an icon alone would make the decision
unclear.

Simple, low-count options in a Bottom Sheet use separate compact inset cards.
Match the page's horizontal content margins and leave visible space between
choices. Prefer borderless semantic fills over outlining every card: use a
muted raised surface for an unselected choice and the active navigation surface
for the selected choice. Give each choice a familiar left icon and keep the
selected check on the right. Use attached, dense rows only for genuinely long
lists such as chain selectors, and reserve tall rows for meaningful supporting
detail.

Settings rows use a quiet semantic icon on the left when the row represents a
recognizable object or category. Icons support scanning; they do not replace a
label whose meaning would otherwise be ambiguous.

Keep development tooling out of production Settings. Debug and regression
builds place a Diagnostics group after About; production builds omit the group
and its sheets entirely. Diagnostics owns both Build & Matrix and the compact
Playground launcher. That launcher lists design labs and component showcase
routes, then leaves the Sheet for the selected dedicated screen; it never
embeds a second copy of a specimen.

Primary tab content may use one short, centered page title to anchor the
layout. Do not turn it into a breadcrumb, add a brand prefix, or pair it with a
subtitle. Keep page-level actions in the top-right as prominent semantic icons
with accessible labels and a usable touch target.

The primary tab bar is icon-only. Keep route names as accessibility labels,
and express selection through semantic foreground and background colors rather
than repeating visible text below each icon.

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
