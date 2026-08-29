import * as React from 'react';
import {StyleSheet, View, type ViewProps} from 'react-native';
import {useRubanColors} from '../../design/tokens';

export const separatorOrientations = ['horizontal', 'vertical'] as const;
export const separatorTones = ['default', 'strong', 'accent'] as const;
export const separatorWeights = ['hairline', 'regular', 'bold'] as const;

export type SeparatorOrientation = (typeof separatorOrientations)[number];
export type SeparatorTone = (typeof separatorTones)[number];
export type SeparatorWeight = (typeof separatorWeights)[number];

export type SeparatorProps = ViewProps & {
  orientation?: SeparatorOrientation;
  tone?: SeparatorTone;
  weight?: SeparatorWeight;
  decorative?: boolean;
};

export function Separator({
  orientation = 'horizontal',
  tone = 'default',
  weight = 'regular',
  decorative = true,
  style,
  importantForAccessibility,
  accessibilityElementsHidden,
  ...viewProps
}: SeparatorProps): React.ReactElement {
  const colors = useRubanColors();
  const color = tone === 'accent' ? colors.accent : tone === 'strong' ? colors.ink : colors.border;
  const thickness = weight === 'hairline' ? StyleSheet.hairlineWidth : weight === 'bold' ? 2 : 1;

  return (
    <View
      {...viewProps}
      accessibilityElementsHidden={decorative ? true : accessibilityElementsHidden}
      importantForAccessibility={decorative ? 'no' : importantForAccessibility}
      style={[
        styles.root,
        orientation === 'horizontal'
          ? {alignSelf: 'stretch', height: thickness}
          : {alignSelf: 'stretch', width: thickness},
        {backgroundColor: color},
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: {flexShrink: 0},
});
