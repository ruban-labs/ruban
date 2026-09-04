import * as React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  RubanThemeProvider,
  spacing,
  useRubanColors,
} from "@ruban-labs/react-native-ui-theme";
import {
  useOverlayLayer,
  useStableOverlayId,
  type OverlayStrategy,
} from "@ruban-labs/react-native-ui-overlay";

type BottomSheetModalProps = {
  visible: boolean;
  title: string;
  onDismiss: () => void;
  children: React.ReactNode;
  overlayId?: string;
  strategy?: OverlayStrategy;
  testID?: string;
};

export function BottomSheetModal({
  visible,
  title,
  onDismiss,
  children,
  overlayId,
  strategy = "queue",
  testID,
}: BottomSheetModalProps): null {
  const generatedId = useStableOverlayId("bottom-sheet");
  const resolvedId = overlayId || generatedId;
  const themeMode = useRubanColors().mode;
  const [mounted, setMounted] = React.useState(visible);
  const progress = React.useRef(new Animated.Value(visible ? 1 : 0)).current;

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
    }
  }, [visible]);

  React.useEffect(() => {
    if (!mounted) {
      return;
    }

    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 170,
      useNativeDriver: true,
    });

    animation.start(({ finished }) => {
      if (finished && !visible) {
        setMounted(false);
      }
    });

    return () => animation.stop();
  }, [mounted, progress, visible]);

  const content = React.useMemo(
    () => (
      <RubanThemeProvider mode={themeMode}>
        <BottomSheetLayer
          title={title}
          onDismiss={onDismiss}
          progress={progress}
          testID={testID}
        >
          {children}
        </BottomSheetLayer>
      </RubanThemeProvider>
    ),
    [children, onDismiss, progress, testID, themeMode, title]
  );

  useOverlayLayer({
    id: resolvedId,
    visible: mounted,
    strategy,
    content,
    onRequestClose: onDismiss,
  });

  return null;
}

function BottomSheetLayer({
  title,
  onDismiss,
  progress,
  children,
  testID,
}: {
  title: string;
  onDismiss: () => void;
  progress: Animated.Value;
  children: React.ReactNode;
  testID?: string;
}): React.ReactElement {
  const colors = useRubanColors();
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [520, 0],
  });

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        testID={testID}
        accessibilityViewIsModal
        style={[
          styles.sheet,
          {
            backgroundColor: colors.navigationSurface,
            borderColor: colors.borderStrong,
            transform: [{ translateY }],
          },
        ]}
      >
        <View
          style={[styles.handle, { backgroundColor: colors.borderStrong }]}
        />
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
          <Pressable accessibilityRole="button" onPress={onDismiss} hitSlop={8}>
            <Text style={[styles.close, { color: colors.faint }]}>CLOSE</Text>
          </Pressable>
        </View>
        <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
          {children}
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

export type SelectionOption<Value extends string> = {
  value: Value;
  label: string;
  meta?: string;
};

export function SelectionBottomSheet<Value extends string>({
  visible,
  title,
  value,
  options,
  onChange,
  onDismiss,
  testID,
}: {
  visible: boolean;
  title: string;
  value: Value;
  options: ReadonlyArray<SelectionOption<Value>>;
  onChange: (value: Value) => void;
  onDismiss: () => void;
  testID?: string;
}): React.ReactElement | null {
  const colors = useRubanColors();

  return (
    <BottomSheetModal
      visible={visible}
      title={title}
      onDismiss={onDismiss}
      testID={testID}
    >
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              key={option.value}
              testID={`sheet-option-${option.value}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                onChange(option.value);
                onDismiss();
              }}
              style={({ pressed }) => [
                styles.option,
                { borderBottomColor: colors.border },
                selected
                  ? { backgroundColor: colors.navigationActive }
                  : undefined,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <View>
                <Text style={[styles.optionLabel, { color: colors.ink }]}>
                  {option.label}
                </Text>
                {option.meta ? (
                  <Text style={[styles.optionMeta, { color: colors.faint }]}>
                    {option.meta}
                  </Text>
                ) : null}
              </View>
              {selected ? (
                <Text style={[styles.optionState, { color: colors.accent }]}>
                  SELECTED
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0, 0, 0, 0.56)",
  },
  sheet: { maxHeight: "82%", borderTopWidth: 1 },
  handle: { width: 42, height: 3, marginTop: 10, alignSelf: "center" },
  header: {
    minHeight: 66,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
    letterSpacing: -0.45,
  },
  close: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  safeArea: { flexShrink: 1 },
  options: { paddingBottom: spacing.sm },
  option: {
    minHeight: 76,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionLabel: { fontSize: 16, lineHeight: 21, fontWeight: "800" },
  optionMeta: {
    marginTop: 4,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  optionState: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  pressed: { opacity: 0.62 },
});
