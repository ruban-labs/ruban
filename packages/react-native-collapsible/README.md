# @ruban-labs/react-native-collapsible

Focused expand/collapse primitives for bare React Native.

- **Zero runtime dependencies** — React Native `Animated` only.
- **Bare React Native first** — no Expo module, animation runtime, or native installation.
- **RN 0.66+** — tested at RN 0.66, RN 0.77, and the current Ruban latest line.
- **Dynamic content** — expanded height follows content layout changes.
- **Accessible by default** — collapsed content leaves the accessibility tree and Accordion headers expose expanded state.

[简体中文](./README.zh-CN.md)

## Install

```sh
npm install @ruban-labs/react-native-collapsible
```

## Collapsible

```tsx
import {Collapsible} from '@ruban-labs/react-native-collapsible';

function Details() {
  const [collapsed, setCollapsed] = React.useState(true);

  return (
    <>
      <Button title="Toggle" onPress={() => setCollapsed(value => !value)} />
      <Collapsible collapsed={collapsed} duration={240}>
        <View>{/* dynamic content */}</View>
      </Collapsible>
    </>
  );
}
```

`collapsedHeight`, `align`, named easing curves, `renderChildrenCollapsed`, and `onAnimationEnd` cover the common disclosure cases. Height animation intentionally uses `useNativeDriver: false`; React Native cannot drive layout height on the native animation driver.

## Accordion

```tsx
import {Accordion} from '@ruban-labs/react-native-collapsible';

<Accordion
  sections={sections}
  activeSections={activeSections}
  onChange={setActiveSections}
  keyExtractor={section => section.id}
  renderHeader={(section, _index, active) => (
    <Text>{active ? '−' : '+'} {section.title}</Text>
  )}
  renderContent={section => <Text>{section.content}</Text>}
/>
```

The migration-compatible deep import remains available:

```tsx
import Accordion from '@ruban-labs/react-native-collapsible/Accordion';
```

## API

### Collapsible

| Prop | Default | Purpose |
| --- | --- | --- |
| `collapsed` | `true` | Controls open or closed state. |
| `collapsedHeight` | `0` | Visible height in the closed state. |
| `duration` | `300` | Transition duration in milliseconds; `0` is valid. |
| `easing` | `easeOutCubic` | Named curve or easing function. |
| `align` | `top` | Keeps top, center, or bottom content aligned while clipping. |
| `renderChildrenCollapsed` | `true` | Keeps children mounted while closed for immediate measurement. |
| `enablePointerEvents` | `false` | Opts closed content back into pointer events. |

### Accordion

Accordion is controlled through `activeSections` and `onChange`. It supports one or multiple active sections, disabled sections, stable keys, footer rendering, and the same animation options as Collapsible.

## Provenance

This is an independent TypeScript implementation inspired by the established `react-native-collapsible` public API. See [NOTICE](./NOTICE).

## License

MIT
