import {
  dataEngine,
  type PortfolioSyncState,
} from '@ruban-labs/react-native-data-engine';
import {
  createEvmClient,
  type PortfolioSnapshot,
} from '@ruban-labs/react-native-evm-client';
import * as React from 'react';
import { useDataEngine } from '../data/DataEngineContext';
import { refreshDataSourceAfterNativeWrite } from '../storage/dataSource';
import { repositories } from '../storage/repositories';

export const evmClient = createEvmClient({ timeoutMs: 7000 });

type PortfolioState = {
  snapshot: PortfolioSnapshot | null;
  refreshing: boolean;
  completedChains: number;
  error: string | null;
  refresh: () => void;
};

export function usePortfolio(address?: string): PortfolioState {
  const engine = useDataEngine();
  const [snapshot, setSnapshot] = React.useState<PortfolioSnapshot | null>(
    null,
  );
  const [refreshing, setRefreshing] = React.useState(false);
  const [completedChains, setCompletedChains] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const forceRefreshRef = React.useRef(false);

  React.useEffect(() => {
    let active = true;
    if (!address) {
      setSnapshot(null);
      setRefreshing(false);
      return () => {
        active = false;
      };
    }

    if (!engine.ready) {
      setRefreshing(true);
      setError(engine.error);
      return () => {
        active = false;
      };
    }

    const normalizedAddress = address.toLowerCase();
    const forceRefresh = forceRefreshRef.current;
    forceRefreshRef.current = false;
    setError(null);
    setRefreshing(true);

    const subscription = dataEngine.addSyncStateListener(
      (state: PortfolioSyncState) => {
        if (!active || state.address !== normalizedAddress) return;
        setCompletedChains(state.completedChains);
        setRefreshing(state.state === 'queued' || state.state === 'running');
        if (state.state === 'failed') {
          setError(state.errorCode || 'Portfolio refresh failed');
        }
      },
    );

    const loadSnapshot = () =>
      repositories.getPortfolioSnapshot(normalizedAddress).then(cached => {
        if (!active || !cached) return cached;
        setSnapshot(cached);
        setCompletedChains(cached.chains.length);
        return cached;
      });

    loadSnapshot()
      .catch(() => null)
      .then(async cached => {
        if (cached && !forceRefresh) return;
        await dataEngine.syncPortfolio(normalizedAddress);
        await refreshDataSourceAfterNativeWrite();
        await loadSnapshot();
      })
      .then(
        () => {
          if (active) setRefreshing(false);
        },
        failure => {
          if (!active) return;
          setError(
            failure instanceof Error
              ? failure.message
              : 'Portfolio refresh failed',
          );
          setRefreshing(false);
        },
      );

    return () => {
      active = false;
      subscription.remove();
    };
  }, [address, engine.error, engine.ready, refreshNonce]);

  return {
    snapshot,
    refreshing,
    completedChains,
    error,
    refresh: () => {
      forceRefreshRef.current = true;
      setRefreshNonce(value => value + 1);
    },
  };
}
