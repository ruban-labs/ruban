# @ruban-labs/react-native-collapsible

面向 bare React Native 的专注展开、收起组件。

- **零运行时依赖**：只使用 React Native 自带的 `Animated`。
- **bare RN 优先**：不要求 Expo、额外动画 runtime 或原生安装步骤。
- **支持 RN 0.66+**：覆盖 RN 0.66、RN 0.76 与 Ruban 当前 latest 版本。
- **动态内容**：展开状态下，内容高度变化会同步更新容器。
- **默认可访问**：完全收起后移出无障碍树；Accordion 标题暴露展开状态。

[English](./README.md)

## 安装

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

`collapsedHeight`、`align`、具名 easing、`renderChildrenCollapsed` 与 `onAnimationEnd` 覆盖常见渐进展示场景。高度属于布局属性，React Native 原生动画驱动不能处理，因此本包明确使用 JS 驱动。

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

同时保留迁移友好的深导入：

```tsx
import Accordion from '@ruban-labs/react-native-collapsible/Accordion';
```

## 主要属性

### Collapsible

| 属性 | 默认值 | 作用 |
| --- | --- | --- |
| `collapsed` | `true` | 受控的展开、收起状态。 |
| `collapsedHeight` | `0` | 收起时保留的可见高度。 |
| `duration` | `300` | 动画毫秒数，也支持 `0`。 |
| `easing` | `easeOutCubic` | 具名曲线或自定义 easing 函数。 |
| `align` | `top` | 裁切时保持顶部、居中或底部对齐。 |
| `renderChildrenCollapsed` | `true` | 收起时保留子节点，便于立即测量。 |
| `enablePointerEvents` | `false` | 是否允许收起内容继续接收触控。 |

### Accordion

Accordion 由 `activeSections` 与 `onChange` 完全受控，支持单项或多项展开、禁用项、稳定 key、footer，以及 Collapsible 的动画参数。

## 来源说明

这是参考 `react-native-collapsible` 公共 API 独立完成的 TypeScript 实现，详见 [NOTICE](./NOTICE)。

## 许可证

MIT
