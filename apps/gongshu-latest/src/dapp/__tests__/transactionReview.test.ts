import type {EvmChain} from '@ruban-labs/react-native-evm-client';
import {createTransactionReview} from '../transactionReview';

const chain: EvmChain = {
  id: 1,
  key: 'ethereum',
  name: 'Ethereum',
  nativeSymbol: 'ETH',
  nativeName: 'Ether',
  nativeDecimals: 18,
  nativePriceId: 'ethereum',
  rpcUrls: ['https://example.com'],
  tokens: [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
      priceId: 'usd-coin',
    },
  ],
};
const from = '0x1111111111111111111111111111111111111111';

test('formats a native transfer for review', () => {
  const review = createTransactionReview(
    {
      from,
      to: '0x2222222222222222222222222222222222222222',
      value: '0xde0b6b3a7640000',
    },
    chain,
    from,
  );

  expect(review.badge).toBe('NATIVE TRANSFER');
  expect(review.rows).toContainEqual({label: 'VALUE', value: '1 ETH'});
  expect(review.payload).toBeUndefined();
});

test('uses known token metadata for ERC20 approval facts', () => {
  const spender = '3333333333333333333333333333333333333333';
  const amount = '00000000000000000000000000000000000000000000000000000000000f4240';
  const review = createTransactionReview(
    {
      from,
      to: chain.tokens[0]?.address,
      data: `0x095ea7b3${'0'.repeat(24)}${spender}${amount}`,
      value: '0x0',
    },
    chain,
    from,
  );

  expect(review.badge).toBe('TOKEN APPROVAL');
  expect(review.rows).toContainEqual({
    label: 'RAW TOKEN AMOUNT',
    value: '1000000 USDC base units',
  });
});
