import * as React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { radius, spacing, useRubanColors } from '../../design/tokens';
import { useFieldState } from './Field';

export type SelectOption = {
  description?: string;
  label: string;
  value: string;
};

export type SelectProps = Omit<PressableProps, 'children' | 'onPress'> & {
  bottomInset?: number;
  disabled?: boolean;
  invalid?: boolean;
  onValueChange?: (value: string) => void;
  options: ReadonlyArray<SelectOption>;
  placeholder?: string;
  sheetTitle?: string;
  value?: string;
};

function resolveExternalStyle(
  style: PressableProps['style'],
  state: PressableStateCallbackType,
): StyleProp<ViewStyle> {
  return typeof style === 'function' ? style(state) : style;
}

export function Select({
  bottomInset = Platform.OS === 'ios' ? 24 : 0,
  disabled = false,
  invalid = false,
  onValueChange,
  options,
  placeholder = 'Select an option',
  sheetTitle = 'Select',
  value,
  accessibilityLabel,
  accessibilityState,
  style,
  testID,
  ...pressableProps
}: SelectProps): React.ReactElement {
  const colors = useRubanColors();
  const field = useFieldState({ disabled, invalid });
  const [open, setOpen] = React.useState(false);
  const selectedOption = options.find(option => option.value === value);

  return (
    <>
      <Pressable
        {...pressableProps}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || sheetTitle}
        accessibilityValue={{
          text: selectedOption ? selectedOption.label : placeholder,
        }}
        accessibilityState={{
          ...accessibilityState,
          disabled: field.disabled,
          expanded: open,
        }}
        disabled={field.disabled}
        onPress={() => setOpen(true)}
        style={state => [
          styles.trigger,
          {
            backgroundColor: field.disabled
              ? colors.surfaceRaised
              : colors.surface,
            borderColor: field.invalid ? colors.alert : colors.borderStrong,
          },
          state.pressed ? styles.pressed : undefined,
          resolveExternalStyle(style, state),
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.value,
            { color: selectedOption ? colors.ink : colors.faint },
          ]}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.arrow, { color: colors.accent }]}
        >
          ↓
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        hardwareAccelerated
        statusBarTranslucent
        navigationBarTranslucent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Close ${sheetTitle}`}
            onPress={() => setOpen(false)}
            style={styles.backdrop}
          />
          <View
            testID={testID ? `${testID}-sheet` : undefined}
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: colors.navigationSurface,
                borderColor: colors.borderStrong,
                paddingBottom: bottomInset,
              },
            ]}
          >
            <View
              style={[styles.handle, { backgroundColor: colors.borderStrong }]}
            />
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.ink }]}>
                {sheetTitle}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                hitSlop={8}
              >
                <Text style={[styles.close, { color: colors.faint }]}>
                  CLOSE
                </Text>
              </Pressable>
            </View>
            <ScrollView bounces={false} style={styles.options}>
              {options.map(option => {
                const selected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    testID={
                      testID ? `${testID}-option-${option.value}` : undefined
                    }
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => {
                      if (onValueChange) {
                        onValueChange(option.value);
                      }
                      setOpen(false);
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
                    <View style={styles.optionCopy}>
                      <Text style={[styles.optionLabel, { color: colors.ink }]}>
                        {option.label}
                      </Text>
                      {option.description ? (
                        <Text
                          style={[
                            styles.optionDescription,
                            { color: colors.faint },
                          ]}
                        >
                          {option.description}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.optionState,
                        { color: selected ? colors.accent : colors.faint },
                      ]}
                    >
                      {selected ? 'SELECTED' : '—'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 48,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  arrow: {
    marginLeft: spacing.sm,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '900',
  },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
  },
  sheet: { maxHeight: '82%', borderTopWidth: 1 },
  handle: { width: 42, height: 3, marginTop: 10, alignSelf: 'center' },
  header: {
    minHeight: 66,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.45,
  },
  close: { fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 1.1 },
  options: { flexGrow: 0, paddingBottom: spacing.sm },
  option: {
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionCopy: { flex: 1, paddingVertical: 13, paddingRight: spacing.md },
  optionLabel: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  optionDescription: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  optionState: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  pressed: { opacity: 0.62 },
});
