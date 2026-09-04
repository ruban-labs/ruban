import {
  BottomSheetBackdrop,
  BottomSheetModal as GorhomBottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {
  CheckIcon,
  type RubanIconProps,
} from '@ruban-labs/react-native-ui-icons';
import * as React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {radius, spacing, useRubanColors} from '../../design/tokens';

export type BottomSheetModalRootProps = {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  overlayId?: string;
  enablePanDownToClose?: boolean;
};

export function BottomSheetModalRoot({
  visible,
  onDismiss,
  children,
  overlayId,
  enablePanDownToClose = true,
}: BottomSheetModalRootProps): React.ReactElement {
  const colors = useRubanColors();
  const modalRef =
    React.useRef<React.ElementRef<typeof GorhomBottomSheetModal>>(null);
  const presentedRef = React.useRef(false);
  const {height: windowHeight} = useWindowDimensions();

  React.useEffect(() => {
    let frame = 0;

    if (visible) {
      frame = requestAnimationFrame(() => {
        presentedRef.current = true;
        modalRef.current?.present();
      });
    } else if (presentedRef.current) {
      modalRef.current?.dismiss();
    }

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [visible]);

  const handleDismiss = React.useCallback(() => {
    presentedRef.current = false;
    if (visible) {
      onDismiss();
    }
  }, [onDismiss, visible]);

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.48}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <GorhomBottomSheetModal
      ref={modalRef}
      name={overlayId}
      accessible={false}
      index={0}
      animateOnMount
      enableDynamicSizing
      maxDynamicContentSize={Math.round(windowHeight * 0.82)}
      enablePanDownToClose={enablePanDownToClose}
      backdropComponent={renderBackdrop}
      onDismiss={handleDismiss}
      backgroundStyle={[
        styles.background,
        {
          backgroundColor: colors.navigationSurface,
          borderColor: colors.borderStrong,
        },
      ]}
      handleIndicatorStyle={[
        styles.handleIndicator,
        {backgroundColor: colors.ink},
      ]}
      handleStyle={[
        styles.handle,
        {
          backgroundColor: colors.navigationSurface,
          borderBottomColor: colors.border,
        },
      ]}>
      {children}
    </GorhomBottomSheetModal>
  );
}

export type BottomSheetModalProps = BottomSheetModalRootProps & {
  title: string;
  showHeader?: boolean;
  testID?: string;
};

export function BottomSheetModal({
  title,
  showHeader = true,
  testID,
  children,
  onDismiss,
  ...rootProps
}: BottomSheetModalProps): React.ReactElement {
  const colors = useRubanColors();

  return (
    <BottomSheetModalRoot {...rootProps} onDismiss={onDismiss}>
      <BottomSheetView testID={testID}>
        {showHeader ? (
          <View style={[styles.header, {borderBottomColor: colors.border}]}>
            <Text style={[styles.title, {color: colors.ink}]}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onDismiss}
              hitSlop={8}>
              <Text style={[styles.close, {color: colors.faint}]}>CLOSE</Text>
            </Pressable>
          </View>
        ) : null}
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          {children}
        </SafeAreaView>
      </BottomSheetView>
    </BottomSheetModalRoot>
  );
}

export type SelectionOption<Value extends string> = {
  value: Value;
  label: string;
  meta?: string;
  icon?: React.ComponentType<RubanIconProps>;
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
}): React.ReactElement {
  const colors = useRubanColors();
  const selectedIndicatorColor = colors.mode === 'dark' ? '#4ADE80' : '#15803D';

  return (
    <BottomSheetModal
      visible={visible}
      title={title}
      showHeader={false}
      onDismiss={onDismiss}
      testID={testID}>
      <View style={styles.options}>
        {options.map((option, index) => {
          const selected = option.value === value;
          const OptionIcon = option.icon;

          return (
            <Pressable
              key={option.value}
              testID={`sheet-option-${option.value}`}
              accessibilityRole="radio"
              accessibilityState={{selected}}
              onPress={() => {
                onChange(option.value);
                onDismiss();
              }}
              style={[
                styles.option,
                {
                  backgroundColor: selected
                    ? colors.accentSoft
                    : colors.choiceSurface,
                },
                index < options.length - 1 ? styles.optionSpacing : undefined,
              ]}>
              <View style={styles.optionIdentity}>
                {OptionIcon ? (
                  <OptionIcon
                    size={22}
                    color={selected ? colors.accent : colors.muted}
                  />
                ) : null}
                <View style={OptionIcon ? styles.optionCopy : undefined}>
                  <Text style={[styles.optionLabel, {color: colors.ink}]}>
                    {option.label}
                  </Text>
                  {option.meta ? (
                    <Text style={[styles.optionMeta, {color: colors.faint}]}>
                      {option.meta}
                    </Text>
                  ) : null}
                </View>
              </View>
              {selected ? (
                <CheckIcon size={22} color={selectedIndicatorColor} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: {borderWidth: 1, borderBottomWidth: 0, borderRadius: 0},
  handle: {
    height: 28,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  handleIndicator: {width: 44, height: 3, borderRadius: 0},
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
  close: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  safeArea: {flexShrink: 1},
  options: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  optionSpacing: {marginBottom: spacing.sm},
  option: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionIdentity: {flexDirection: 'row', alignItems: 'center'},
  optionCopy: {marginLeft: 12},
  optionLabel: {fontSize: 16, lineHeight: 21, fontWeight: '800'},
  optionMeta: {
    marginTop: 4,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
