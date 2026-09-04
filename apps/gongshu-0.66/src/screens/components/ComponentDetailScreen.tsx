import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import * as React from 'react';
import {BackHandler, StyleSheet, Text, View} from 'react-native';
import {RubanScreen} from '../../components/RubanPrimitives';
import {Button} from '../../components/ui/Button';
import {spacing, useRubanColors} from '../../design/tokens';
import type {RootStackParamList} from '../../navigation/types';
import BadgeShowcaseScreen from './BadgeShowcaseScreen';
import ButtonShowcaseScreen from './ButtonShowcaseScreen';
import CardShowcaseScreen from './CardShowcaseScreen';
import CollapsibleShowcaseScreen from './CollapsibleShowcaseScreen';
import DialogShowcaseScreen from './DialogShowcaseScreen';
import FormKitShowcaseScreen, {
  isFormComponentId,
} from './FormKitShowcaseScreen';
import FormWorkbenchScreen from './FormWorkbenchScreen';
import SeparatorShowcaseScreen from './SeparatorShowcaseScreen';
import SwitchShowcaseScreen from './SwitchShowcaseScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'ComponentDetail'>;

export default function ComponentDetailScreen(
  props: Props,
): React.ReactElement {
  const onBack = React.useCallback(() => {
    if (props.navigation.canGoBack()) {
      props.navigation.goBack();
      return;
    }

    props.navigation.navigate('Main', {screen: 'Home'});
  }, [props.navigation]);

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (props.navigation.canGoBack()) {
          return false;
        }

        props.navigation.navigate('Main', {screen: 'Home'});
        return true;
      },
    );

    return () => subscription.remove();
  }, [props.navigation]);

  if (props.route.params.component === 'button') {
    return <ButtonShowcaseScreen {...props} onBack={onBack} />;
  }

  if (props.route.params.component === 'card') {
    return <CardShowcaseScreen {...props} onBack={onBack} />;
  }

  if (props.route.params.component === 'badge') {
    return <BadgeShowcaseScreen {...props} onBack={onBack} />;
  }

  if (props.route.params.component === 'separator') {
    return <SeparatorShowcaseScreen {...props} onBack={onBack} />;
  }

  if (props.route.params.component === 'switch') {
    return <SwitchShowcaseScreen {...props} onBack={onBack} />;
  }

  if (props.route.params.component === 'collapsible') {
    return <CollapsibleShowcaseScreen {...props} onBack={onBack} />;
  }

  if (props.route.params.component === 'dialog') {
    return <DialogShowcaseScreen {...props} onBack={onBack} />;
  }

  if (isFormComponentId(props.route.params.component)) {
    return <FormKitShowcaseScreen {...props} onBack={onBack} />;
  }

  if (props.route.params.component === 'form') {
    return <FormWorkbenchScreen {...props} onBack={onBack} />;
  }

  return <UnknownComponentScreen onBack={onBack} />;
}

function UnknownComponentScreen({
  onBack,
}: {
  onBack: () => void;
}): React.ReactElement {
  const colors = useRubanColors();
  return (
    <RubanScreen>
      <Text style={[styles.eyebrow, {color: colors.accent}]}>
        COMPONENT / UNKNOWN
      </Text>
      <Text style={[styles.title, {color: colors.ink}]}>Not found</Text>
      <View style={styles.action}>
        <Button onPress={onBack}>BACK TO COMPONENTS</Button>
      </View>
    </RubanScreen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  title: {
    marginTop: 12,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '800',
    letterSpacing: -1.8,
  },
  action: {marginTop: spacing.xl, alignItems: 'flex-start'},
});
