import {NativeModules} from 'react-native';

export type RubanAppEnvironment = 'production' | 'regression' | 'debug';

type RubanBuildInfoNativeModule = {
  environment?: unknown;
};

function readEnvironment(): RubanAppEnvironment {
  const nativeModule = NativeModules.RubanBuildInfo as
    | RubanBuildInfoNativeModule
    | undefined;
  const value = nativeModule?.environment;
  if (value === 'production' || value === 'regression' || value === 'debug') {
    return value;
  }
  return __DEV__ ? 'debug' : 'production';
}

export const appEnvironment = readEnvironment();
