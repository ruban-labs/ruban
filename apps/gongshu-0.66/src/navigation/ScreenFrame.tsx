import * as React from 'react';
import {StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRubanColors} from '../design/tokens';

export type BottomInsetPolicy = 'tab-owned' | 'screen-owned' | 'edge-to-edge';

export function ScreenFrame({
  bottomInset,
  children,
}: {
  bottomInset: BottomInsetPolicy;
  children: React.ReactNode;
}): React.ReactElement {
  const colors = useRubanColors();
  const edges =
    bottomInset === 'screen-owned' ? (['bottom'] as const) : ([] as const);

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.frame, {backgroundColor: colors.canvas}]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  frame: {flex: 1},
});
