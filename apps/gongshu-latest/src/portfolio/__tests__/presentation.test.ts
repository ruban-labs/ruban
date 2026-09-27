import {
  buildChainAllocations,
  formatPortfolioAge,
  selectPortfolioChain,
} from '../presentation';

describe('portfolio presentation', () => {
  test('orders chain allocation by value and calculates shares', () => {
    const allocations = buildChainAllocations(
      [
        {
          providerId: 'debank',
          address: '0x1',
          chainId: 8453,
          chainKey: 'base',
          chainName: 'Base',
          valueUsd: 25,
          latencyMs: 12,
          source: 'mock',
          observedAt: 1,
        },
        {
          providerId: 'debank',
          address: '0x1',
          chainId: 1,
          chainKey: 'eth',
          chainName: 'Ethereum',
          valueUsd: 75,
          latencyMs: 20,
          source: 'mock',
          observedAt: 1,
        },
      ],
      100,
    );

    expect(allocations.map(item => item.chainId)).toEqual([1, 8453]);
    expect(allocations.map(item => item.share)).toEqual([0.75, 0.25]);
  });

  test('filters and sorts the selected chain data', () => {
    const selected = selectPortfolioChain(
      {
        address: '0x1',
        totalValueUsd: 18,
        updatedAt: 1,
        chains: [],
        assets: [
          {
            chainId: 1,
            chainName: 'Ethereum',
            symbol: 'USDC',
            name: 'USD Coin',
            balance: '10',
            displayBalance: '10',
            valueUsd: 10,
          },
          {
            chainId: 1,
            chainName: 'Ethereum',
            symbol: 'ETH',
            name: 'Ether',
            balance: '1',
            displayBalance: '1',
            valueUsd: 8,
          },
          {
            chainId: 8453,
            chainName: 'Base',
            symbol: 'ETH',
            name: 'Ether',
            balance: '0',
            displayBalance: '0',
            valueUsd: 0,
          },
        ],
      },
      [
        {
          providerId: 'debank',
          address: '0x1',
          chainId: 1,
          chainKey: 'eth',
          chainName: 'Ethereum',
          valueUsd: 18,
          latencyMs: 14,
          source: 'mock',
          observedAt: 1,
        },
      ],
      [
        {
          providerId: 'debank',
          address: '0x1',
          chainId: 1,
          protocolId: 'aave3',
          positionId: 'aggregate',
          protocolName: 'Aave V3',
          logoUrl: null,
          category: 'protocol',
          assetValueUsd: 12,
          debtValueUsd: 2,
          netValueUsd: 10,
          observedAt: 1,
        },
      ],
      1,
    );

    expect(selected.assets.map(asset => asset.symbol)).toEqual(['USDC', 'ETH']);
    expect(selected.protocols.map(protocol => protocol.protocolName)).toEqual([
      'Aave V3',
    ]);
    expect(selected.chainValueUsd).toBe(18);
    expect(selected.latencyMs).toBe(14);
  });

  test('formats compact snapshot ages', () => {
    const now = 1_000_000;
    expect(formatPortfolioAge(now - 20_000, now)).toBe('NOW');
    expect(formatPortfolioAge(now - 120_000, now)).toBe('2M');
    expect(formatPortfolioAge(now - 7_200_000, now)).toBe('2H');
    expect(formatPortfolioAge(now - 172_800_000, now)).toBe('2D');
  });
});
