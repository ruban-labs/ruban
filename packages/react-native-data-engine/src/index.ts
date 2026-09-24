import {
  NativeEventEmitter,
  NativeModules,
  type EmitterSubscription,
} from 'react-native';

export type PortfolioProviderId = 'debank';
export type PortfolioProviderMode = 'mock' | 'byok';
export type PortfolioCredentialState = 'mock' | 'missing' | 'configured';
export type PortfolioSyncMode = 'full' | 'incremental';
export type PortfolioSyncStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

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
  requestCount: number;
  attemptCount: number;
};

export type PortfolioSyncCancellation = {
  providerId: PortfolioProviderId;
  address: string;
  cancelled: boolean;
  runId?: string;
};

export type PortfolioCredentialStatus = {
  providerId: PortfolioProviderId;
  credentialState: Exclude<PortfolioCredentialState, 'mock'>;
};

export type PortfolioSyncChain = {
  id: number;
  key: string;
};

export type PortfolioSyncOptions =
  | { mode?: 'full'; chains?: never }
  | { mode: 'incremental'; chains: PortfolioSyncChain[] };

type NormalizedPortfolioSyncOptions = {
  mode: PortfolioSyncMode;
  chains: PortfolioSyncChain[];
};

type NativeDataEngine = {
  initialize(databasePath: string): Promise<void>;
  configureMockSource(providerId: PortfolioProviderId): Promise<PortfolioDataSource>;
  configureByokSource(providerId: PortfolioProviderId): Promise<PortfolioDataSource>;
  importDeBankAccessKey(accessKey: string): Promise<PortfolioCredentialStatus>;
  clearDeBankAccessKey(): Promise<PortfolioCredentialStatus>;
  getDeBankCredentialState(): Promise<PortfolioCredentialStatus>;
  syncPortfolio(
    providerId: PortfolioProviderId,
    address: string,
    options: NormalizedPortfolioSyncOptions,
  ): Promise<PortfolioSyncResult>;
  syncMockPortfolio(
    providerId: PortfolioProviderId,
    address: string,
  ): Promise<PortfolioSyncResult>;
  cancelPortfolioSync(
    providerId: PortfolioProviderId,
    address: string,
  ): Promise<PortfolioSyncCancellation>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
};

const syncStateEvent = 'RubanDataEngineSyncState';
const nativeDataEngine = NativeModules.RubanDataEngine as
  | NativeDataEngine
  | undefined;

type ActiveSync = {
  fingerprint: string;
  promise: Promise<PortfolioSyncResult>;
};

const activeSyncs = new Map<string, ActiveSync>();

function requireNativeDataEngine(): NativeDataEngine {
  if (!nativeDataEngine) {
    throw new Error(
      '@ruban-labs/react-native-data-engine is not linked into this app',
    );
  }
  return nativeDataEngine;
}

function normalizeSyncOptions(
  options: PortfolioSyncOptions = {},
): NormalizedPortfolioSyncOptions {
  const mode = options.mode || 'full';
  if (mode === 'full') return { mode, chains: [] };

  const chains = options.chains;
  if (!Array.isArray(chains) || chains.length === 0 || chains.length > 128) {
    throw new Error('invalid_incremental_chains');
  }
  const ids = new Set<number>();
  const keys = new Set<string>();
  const normalizedChains = chains.map(chain => {
    if (
      !Number.isSafeInteger(chain.id) ||
      chain.id <= 0 ||
      !/^[a-z0-9_-]{1,32}$/.test(chain.key) ||
      ids.has(chain.id) ||
      keys.has(chain.key)
    ) {
      throw new Error('invalid_incremental_chains');
    }
    ids.add(chain.id);
    keys.add(chain.key);
    return { id: chain.id, key: chain.key };
  });
  return { mode, chains: normalizedChains };
}

function scheduleSync(
  address: string,
  fingerprint: string,
  start: () => Promise<PortfolioSyncResult>,
): Promise<PortfolioSyncResult> {
  const key = `debank:${address.toLowerCase()}`;
  const current = activeSyncs.get(key);
  if (current && current.fingerprint === fingerprint) return current.promise;

  const native = requireNativeDataEngine();
  const pending = current
    ? native.cancelPortfolioSync('debank', address).then(start)
    : start();
  const tracked = pending.finally(() => {
    const active = activeSyncs.get(key);
    if (active && active.promise === tracked) activeSyncs.delete(key);
  });
  activeSyncs.set(key, { fingerprint, promise: tracked });
  return tracked;
}

export const dataEngine = {
  initialize(databasePath: string): Promise<void> {
    return requireNativeDataEngine().initialize(databasePath);
  },

  configureMockDeBank(): Promise<PortfolioDataSource> {
    return requireNativeDataEngine().configureMockSource('debank');
  },

  configureByokDeBank(): Promise<PortfolioDataSource> {
    return requireNativeDataEngine().configureByokSource('debank');
  },

  importDeBankAccessKey(accessKey: string): Promise<PortfolioCredentialStatus> {
    if (!accessKey || accessKey.length > 4096 || accessKey.includes('\0')) {
      return Promise.reject(new Error('invalid_access_key'));
    }
    return requireNativeDataEngine().importDeBankAccessKey(accessKey);
  },

  clearDeBankAccessKey(): Promise<PortfolioCredentialStatus> {
    return requireNativeDataEngine().clearDeBankAccessKey();
  },

  getDeBankCredentialState(): Promise<PortfolioCredentialStatus> {
    return requireNativeDataEngine().getDeBankCredentialState();
  },

  syncPortfolio(
    address: string,
    options: PortfolioSyncOptions = {},
  ): Promise<PortfolioSyncResult> {
    const normalized = normalizeSyncOptions(options);
    return scheduleSync(
      address,
      `current:${JSON.stringify(normalized)}`,
      () =>
        requireNativeDataEngine().syncPortfolio(
          'debank',
          address,
          normalized,
        ),
    );
  },

  syncMockPortfolio(address: string): Promise<PortfolioSyncResult> {
    return scheduleSync(address, 'mock:full', () =>
      requireNativeDataEngine().syncMockPortfolio('debank', address),
    );
  },

  cancelPortfolioSync(address: string): Promise<PortfolioSyncCancellation> {
    return requireNativeDataEngine().cancelPortfolioSync('debank', address);
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
