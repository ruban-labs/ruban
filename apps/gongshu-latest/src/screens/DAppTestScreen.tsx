import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import * as React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRubanColors} from '../design/tokens';
import {resolveDappTest} from '../dapp/testTargets';
import type {RootStackParamList} from '../navigation/types';
import {appEnvironment} from '../runtime/appEnvironment';
import {useFocusedRubanSystemBars} from '../system/RubanSystemBars';
import {DAppBrowserView} from './DAppBrowserScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'DAppTest'>;

export default function DAppTestScreen({
  route,
  navigation,
}: Props): React.ReactElement {
  const colors = useRubanColors();
  useFocusedRubanSystemBars(colors.mode, colors.surface);

  if (appEnvironment === 'production') {
    return (
      <TestRouteMessage
        testID="dapp-test-disabled"
        eyebrow="DAPP TESTS"
        message="NON-PRODUCTION ONLY"
      />
    );
  }

  try {
    const test = resolveDappTest(route.params);
    return (
      <DAppBrowserView
        navigation={navigation}
        initialUrl={test.target.url}
        title={test.target.title}
        testCommand={test.command}
      />
    );
  } catch (error) {
    return (
      <TestRouteMessage
        testID="dapp-test-invalid"
        eyebrow="DAPP TESTS"
        message={error instanceof Error ? error.message : 'INVALID TEST'}
      />
    );
  }
}

function TestRouteMessage({
  testID,
  eyebrow,
  message,
}: {
  testID: string;
  eyebrow: string;
  message: string;
}): React.ReactElement {
  const colors = useRubanColors();
  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      testID={testID}
      style={[styles.root, {backgroundColor: colors.surface}]}>
      <View style={[styles.rule, {backgroundColor: colors.accent}]} />
      <Text style={[styles.eyebrow, {color: colors.accent}]}>{eyebrow}</Text>
      <Text style={[styles.message, {color: colors.ink}]}>{message}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, paddingHorizontal: 24, justifyContent: 'center'},
  rule: {width: 40, height: 4, marginBottom: 18},
  eyebrow: {fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.5},
  message: {marginTop: 10, fontSize: 28, lineHeight: 34, fontWeight: '800'},
});
