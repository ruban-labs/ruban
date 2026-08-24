# @ruban-labs/react-native-progress

Progress indicators and spinners for React Native.

- **Zero runtime dependencies** - bare React Native only. No `react-native-svg`, no ART, no platform kits.
- **Bare-RN first** - works out of the box in a fresh `@react-native-community/cli` project with zero configuration.
- **New architecture ready** - pure JS components, no native modules, no codegen.
- **TypeScript strict** - fully typed props with sensible defaults.

A refurbishment of the classic
[react-native-progress](https://github.com/oblador/react-native-progress) by
Joel Arvidsson (MIT), rebuilt for the modern React Native era. See
[NOTICE](./NOTICE) for provenance.

> **Measure with the ruler. Build with the tools.** - Ruban Labs

## Installation

```sh
npm install @ruban-labs/react-native-progress
# or
pnpm add @ruban-labs/react-native-progress
```

Requires `react-native >= 0.66` and `react >= 17`. See
[Supported versions](#supported-versions).

## Components

### Bar

```tsx
import { Bar } from '@ruban-labs/react-native-progress';

<Bar progress={0.6} />
<Bar indeterminate color="#34c759" />
```

### Circle

A segmented progress ring - see [Rendering notes](#rendering-notes).

```tsx
import { Circle } from '@ruban-labs/react-native-progress';

<Circle progress={0.7} showsText size={80} thickness={6} />
<Circle indeterminate color="#ff9500" />
```

### Pie

```tsx
import { Pie } from '@ruban-labs/react-native-progress';

<Pie progress={0.45} size={64} unfilledColor="#f0f0f0" />
```

### CircleSnail

Indeterminate spinner with a growing/shrinking comet.

```tsx
import { CircleSnail } from '@ruban-labs/react-native-progress';

<CircleSnail color={['#ff3b30', '#ff9500', '#34c759']} />
```

## API

### Common props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `progress` | `number` | `0` | Progress in `[0, 1]` (clamped). |
| `animated` | `boolean` | `true` | Animate progress changes. |
| `indeterminate` | `boolean` | `false` | Endless animation mode. |
| `indeterminateAnimationDuration` | `number` | `1000` | One loop duration (ms). |
| `direction` | `'clockwise' \| 'counter-clockwise'` | `'clockwise'` | Sweep direction (radial components). |
| `style` | `ViewStyle` | - | Container style. |

### Bar props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `width` | `number` | `150` | Bar width (falls back to layout width when `0`). |
| `height` | `number` | `6` | Bar height. |
| `color` | `string` | iOS blue | Fill color. |
| `unfilledColor` | `string` | transparent | Track color. |
| `borderWidth` | `number` | `1` | Track border width. |
| `borderColor` | `string` | `color` | Track border color. |
| `borderRadius` | `number` | `4` | Track corner radius. |
| `animationType` | `'spring' \| 'timing'` | `'spring'` | Progress animation. |
| `animationConfig` | `object` | `{ bounciness: 0 }` | Extra animation config. |
| `useNativeDriver` | `boolean` | `false` | Native animation driver. |

### Circle props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `size` | `number` | `40` | Diameter. |
| `thickness` | `number` | `3` | Ring thickness. |
| `color` | `string` | iOS blue | Lit segment color. |
| `unfilledColor` | `string` | transparent | Unlit segment color. |
| `borderWidth` | `number` | `1` | Outer border ring width. |
| `borderColor` | `string` | `color` | Outer border ring color. |
| `fill` | `string` | transparent | Inner disk fill. |
| `segmentCount` | `number` | size-derived | Number of ring segments. |
| `strokeCap` | `'round' \| 'butt' \| 'square'` | `'round'` | Segment end shape. |
| `endAngle` | `number` | `0.9` | Indeterminate ring coverage (rest is the traveling gap). |
| `showsText` | `boolean` | `false` | Render centered progress text. |
| `formatText` | `(p: number) => string` | `NN%` | Center text formatter. |
| `textStyle` | `TextStyle` | - | Center text style. |
| `allowFontScaling` | `boolean` | `true` | Center text font scaling. |

### Pie props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `size` | `number` | `40` | Diameter. |
| `color` | `string` | iOS blue | Sector color. |
| `unfilledColor` | `string` | transparent | Base disk color. |
| `borderWidth` | `number` | `1` | Border ring width. |
| `borderColor` | `string` | `color` | Border ring color. |

### CircleSnail props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `animating` | `boolean` | `true` | Run the animation. |
| `color` | `string \| string[]` | iOS blue | Comet color(s), cycled per sweep. |
| `direction` | `'clockwise' \| 'counter-clockwise'` | `'counter-clockwise'` | Sweep direction. |
| `duration` | `number` | `1000` | One grow/shrink phase (ms). |
| `spinDuration` | `number` | `5000` | One full rotation (ms). |
| `size` | `number` | `40` | Diameter. |
| `thickness` | `number` | `3` | Ring thickness. |
| `hidesWhenStopped` | `boolean` | `false` | Unmount when not animating. |
| `segmentCount` | `number` | size-derived | Number of ring segments. |

## Supported versions

The floor is `react-native >= 0.66` / `react >= 17`. The components are pure
JavaScript, so they behave identically on the legacy architecture and the new
architecture - supporting the wide installed base costs nothing. The range
spans the ecosystem's key boundaries:

| RN version | Boundary |
| --- | --- |
| 0.68 | First new-architecture opt-in (Fabric / TurboModules) |
| 0.70 | Hermes becomes the default engine |
| 0.71 | TypeScript becomes the default template |
| 0.76 | New architecture becomes the default |
| 0.79 | React 19 |

Published output ships conservative syntax (no optional chaining or nullish
coalescing) so it parses on older Metro/JSC setups that do not transform
`node_modules`, and the types compile against `@types/react` 17+.

## Rendering notes

The original library draws `Circle`, `Pie`, and `CircleSnail` with
`react-native-svg`. This refurbishment keeps the package dependency-free:

- **Pie** is rendered with clipped, rotating half-disks - geometrically exact,
  fully animated, transparent background preserved.
- **Circle** and **CircleSnail** render as **segmented rings** (discrete
  rounded segments). Tune density with `segmentCount`. This is an intentional
  charter decision: no SVG dependency, transparent center preserved, at the
  cost of the exact smooth-arc look of the original.

## Migrating from `react-native-progress`

```diff
- import * as Progress from 'react-native-progress';
+ import { Bar, Circle, Pie, CircleSnail } from '@ruban-labs/react-native-progress';
```

- The component prop surface is compatible for the props documented above.
- `react-native-svg` is no longer needed - remove it if nothing else uses it.
- Circle rendering changes from a smooth SVG arc to a segmented ring.
- This package starts at version `6.0.0`; the original ended at `5.x`.

## Development

```sh
pnpm install
pnpm typecheck   # strict TS
pnpm test        # jest + @testing-library/react-native
pnpm build       # react-native-builder-bob (commonjs, module, typescript)
```

## License

MIT - see [LICENSE](../../LICENSE) and [NOTICE](./NOTICE).
