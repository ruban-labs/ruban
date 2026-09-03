---
name: ruban-design
description: Use when designing or changing Ruban and Gongshu product surfaces, visual tokens, component specimens, or brand assets. Routes focused identity work to the Ruban brand-identity sub-skill.
---

# Ruban Design

Read `../../DESIGN.md` and `../../DESIGN.zh-CN.md` before changing a Gongshu
product surface. They are the durable product and visual charter.

## Skill routing

| Work | Required source |
| --- | --- |
| Product hierarchy, component specimens, themes, copy, or cross-era screenshots | `../../DESIGN.md` plus the matching Gongshu source tree |
| Ruban logo, app icon, favicon, wordmark lockup, social asset, or brand color use | [`../ruban-brand-identity/SKILL.md`](../ruban-brand-identity/SKILL.md) |

Do not turn the brand mark into a parallel app design system. Brand identity is
the stable recognizer; the app's semantic token system remains independently
owned by the Gongshu apps.

## Screen frame default

Every new Screen must identify one status-bar inset owner. Default to
`RubanScreen` or `react-native-safe-area-context` with the top edge. A React
Navigation header may own it instead. Immersive screens may paint through the
status bar only when their controls and primary content still use `insets.top`.
Never use React Native core `SafeAreaView`, and never apply the top inset twice.
