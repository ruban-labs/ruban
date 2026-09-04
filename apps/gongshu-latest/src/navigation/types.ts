import type { NavigatorScreenParams } from '@react-navigation/native';

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

export type DAppTestRouteParams = {
  dapp?: string;
  method?: string;
  params?: string;
  runId?: string;
  timeoutMs?: string;
};

export type TabParamList = {
  Home: undefined;
  DApps: undefined;
  Settings: SettingsRouteParams | undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined;
  DeveloperLab: PlaygroundRouteParams | undefined;
  DAppBrowser: { url: string; title?: string };
  DAppTest: DAppTestRouteParams;
  ComponentDetail: ComponentDetailRouteParams;
};
