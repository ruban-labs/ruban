import * as React from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type TextProps,
  type ViewProps,
} from 'react-native';
import {
  radius,
  RubanThemeProvider,
  spacing,
  useRubanColors,
} from '../../design/tokens';
import {
  useOverlayLayer,
  useStableOverlayId,
  type OverlayStrategy,
} from './OverlayHost';

type DialogContextValue = {
  id: string;
  open: boolean;
  strategy: OverlayStrategy;
  setOpen: (open: boolean) => void;
};

type DialogActionChildProps = {
  disabled?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
};

export type DialogRootProps = {
  children: React.ReactNode;
  id?: string;
  open?: boolean;
  defaultOpen?: boolean;
  strategy?: OverlayStrategy;
  onOpenChange?: (open: boolean) => void;
};

export type DialogContentProps = Omit<ViewProps, 'children'> & {
  children: React.ReactNode;
  dismissOnBackdrop?: boolean;
  role?: 'dialog' | 'alert';
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

export function DialogRoot({
  children,
  id,
  open,
  defaultOpen = false,
  strategy = 'queue',
  onOpenChange,
}: DialogRootProps): React.ReactElement {
  const generatedId = useStableOverlayId('dialog');
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const controlled = open !== undefined;
  const resolvedOpen = controlled ? open : uncontrolledOpen;
  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!controlled) {
        setUncontrolledOpen(nextOpen);
      }
      if (onOpenChange) {
        onOpenChange(nextOpen);
      }
    },
    [controlled, onOpenChange],
  );
  const contextValue = React.useMemo<DialogContextValue>(
    () => ({
      id: id || generatedId,
      open: resolvedOpen,
      strategy,
      setOpen,
    }),
    [generatedId, id, resolvedOpen, setOpen, strategy],
  );

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({
  children,
}: {
  children: React.ReactElement<DialogActionChildProps>;
}): React.ReactElement {
  const dialog = useDialogContext();
  const child = React.Children.only(children);

  return React.cloneElement(child, {
    onPress: (event: GestureResponderEvent) => {
      if (child.props.onPress) {
        child.props.onPress(event);
      }
      if (!child.props.disabled) {
        dialog.setOpen(true);
      }
    },
  });
}

export function DialogClose({
  children,
}: {
  children: React.ReactElement<DialogActionChildProps>;
}): React.ReactElement {
  const dialog = useDialogContext();
  const child = React.Children.only(children);

  return React.cloneElement(child, {
    onPress: (event: GestureResponderEvent) => {
      if (child.props.onPress) {
        child.props.onPress(event);
      }
      if (!child.props.disabled) {
        dialog.setOpen(false);
      }
    },
  });
}

export function DialogContent({
  children,
  dismissOnBackdrop = true,
  role = 'dialog',
  accessibilityLabel,
  style,
  testID,
  ...viewProps
}: DialogContentProps): null {
  const dialog = useDialogContext();
  const themeMode = useRubanColors().mode;
  const [mounted, setMounted] = React.useState(dialog.open);
  const progress = React.useRef(
    new Animated.Value(dialog.open ? 1 : 0),
  ).current;

  React.useEffect(() => {
    if (dialog.open) {
      setMounted(true);
    }
  }, [dialog.open]);

  React.useEffect(() => {
    if (!mounted) {
      return;
    }

    const animation = Animated.timing(progress, {
      toValue: dialog.open ? 1 : 0,
      duration: dialog.open ? 180 : 140,
      useNativeDriver: true,
    });

    animation.start(({finished}) => {
      if (finished && !dialog.open) {
        setMounted(false);
      }
    });

    return () => animation.stop();
  }, [dialog.open, mounted, progress]);

  const requestClose = React.useCallback(() => dialog.setOpen(false), [dialog]);
  const content = React.useMemo(
    () => (
      <RubanThemeProvider mode={themeMode}>
        <DialogContext.Provider value={dialog}>
          <DialogLayer
            {...viewProps}
            accessibilityLabel={accessibilityLabel}
            dismissOnBackdrop={dismissOnBackdrop}
            progress={progress}
            requestClose={requestClose}
            role={role}
            style={style}
            testID={testID}>
            {children}
          </DialogLayer>
        </DialogContext.Provider>
      </RubanThemeProvider>
    ),
    [
      accessibilityLabel,
      children,
      dialog,
      dismissOnBackdrop,
      progress,
      requestClose,
      role,
      style,
      testID,
      themeMode,
      viewProps,
    ],
  );

  useOverlayLayer({
    id: dialog.id,
    visible: mounted,
    strategy: dialog.strategy,
    content,
    onRequestClose: requestClose,
  });

  return null;
}

function DialogLayer({
  children,
  dismissOnBackdrop,
  progress,
  requestClose,
  role,
  style,
  ...viewProps
}: ViewProps & {
  children: React.ReactNode;
  dismissOnBackdrop: boolean;
  progress: Animated.Value;
  requestClose: () => void;
  role: 'dialog' | 'alert';
}): React.ReactElement {
  const colors = useRubanColors();
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1],
  });

  return (
    <View style={styles.layer}>
      <Animated.View style={[styles.backdrop, {opacity: progress}]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
          disabled={!dismissOnBackdrop}
          onPress={requestClose}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
        style={styles.positioner}>
        <Animated.View
          {...viewProps}
          accessibilityRole={role === 'alert' ? 'alert' : undefined}
          accessibilityViewIsModal
          style={[
            styles.content,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderStrong,
              opacity: progress,
              transform: [{translateY}, {scale}],
            },
            style,
          ]}>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

export function DialogHeader({
  style,
  ...viewProps
}: ViewProps): React.ReactElement {
  return <View {...viewProps} style={[styles.header, style]} />;
}

export function DialogTitle({
  style,
  ...textProps
}: TextProps): React.ReactElement {
  const colors = useRubanColors();
  return (
    <Text
      accessibilityRole="header"
      {...textProps}
      style={[styles.title, {color: colors.ink}, style]}
    />
  );
}

export function DialogDescription({
  style,
  ...textProps
}: TextProps): React.ReactElement {
  const colors = useRubanColors();
  return (
    <Text
      {...textProps}
      style={[styles.description, {color: colors.muted}, style]}
    />
  );
}

export function DialogFooter({
  style,
  ...viewProps
}: ViewProps): React.ReactElement {
  return <View {...viewProps} style={[styles.footer, style]} />;
}

function useDialogContext(): DialogContextValue {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error('Dialog components must be rendered inside Dialog.Root.');
  }
  return context;
}

export const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Close: DialogClose,
  Content: DialogContent,
  Header: DialogHeader,
  Title: DialogTitle,
  Description: DialogDescription,
  Footer: DialogFooter,
};

const styles = StyleSheet.create({
  layer: {flex: 1},
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
  },
  positioner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '88%',
    padding: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  header: {paddingBottom: spacing.md},
  title: {
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  description: {marginTop: 8, fontSize: 14, lineHeight: 20, fontWeight: '600'},
  footer: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
});
