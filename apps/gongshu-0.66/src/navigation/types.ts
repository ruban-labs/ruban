import type {NavigatorScreenParams} from '@react-navigation/native';

export type PlaygroundRouteParams = {
  tool?: string;
  bar?: string;
  circle?: string;
  pie?: string;
  indeterminate?: string;
  theme?: 'light' | 'dark';
};

export type ComponentDetailRouteParams = {
  component: string;
  theme?: 'light' | 'dark';
  variant?: string;
  size?: string;
  state?: string;
  tone?: string;
  orientation?: string;
  weight?: string;
  scenario?: string;
};

export type SettingsRouteParams = {
  sheet?: 'appearance' | 'build' | 'playground';
};

export type TabParamList = {
  Home: undefined;
  Playground: PlaygroundRouteParams | undefined;
  Settings: SettingsRouteParams | undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined;
  ComponentDetail: ComponentDetailRouteParams;
};
