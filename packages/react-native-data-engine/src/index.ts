import {
  NativeEventEmitter,
  NativeModules,
  type EmitterSubscription,
} from 'react-native';

export type PortfolioProviderId = 'debank';
export type PortfolioProviderMode = 'mock' | 'byok';
export type PortfolioCredentialState = 'mock' | 'missing' | 'configured';
export type PortfolioSyncStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed';

export type PortfolioDataSource = {
  providerId: PortfolioProviderId;
  mode: PortfolioProviderMode;
  credentialState: PortfolioCredentialState;
  enabled: boolean;
  updatedAt: number;
};

export type PortfolioSyncState = {
  providerId: PortfolioProviderId;
  address: string;
  runId: string;
  state: PortfolioSyncStatus;
  stage: string;
  completedChains: number;
  totalChains: number;
  updatedAt: number;
  errorCode?: string;
};

export type PortfolioSyncResult = {
  providerId: PortfolioProviderId;
  address: string;
  runId: string;
  completedChains: number;
  totalChains: number;
  observedAt: number;
};

type NativeDataEngine = {
  initialize(databasePath: string): Promise<void>;
  configureMockSource(providerId: PortfolioProviderId): Promise<PortfolioDataSource>;
  syncMockPortfolio(
    providerId: PortfolioProviderId,
    address: string,
  ): Promise<PortfolioSyncResult>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
};

const syncStateEvent = 'RubanDataEngineSyncState';
const nativeDataEngine = NativeModules.RubanDataEngine as
  | NativeDataEngine
  | undefined;

function requireNativeDataEngine(): NativeDataEngine {
  if (!nativeDataEngine) {
    throw new Error(
      '@ruban-labs/react-native-data-engine is not linked into this app',
    );
  }
  return nativeDataEngine;
}

export const dataEngine = {
  initialize(databasePath: string): Promise<void> {
    return requireNativeDataEngine().initialize(databasePath);
  },

  configureMockDeBank(): Promise<PortfolioDataSource> {
    return requireNativeDataEngine().configureMockSource('debank');
  },

  syncMockPortfolio(address: string): Promise<PortfolioSyncResult> {
    return requireNativeDataEngine().syncMockPortfolio('debank', address);
  },

  addSyncStateListener(
    listener: (state: PortfolioSyncState) => void,
  ): EmitterSubscription {
    const module = requireNativeDataEngine();
    return new NativeEventEmitter(module).addListener(syncStateEvent, state => {
      listener(state as unknown as PortfolioSyncState);
    });
  },
};
