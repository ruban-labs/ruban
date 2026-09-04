import * as React from "react";
import { StyleSheet } from "react-native";
import { Input, type InputHandle, type InputProps } from "./Input";

export type TextareaProps = InputProps & {
  minRows?: number;
};

export const Textarea: React.ForwardRefExoticComponent<
  TextareaProps & React.RefAttributes<InputHandle>
> = React.forwardRef<InputHandle, TextareaProps>(function RubanTextarea(
  { minRows = 4, numberOfLines, style, ...inputProps },
  ref
): React.ReactElement {
  return (
    <Input
      {...inputProps}
      ref={ref}
      multiline
      numberOfLines={numberOfLines || minRows}
      textAlignVertical="top"
      style={[styles.textarea, { minHeight: 28 + minRows * 20 }, style]}
    />
  );
});

const styles = StyleSheet.create({
  textarea: { paddingTop: 12 },
});
