import * as React from 'react';
import {Platform} from 'react-native';

type RuntimeGlobals = typeof globalThis & {
  HermesInternal?: unknown;
  nativeFabricUIManager?: unknown;
};

const runtimeGlobals = globalThis as RuntimeGlobals;

export const buildInfo = {
  edition: '0.77',
  reactNative: '0.77.3',
  react: React.version,
  architecture: runtimeGlobals.nativeFabricUIManager ? 'newArch' : 'oldArch',
  engine: runtimeGlobals.HermesInternal ? 'Hermes' : 'JSC',
  platform: Platform.OS,
  platformVersion: String(Platform.Version),
  channel: __DEV__ ? 'dev' : 'release',
} as const;

export const architectureLabel = buildInfo.architecture === 'newArch' ? 'NEW ARCH' : 'OLD ARCH';
