import * as React from "react";
import {
  StyleSheet,
  Text,
  View,
  type TextProps,
  type ViewProps,
} from "react-native";
import { spacing, useRubanColors } from "@ruban-labs/react-native-ui-theme";

type FieldContextValue = {
  disabled: boolean;
  invalid: boolean;
};

const FieldContext = React.createContext<FieldContextValue>({
  disabled: false,
  invalid: false,
});

export type FieldProps = ViewProps & {
  disabled?: boolean;
  invalid?: boolean;
};

export function Field({
  disabled = false,
  invalid = false,
  accessibilityState,
  style,
  children,
  ...viewProps
}: FieldProps): React.ReactElement {
  const value = React.useMemo(
    () => ({ disabled, invalid }),
    [disabled, invalid]
  );

  return (
    <FieldContext.Provider value={value}>
      <View
        {...viewProps}
        accessibilityState={{ ...accessibilityState, disabled }}
        style={[styles.field, disabled ? styles.disabled : undefined, style]}
      >
        {children}
      </View>
    </FieldContext.Provider>
  );
}

export function useFieldState({
  disabled,
  invalid,
}: {
  disabled?: boolean;
  invalid?: boolean;
} = {}): FieldContextValue {
  const field = React.useContext(FieldContext);
  return {
    disabled: disabled === true || field.disabled,
    invalid: invalid === true || field.invalid,
  };
}

export type FieldLabelProps = TextProps & {
  required?: boolean;
};

export function FieldLabel({
  required = false,
  style,
  children,
  ...textProps
}: FieldLabelProps): React.ReactElement {
  const colors = useRubanColors();
  const field = useFieldState();

  return (
    <Text
      {...textProps}
      style={[
        styles.label,
        { color: field.invalid ? colors.alert : colors.ink },
        style,
      ]}
    >
      {children}
      {required ? <Text style={{ color: colors.alert }}> *</Text> : null}
    </Text>
  );
}

export function FieldDescription({
  style,
  ...textProps
}: TextProps): React.ReactElement {
  const colors = useRubanColors();
  return (
    <Text
      {...textProps}
      style={[styles.supportingText, { color: colors.faint }, style]}
    />
  );
}

export function FieldError({
  style,
  ...textProps
}: TextProps): React.ReactElement {
  const colors = useRubanColors();
  return (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      {...textProps}
      style={[
        styles.supportingText,
        styles.error,
        { color: colors.alert },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  field: { alignSelf: "stretch" },
  disabled: { opacity: 0.48 },
  label: {
    marginBottom: spacing.xs,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    letterSpacing: 0.65,
  },
  supportingText: {
    marginTop: spacing.xs,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  error: { fontWeight: "800" },
});
