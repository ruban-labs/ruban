import * as React from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type LinkingOptions,
  type Theme,
} from '@react-navigation/native';
import {createBottomTabNavigator, type BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRubanColors} from '../design/tokens';
import ComponentDetailScreen from '../screens/components/ComponentDetailScreen';
import HomeScreen from '../screens/HomeScreen';
import LabScreen from '../screens/LabScreen';
import SettingsScreen from '../screens/SettingsScreen';
import {ScreenFrame} from './ScreenFrame';
import type {RootStackParamList, TabParamList} from './types';

const Tab = createBottomTabNavigator<TabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

type AppNavigatorProps = {
  onReady?: () => void;
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['ruban-rn077://', 'ruban-rn077-regression://', 'ruban-rn077-debug://'],
  config: {
    initialRouteName: 'Main',
    screens: {
      Main: {
        screens: {
          Home: 'home',
          Playground: 'lab/:tool?',
          Settings: 'settings',
        },
      },
      ComponentDetail: 'components/:component',
    },
  },
};

type RubanTabButtonProps = {
  label: string;
  name: keyof TabParamList;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

const RubanTabButton = React.memo(function RubanTabButtonView({
  label,
  name,
  focused,
  onPress,
  onLongPress,
}: RubanTabButtonProps): React.ReactElement {
  const colors = useRubanColors();

  return (
    <Pressable
      collapsable={false}
      accessibilityRole="button"
      accessibilityState={focused ? {selected: true} : {}}
      accessibilityLabel={label}
      testID={`tab-${name.toLowerCase()}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({pressed}) => [
        styles.tabButton,
        focused ? {backgroundColor: colors.navigationActive} : undefined,
        pressed ? styles.tabButtonPressed : undefined,
      ]}>
      <Text style={[styles.tabLabel, {color: focused ? colors.ink : colors.faint}]}>{label}</Text>
    </Pressable>
  );
});

function RubanTabBar({state, navigation}: BottomTabBarProps): React.ReactElement {
  const colors = useRubanColors();
  const insets = useSafeAreaInsets();
  const activeRouteName = state.routes[state.index]?.name;
  const homeKey = state.routes.find(route => route.name === 'Home')?.key ?? state.routes[0].key;
  const playgroundKey =
    state.routes.find(route => route.name === 'Playground')?.key ?? state.routes[0].key;
  const settingsKey = state.routes.find(route => route.name === 'Settings')?.key ?? state.routes[0].key;
  const openHome = React.useCallback(() => {
    const event = navigation.emit({type: 'tabPress', target: homeKey, canPreventDefault: true});
    if (!event.defaultPrevented) {
      navigation.navigate('Home');
    }
  }, [homeKey, navigation]);
  const openPlayground = React.useCallback(
    () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: playgroundKey,
        canPreventDefault: true,
      });
      if (!event.defaultPrevented) {
        navigation.navigate('Playground', {tool: 'design'});
      }
    },
    [navigation, playgroundKey]
  );
  const openSettings = React.useCallback(() => {
    const event = navigation.emit({type: 'tabPress', target: settingsKey, canPreventDefault: true});
    if (!event.defaultPrevented) {
      navigation.navigate('Settings');
    }
  }, [navigation, settingsKey]);
  const longPressHome = React.useCallback(
    () => navigation.emit({type: 'tabLongPress', target: homeKey}),
    [homeKey, navigation]
  );
  const longPressPlayground = React.useCallback(
    () => navigation.emit({type: 'tabLongPress', target: playgroundKey}),
    [navigation, playgroundKey]
  );
  const longPressSettings = React.useCallback(
    () => navigation.emit({type: 'tabLongPress', target: settingsKey}),
    [navigation, settingsKey]
  );

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: colors.navigationSurface,
          borderTopColor: colors.borderStrong,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}>
      <RubanTabButton
        name="Home"
        label="Home"
        focused={activeRouteName === 'Home'}
        onPress={openHome}
        onLongPress={longPressHome}
      />
      <RubanTabButton
        name="Playground"
        label="Playground"
        focused={activeRouteName === 'Playground'}
        onPress={openPlayground}
        onLongPress={longPressPlayground}
      />
      <RubanTabButton
        name="Settings"
        label="Settings"
        focused={activeRouteName === 'Settings'}
        onPress={openSettings}
        onLongPress={longPressSettings}
      />
    </View>
  );
}

function renderRubanTabBar(props: BottomTabBarProps): React.ReactElement {
  return <RubanTabBar {...props} />;
}

function MainTabs(): React.ReactElement {
  return (
    <ScreenFrame bottomInset="tab-owned">
      <Tab.Navigator
        initialRouteName="Home"
        tabBar={renderRubanTabBar}
        screenOptions={{headerShown: false, lazy: false}}>
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Playground" component={LabScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </ScreenFrame>
  );
}

function ComponentDetailRoute(
  props: NativeStackScreenProps<RootStackParamList, 'ComponentDetail'>
): React.ReactElement {
  return (
    <ScreenFrame bottomInset="screen-owned">
      <ComponentDetailScreen {...props} />
    </ScreenFrame>
  );
}

export default function AppNavigator({onReady}: AppNavigatorProps): React.ReactElement {
  const colors = useRubanColors();
  const baseTheme = colors.mode === 'dark' ? DarkTheme : DefaultTheme;
  const theme = React.useMemo<Theme>(
    () => ({
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: colors.accent,
        background: colors.canvas,
        card: colors.surfaceRaised,
        text: colors.ink,
        border: colors.border,
        notification: colors.accent,
      },
    }),
    [baseTheme, colors]
  );

  return (
    <NavigationContainer linking={linking} onReady={onReady} theme={theme}>
      <RootStack.Navigator
        initialRouteName="Main"
        screenOptions={{headerShown: false, animation: 'slide_from_right'}}>
        <RootStack.Screen name="Main" component={MainTabs} options={{animation: 'none'}} />
        <RootStack.Screen name="ComponentDetail" component={ComponentDetailRoute} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    paddingTop: 7,
    paddingHorizontal: 8,
    flexDirection: 'row',
  },
  tabButton: {flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center'},
  tabButtonPressed: {opacity: 0.62},
  tabLabel: {fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.25},
});
