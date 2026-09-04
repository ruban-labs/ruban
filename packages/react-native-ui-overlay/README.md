# @ruban-labs/react-native-ui-overlay

A single native `Modal` host with queue, stack, and replace policies for bare React Native.

[简体中文](./README.zh-CN.md)

```sh
npm install @ruban-labs/react-native-ui-overlay
```

Wrap the application once with `OverlayProvider`, then let dialogs and sheets register logical
layers through `useOverlayLayer`. This avoids overlapping native modal presentations on older iOS
versions while preserving nested overlay behavior.

## License

MIT
