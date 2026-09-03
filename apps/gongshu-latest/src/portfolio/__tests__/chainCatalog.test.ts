import { getPortfolioChain, portfolioChainCatalog } from '../chainCatalog';

describe('portfolio chain catalog', () => {
  it('joins every supported RPC chain to bundled metadata and assets', () => {
    expect(
      portfolioChainCatalog.map(entry => ({
        chainId: entry.chain.id,
        assetId: entry.assetId,
        name: entry.displayName,
      })),
    ).toEqual([
      { chainId: 1, assetId: 'eth', name: 'Ethereum' },
      { chainId: 8453, assetId: 'base', name: 'Base' },
      { chainId: 42161, assetId: 'arb', name: 'Arbitrum' },
      { chainId: 10, assetId: 'op', name: 'OP' },
      { chainId: 137, assetId: 'matic', name: 'Polygon' },
    ]);
  });

  it('rejects chains that are not backed by the wallet RPC catalog', () => {
    expect(() => getPortfolioChain(56)).toThrow(
      'Unsupported portfolio chain 56',
    );
  });
});
