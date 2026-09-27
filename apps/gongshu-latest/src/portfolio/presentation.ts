import type {
  PortfolioAsset,
  PortfolioSnapshot,
} from '@ruban-labs/react-native-evm-client';
import type {
  PortfolioChainSnapshotRow,
  PortfolioProtocolPositionRow,
} from '../storage/entities';

export type PortfolioChainAllocation = {
  chainId: number;
  valueUsd: number;
  share: number;
};

export type PortfolioChainView = {
  assets: PortfolioAsset[];
  protocols: PortfolioProtocolPositionRow[];
  chainValueUsd: number;
  latencyMs: number;
};

function numericValue(value: number | undefined): number {
  return value == null || !Number.isFinite(value) ? 0 : value;
}

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export function formatUsd(value: number): string {
  return USD_FORMATTER.format(value);
}

export function formatPortfolioAge(
  observedAt: number,
  now: number = Date.now(),
): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - observedAt) / 1000));
  if (elapsedSeconds < 60) return 'NOW';
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}M`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}H`;
  return `${Math.floor(elapsedHours / 24)}D`;
}

export function buildChainAllocations(
  chains: readonly PortfolioChainSnapshotRow[],
  totalValueUsd: number,
): PortfolioChainAllocation[] {
  const denominator = totalValueUsd > 0 ? totalValueUsd : 0;
  return chains
    .map(chain => ({
      chainId: chain.chainId,
      valueUsd: numericValue(chain.valueUsd),
      share: denominator > 0 ? numericValue(chain.valueUsd) / denominator : 0,
    }))
    .sort(
      (left, right) =>
        right.valueUsd - left.valueUsd || left.chainId - right.chainId,
    );
}

export function selectPortfolioChain(
  snapshot: PortfolioSnapshot | null,
  chains: readonly PortfolioChainSnapshotRow[],
  protocols: readonly PortfolioProtocolPositionRow[],
  chainId: number,
): PortfolioChainView {
  const chain = chains.find(candidate => candidate.chainId === chainId);
  const assets = (snapshot?.assets || [])
    .filter(
      asset => asset.chainId === chainId && Number(asset.displayBalance) > 0,
    )
    .slice()
    .sort(
      (left, right) =>
        numericValue(right.valueUsd) - numericValue(left.valueUsd) ||
        left.symbol.localeCompare(right.symbol),
    );
  const selectedProtocols = protocols
    .filter(protocol => protocol.chainId === chainId)
    .slice()
    .sort(
      (left, right) =>
        right.netValueUsd - left.netValueUsd ||
        left.protocolName.localeCompare(right.protocolName),
    );

  return {
    assets,
    protocols: selectedProtocols,
    chainValueUsd: numericValue(chain?.valueUsd),
    latencyMs: chain?.latencyMs || 0,
  };
}
