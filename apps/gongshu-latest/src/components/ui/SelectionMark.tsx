import { CheckIcon } from '@ruban-labs/react-native-ui-icons';
import * as React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useRubanColors } from '../../design/tokens';

export function SelectionMark({
  selected,
}: {
  selected: boolean;
}): React.ReactElement {
  const colors = useRubanColors();
  const colorStyle: ViewStyle = {
    borderColor: selected ? colors.accent : colors.borderStrong,
    backgroundColor: selected ? colors.accent : 'transparent',
  };

  return (
    <View style={[styles.mark, colorStyle]}>
      {selected ? <CheckIcon size={12} color={colors.canvas} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 18,
    height: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
