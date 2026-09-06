import { chainRegistry, getChainRegistryEntry } from '../chainRegistry';

describe('chain registry', () => {
  it('joins every supported RPC chain to bundled metadata and assets', () => {
    expect(
      chainRegistry.map(entry => ({
        chainId: entry.chain.id,
        assetId: entry.assetId,
        name: entry.displayName,
        primaryRpcUrl: entry.primaryRpcUrl,
      })),
    ).toEqual([
      {
        chainId: 1,
        assetId: 'eth',
        name: 'Ethereum',
        primaryRpcUrl: 'https://ethereum-rpc.publicnode.com',
      },
      {
        chainId: 8453,
        assetId: 'base',
        name: 'Base',
        primaryRpcUrl: 'https://mainnet.base.org',
      },
      {
        chainId: 42161,
        assetId: 'arb',
        name: 'Arbitrum',
        primaryRpcUrl: 'https://arb1.arbitrum.io/rpc',
      },
      {
        chainId: 10,
        assetId: 'op',
        name: 'OP',
        primaryRpcUrl: 'https://optimism-rpc.publicnode.com',
      },
      {
        chainId: 137,
        assetId: 'matic',
        name: 'Polygon',
        primaryRpcUrl: 'https://polygon.drpc.org',
      },
    ]);
  });

  it('keeps one primary RPC and at least one fallback per chain', () => {
    for (const entry of chainRegistry) {
      expect(entry.primaryRpcUrl).toBe(entry.chain.rpcUrls[0]);
      expect(entry.fallbackRpcUrls.length).toBeGreaterThan(0);
    }
  });

  it('rejects chains outside the shared registry', () => {
    expect(() => getChainRegistryEntry(56)).toThrow('Unsupported chain 56');
  });
});
