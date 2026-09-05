import {
  BottomSheetBackdrop,
  BottomSheetModal as GorhomBottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {
  BackIcon,
  CheckIcon,
  type RubanIconProps,
} from '@ruban-labs/react-native-ui-icons';
import * as React from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, useRubanColors } from '../../design/tokens';

export type BottomSheetModalRootProps = {
  visible: boolean;
  onDismiss: () => void;
  onAfterDismiss?: () => void;
  children: React.ReactNode;
  overlayId?: string;
  enablePanDownToClose?: boolean;
  enableDynamicSizing?: boolean;
  snapPoints?: Array<number | string>;
  onRequestBack?: () => void;
};

export function BottomSheetModalRoot({
  visible,
  onDismiss,
  onAfterDismiss,
  children,
  overlayId,
  enablePanDownToClose = true,
  enableDynamicSizing = true,
  snapPoints,
  onRequestBack,
}: BottomSheetModalRootProps): React.ReactElement {
  const colors = useRubanColors();
  const modalRef =
    React.useRef<React.ElementRef<typeof GorhomBottomSheetModal>>(null);
  const presentedRef = React.useRef(false);
  const [androidBackActive, setAndroidBackActive] = React.useState(false);
  const { height: windowHeight } = useWindowDimensions();

  React.useEffect(() => {
    let frame = 0;

    if (visible) {
      frame = requestAnimationFrame(() => {
        presentedRef.current = true;
        setAndroidBackActive(true);
        modalRef.current?.present();
      });
    } else if (presentedRef.current) {
      modalRef.current?.dismiss();
    } else {
      setAndroidBackActive(false);
    }

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [visible]);

  const handleDismiss = React.useCallback(() => {
    presentedRef.current = false;
    setAndroidBackActive(false);
    if (visible) {
      onDismiss();
    }
    onAfterDismiss?.();
  }, [onAfterDismiss, onDismiss, visible]);

  React.useEffect(() => {
    if (Platform.OS !== 'android' || !androidBackActive) return;

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (visible) {
          (onRequestBack || onDismiss)();
        }
        return true;
      },
    );

    return () => subscription.remove();
  }, [androidBackActive, onDismiss, onRequestBack, visible]);

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
      enableDynamicSizing={enableDynamicSizing}
      snapPoints={snapPoints}
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
        { backgroundColor: colors.ink },
      ]}
      handleStyle={[
        styles.handle,
        {
          backgroundColor: colors.navigationSurface,
          borderBottomColor: colors.border,
        },
      ]}
    >
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
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onDismiss}
              hitSlop={8}
            >
              <Text style={[styles.close, { color: colors.faint }]}>CLOSE</Text>
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

export type BottomSheetFlowController<Route extends string> = {
  route: Route;
  canGoBack: boolean;
  push: (route: Route) => void;
  back: () => void;
  dismiss: () => void;
};

export function BottomSheetFlow<Route extends string>({
  visible,
  initialRoute,
  title,
  renderRightAction,
  renderContent,
  onDismiss,
  onAfterDismiss,
  overlayId,
  testID,
  enableDynamicSizing,
  snapPoints,
}: {
  visible: boolean;
  initialRoute: Route;
  title: (controller: BottomSheetFlowController<Route>) => string | undefined;
  renderRightAction?: (
    controller: BottomSheetFlowController<Route>,
  ) => React.ReactNode;
  renderContent: (
    controller: BottomSheetFlowController<Route>,
  ) => React.ReactNode;
  onDismiss: () => void;
  onAfterDismiss?: () => void;
  overlayId?: string;
  testID?: string;
  enableDynamicSizing?: boolean;
  snapPoints?: Array<number | string>;
}): React.ReactElement {
  const colors = useRubanColors();
  const [routes, setRoutes] = React.useState<readonly Route[]>([initialRoute]);
  const route = routes[routes.length - 1] || initialRoute;
  const canGoBack = routes.length > 1;

  React.useEffect(() => {
    if (!visible) setRoutes([initialRoute]);
  }, [initialRoute, visible]);

  const push = React.useCallback((nextRoute: Route) => {
    setRoutes(currentRoutes =>
      currentRoutes[currentRoutes.length - 1] === nextRoute
        ? currentRoutes
        : [...currentRoutes, nextRoute],
    );
  }, []);
  const back = React.useCallback(() => {
    setRoutes(currentRoutes =>
      currentRoutes.length > 1 ? currentRoutes.slice(0, -1) : currentRoutes,
    );
  }, []);
  const controller = React.useMemo<BottomSheetFlowController<Route>>(
    () => ({ route, canGoBack, push, back, dismiss: onDismiss }),
    [back, canGoBack, onDismiss, push, route],
  );
  const currentTitle = title(controller);
  const handleRequestBack = React.useCallback(() => {
    if (canGoBack) {
      back();
      return;
    }
    onDismiss();
  }, [back, canGoBack, onDismiss]);

  return (
    <BottomSheetModalRoot
      visible={visible}
      onDismiss={onDismiss}
      onAfterDismiss={onAfterDismiss}
      overlayId={overlayId}
      onRequestBack={handleRequestBack}
      enableDynamicSizing={enableDynamicSizing}
      snapPoints={snapPoints}
    >
      <BottomSheetView testID={testID} style={styles.flow}>
        <View style={[styles.flowHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.flowHeaderSlot}>
            {canGoBack ? (
              <Pressable
                testID="bottom-sheet-flow-back"
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={8}
                onPress={back}
                style={({ pressed }) => [
                  styles.flowHeaderButton,
                  pressed ? styles.flowHeaderButtonPressed : undefined,
                ]}
              >
                <BackIcon size={24} color={colors.ink} />
              </Pressable>
            ) : null}
          </View>
          {currentTitle ? (
            <Text style={[styles.flowTitle, { color: colors.ink }]}>
              {currentTitle}
            </Text>
          ) : (
            <View />
          )}
          <View style={[styles.flowHeaderSlot, styles.flowHeaderRight]}>
            {renderRightAction ? renderRightAction(controller) : null}
          </View>
        </View>
        {renderContent(controller)}
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
      testID={testID}
    >
      <View style={styles.options}>
        {options.map((option, index) => {
          const selected = option.value === value;
          const OptionIcon = option.icon;

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
              style={[
                styles.option,
                {
                  backgroundColor: selected
                    ? colors.accentSoft
                    : colors.choiceSurface,
                },
                index < options.length - 1 ? styles.optionSpacing : undefined,
              ]}
            >
              <View style={styles.optionIdentity}>
                {OptionIcon ? (
                  <OptionIcon
                    size={22}
                    color={selected ? colors.accent : colors.muted}
                  />
                ) : null}
                <View style={OptionIcon ? styles.optionCopy : undefined}>
                  <Text style={[styles.optionLabel, { color: colors.ink }]}>
                    {option.label}
                  </Text>
                  {option.meta ? (
                    <Text style={[styles.optionMeta, { color: colors.faint }]}>
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
  background: { borderWidth: 1, borderBottomWidth: 0, borderRadius: 0 },
  handle: {
    height: 28,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  handleIndicator: { width: 44, height: 3, borderRadius: 0 },
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
  flowHeader: {
    minHeight: 54,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flow: { flex: 1 },
  flowHeaderSlot: {
    width: 48,
    minHeight: 48,
    justifyContent: 'center',
  },
  flowHeaderRight: { alignItems: 'flex-end' },
  flowHeaderButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowHeaderButtonPressed: { opacity: 0.62 },
  flowTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  safeArea: { flexShrink: 1 },
  options: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  optionSpacing: { marginBottom: spacing.sm },
  option: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionIdentity: { flexDirection: 'row', alignItems: 'center' },
  optionCopy: { marginLeft: 12 },
  optionLabel: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  optionMeta: {
    marginTop: 4,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
