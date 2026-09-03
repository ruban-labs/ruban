# @ruban-labs/react-native-ui-overlay

为裸 React Native 提供单一原生 `Modal` Host，以及 queue、stack、replace 三种策略。

[English](./README.md)

应用根部只需放置一次 `OverlayProvider`。Dialog 与 Sheet 通过逻辑层接入，既规避旧版
iOS 多 Modal 展示问题，又保留嵌套弹层能力。

## 许可

MIT
