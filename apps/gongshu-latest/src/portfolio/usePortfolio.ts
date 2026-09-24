import {
  dataEngine,
  type PortfolioSyncState,
} from '@ruban-labs/react-native-data-engine';
import {
  createEvmClient,
  type PortfolioSnapshot,
} from '@ruban-labs/react-native-evm-client';
import * as React from 'react';
import { runUiAppIntent } from '../application/AppIntentRuntime';
import { useDataEngine } from '../data/DataEngineContext';
import type {
  PortfolioChainSnapshotRow,
  PortfolioProtocolPositionRow,
} from '../storage/entities';
import { repositories } from '../storage/repositories';

export const evmClient = createEvmClient({ timeoutMs: 7000 });

type PortfolioState = {
  snapshot: PortfolioSnapshot | null;
  chains: PortfolioChainSnapshotRow[];
  protocols: PortfolioProtocolPositionRow[];
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
};

export type PortfolioSyncProgress = {
  address: string | null;
  completedChains: number;
  totalChains: number;
  stage: string;
};

type PortfolioDataState = {
  address: string | null;
  snapshot: PortfolioSnapshot | null;
  chains: PortfolioChainSnapshotRow[];
  protocols: PortfolioProtocolPositionRow[];
};

type PortfolioSyncViewState = {
  address: string | null;
  refreshing: boolean;
  error: string | null;
};

const EMPTY_DATA: PortfolioDataState = {
  address: null,
  snapshot: null,
  chains: [],
  protocols: [],
};

const IDLE_SYNC: PortfolioSyncViewState = {
  address: null,
  refreshing: false,
  error: null,
};

const IDLE_PROGRESS: PortfolioSyncProgress = {
  address: null,
  completedChains: 0,
  totalChains: 0,
  stage: 'idle',
};

function sameSyncView(
  left: PortfolioSyncViewState,
  right: PortfolioSyncViewState,
): boolean {
  return (
    left.address === right.address &&
    left.refreshing === right.refreshing &&
    left.error === right.error
  );
}

function sameSyncProgress(
  left: PortfolioSyncProgress,
  right: PortfolioSyncProgress,
): boolean {
  return (
    left.address === right.address &&
    left.completedChains === right.completedChains &&
    left.totalChains === right.totalChains &&
    left.stage === right.stage
  );
}

export function usePortfolio(
  address?: string,
  publishUpdates: boolean = true,
): PortfolioState {
  const engine = useDataEngine();
  const [data, setData] = React.useState<PortfolioDataState>(EMPTY_DATA);
  const [sync, setSync] = React.useState<PortfolioSyncViewState>(IDLE_SYNC);
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const forceRefreshRef = React.useRef(false);
  const activeRunIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let active = true;
    activeRunIdRef.current = null;
    if (!publishUpdates) {
      return () => {
        active = false;
      };
    }
    if (!address) {
      setData(EMPTY_DATA);
      setSync(IDLE_SYNC);
      return () => {
        active = false;
      };
    }

    const normalizedAddress = address.toLowerCase();
    const updateSync = (
      update: (current: PortfolioSyncViewState) => PortfolioSyncViewState,
    ) => {
      setSync(current => {
        const next = update(current);
        return sameSyncView(current, next) ? current : next;
      });
    };

    if (!engine.ready) {
      updateSync(() => ({
        ...IDLE_SYNC,
        address: normalizedAddress,
        refreshing: true,
        error: engine.error,
      }));
      return () => {
        active = false;
      };
    }

    const forceRefresh = forceRefreshRef.current;
    forceRefreshRef.current = false;
    let initiatedSync = false;
    let snapshotLoad: Promise<PortfolioSnapshot | null> | null = null;
    updateSync(() => ({
      address: normalizedAddress,
      refreshing: true,
      error: null,
    }));

    const loadSnapshot = (): Promise<PortfolioSnapshot | null> => {
      if (snapshotLoad) return snapshotLoad;
      snapshotLoad = Promise.all([
        repositories.getPortfolioSnapshot(normalizedAddress),
        repositories.listPortfolioChainSnapshots(normalizedAddress),
        repositories.listPortfolioProtocolPositions(normalizedAddress),
        repositories.getPortfolioSyncState(normalizedAddress),
      ])
        .then(([cached, cachedChains, cachedProtocols, cachedSyncState]) => {
          if (!active) return cached;
          setData({
            address: normalizedAddress,
            snapshot: cached,
            chains: cachedChains,
            protocols: cachedProtocols,
          });
          updateSync(current => ({
            ...current,
            address: normalizedAddress,
            refreshing: cachedSyncState
              ? cachedSyncState.state === 'queued' ||
                cachedSyncState.state === 'running'
              : cached
              ? false
              : current.refreshing,
          }));
          return cached;
        })
        .finally(() => {
          snapshotLoad = null;
        });
      return snapshotLoad;
    };

    const subscription = dataEngine.addSyncStateListener(
      (state: PortfolioSyncState) => {
        if (!active || state.address !== normalizedAddress) return;
        if (state.state === 'queued' || state.state === 'running') {
          activeRunIdRef.current = state.runId;
        } else if (
          activeRunIdRef.current &&
          activeRunIdRef.current !== state.runId
        ) {
          return;
        }
        updateSync(current => ({
          address: normalizedAddress,
          refreshing: state.state === 'queued' || state.state === 'running',
          error:
            state.state === 'failed'
              ? state.errorCode || 'Portfolio refresh failed'
              : state.state === 'queued' ||
                state.state === 'running' ||
                state.state === 'succeeded'
              ? null
              : current.error,
        }));
        if (state.state === 'succeeded') {
          loadSnapshot().catch(() => {
            if (active) {
              updateSync(current => ({
                ...current,
                error: 'Portfolio refresh failed',
              }));
            }
          });
          activeRunIdRef.current = null;
        }
        if (state.state === 'cancelled') {
          activeRunIdRef.current = null;
        }
      },
    );

    loadSnapshot()
      .catch(() => null)
      .then(async cached => {
        if (cached && !forceRefresh) return;
        initiatedSync = true;
        await runUiAppIntent({
          action: 'portfolio.sync',
          address: normalizedAddress,
          providerMode: 'current',
        });
        await loadSnapshot();
      })
      .then(
        () => {
          if (active && initiatedSync) {
            updateSync(current => ({ ...current, refreshing: false }));
          }
        },
        failure => {
          if (!active) return;
          updateSync(current => ({
            ...current,
            refreshing: false,
            error:
              failure instanceof Error
                ? failure.message
                : 'Portfolio refresh failed',
          }));
        },
      );

    return () => {
      active = false;
      subscription.remove();
    };
  }, [address, engine.error, engine.ready, publishUpdates, refreshNonce]);

  const normalizedAddress = address?.toLowerCase() || null;
  const hasCurrentData = data.address === normalizedAddress;
  const hasCurrentSync = sync.address === normalizedAddress;
  const refresh = React.useCallback(() => {
    forceRefreshRef.current = true;
    setRefreshNonce(value => value + 1);
  }, []);

  return {
    snapshot: hasCurrentData ? data.snapshot : null,
    chains: hasCurrentData ? data.chains : EMPTY_DATA.chains,
    protocols: hasCurrentData ? data.protocols : EMPTY_DATA.protocols,
    refreshing: hasCurrentSync ? sync.refreshing : false,
    error: hasCurrentSync ? sync.error : null,
    refresh,
  };
}

export function usePortfolioSyncProgress(
  address?: string,
  publishUpdates: boolean = true,
): PortfolioSyncProgress {
  const [progress, setProgress] =
    React.useState<PortfolioSyncProgress>(IDLE_PROGRESS);

  React.useEffect(() => {
    if (!address || !publishUpdates) return;

    let active = true;
    let eventSeen = false;
    let activeRunId: string | null = null;
    const normalizedAddress = address.toLowerCase();
    const publish = (next: PortfolioSyncProgress) => {
      setProgress(current =>
        sameSyncProgress(current, next) ? current : next,
      );
    };

    repositories.getPortfolioSyncState(normalizedAddress).then(state => {
      if (!active || eventSeen || !state) return;
      publish({
        address: normalizedAddress,
        completedChains: state.completedChains,
        totalChains: state.totalChains,
        stage: state.stage,
      });
    });

    const subscription = dataEngine.addSyncStateListener(state => {
      if (!active || state.address !== normalizedAddress) return;
      eventSeen = true;
      if (state.state === 'queued' || state.state === 'running') {
        activeRunId = state.runId;
      } else if (activeRunId && activeRunId !== state.runId) {
        return;
      }
      publish({
        address: normalizedAddress,
        completedChains: state.completedChains,
        totalChains: state.totalChains,
        stage: state.stage,
      });
      if (
        state.state === 'succeeded' ||
        state.state === 'failed' ||
        state.state === 'cancelled'
      ) {
        activeRunId = null;
      }
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [address, publishUpdates]);

  const normalizedAddress = address?.toLowerCase() || null;
  return progress.address === normalizedAddress ? progress : IDLE_PROGRESS;
}
