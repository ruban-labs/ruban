import supportedChains from '@ruban-labs/web-assets/supported-chains.json';
import {
  defaultEvmChains,
  type EvmChain,
} from '@ruban-labs/react-native-evm-client';
import type { ImageSourcePropType } from 'react-native';

type BundledChainMetadata = {
  id: string;
  community_id: number;
  name: string;
  native_token: {
    symbol: string;
    decimals: number;
  };
  is_disabled: boolean;
};

export type PortfolioChainCatalogEntry = {
  chain: EvmChain;
  assetId: string;
  displayName: string;
  nativeSymbol: string;
  logo: ImageSourcePropType;
  whiteLogo: ImageSourcePropType;
};

const logoSources: Record<
  number,
  { logo: ImageSourcePropType; whiteLogo: ImageSourcePropType }
> = {
  1: {
    logo: require('@ruban-labs/web-assets/assets/chains/ethereum.png'),
    whiteLogo: require('@ruban-labs/web-assets/assets/chains/ethereum-white.png'),
  },
  10: {
    logo: require('@ruban-labs/web-assets/assets/chains/op.png'),
    whiteLogo: require('@ruban-labs/web-assets/assets/chains/op-white.png'),
  },
  137: {
    logo: require('@ruban-labs/web-assets/assets/chains/polygon.png'),
    whiteLogo: require('@ruban-labs/web-assets/assets/chains/polygon-white.png'),
  },
  8453: {
    logo: require('@ruban-labs/web-assets/assets/chains/base.png'),
    whiteLogo: require('@ruban-labs/web-assets/assets/chains/base-white.png'),
  },
  42161: {
    logo: require('@ruban-labs/web-assets/assets/chains/arbitrum.png'),
    whiteLogo: require('@ruban-labs/web-assets/assets/chains/arbitrum-white.png'),
  },
};

const metadataByCommunityId = new Map(
  (supportedChains as readonly BundledChainMetadata[]).map(metadata => [
    metadata.community_id,
    metadata,
  ]),
);

export const portfolioChainCatalog: readonly PortfolioChainCatalogEntry[] =
  defaultEvmChains.map(chain => {
    const metadata = metadataByCommunityId.get(chain.id);
    const sources = logoSources[chain.id];
    if (!metadata || !sources || metadata.is_disabled) {
      throw new Error(`Missing bundled assets for supported chain ${chain.id}`);
    }

    return {
      chain,
      assetId: metadata.id,
      displayName: metadata.name,
      nativeSymbol: metadata.native_token.symbol,
      ...sources,
    };
  });

export function getPortfolioChain(chainId: number): PortfolioChainCatalogEntry {
  const entry = portfolioChainCatalog.find(
    candidate => candidate.chain.id === chainId,
  );
  if (!entry) throw new Error(`Unsupported portfolio chain ${chainId}`);
  return entry;
}
