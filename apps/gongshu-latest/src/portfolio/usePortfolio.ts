import {
  createEvmClient,
  type ChainPortfolio,
  type PortfolioSnapshot,
} from '@ruban-labs/react-native-evm-client';
import * as React from 'react';
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
  const [snapshot, setSnapshot] = React.useState<PortfolioSnapshot | null>(
    null,
  );
  const [refreshing, setRefreshing] = React.useState(false);
  const [completedChains, setCompletedChains] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    if (!address) {
      setSnapshot(null);
      setRefreshing(false);
      return () => {
        active = false;
      };
    }

    const chains = new Map<number, ChainPortfolio>();
    setCompletedChains(0);
    setError(null);
    setRefreshing(true);

    repositories
      .getPortfolioSnapshot(address)
      .then(cached => {
        if (active && cached) setSnapshot(cached);
      })
      .catch(() => {});

    evmClient
      .syncPortfolio(address, {
        onChain: chain => {
          if (!active) return;
          chains.set(chain.chain.id, chain);
          setCompletedChains(chains.size);
        },
      })
      .then(
        result => {
          if (!active) return;
          setSnapshot(result);
          setRefreshing(false);
          repositories.savePortfolioSnapshot(result).catch(() => {});
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
    };
  }, [address, refreshNonce]);

  return {
    snapshot,
    refreshing,
    completedChains,
    error,
    refresh: () => setRefreshNonce(value => value + 1),
  };
}
