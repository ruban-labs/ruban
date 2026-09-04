import {
  createDefaultParser,
  type ParseResult,
  type TransactionInput,
} from '@ruban-labs/web3-tx-parser';
import type {EvmChain} from '@ruban-labs/react-native-evm-client';
import type {RpcReviewRow} from './rpcReviewQueue';

type TransactionLike = Record<string, string | undefined>;

export type TransactionReview = {
  badge: string;
  rows: readonly RpcReviewRow[];
  payload?: string;
  parsed: ParseResult;
};

const parser = createDefaultParser();

const actionLabels: Record<ParseResult['action']['type'], string> = {
  native_transfer: 'Native transfer',
  deploy_contract: 'Deploy contract',
  cancel_transaction: 'Cancel transaction',
  token_transfer: 'Token transfer',
  token_approval: 'Token approval',
  token_revoke: 'Token revoke',
  nft_transfer: 'NFT transfer',
  nft_approval: 'NFT approval',
  nft_revoke: 'NFT revoke',
  collection_approval: 'Collection approval',
  collection_revoke: 'Collection revoke',
  swap: 'Swap',
  contract_call: 'Contract call',
  unknown: 'Unknown call',
};

export function createTransactionReview(
  transaction: TransactionLike,
  chain: EvmChain,
  from: string,
): TransactionReview {
  const knownToken = chain.tokens.find(
    token => token.address.toLowerCase() === transaction.to?.toLowerCase(),
  );
  const input: TransactionInput = {
    chainId: chain.id,
    from,
    to: transaction.to || null,
    data: transaction.data || '0x',
    value: transaction.value || '0x0',
    contract: knownToken ? {tokenStandard: 'erc20'} : undefined,
  };
  const parsed = parser.parse(input);
  const signatureOnlyApproval =
    !knownToken &&
    (parsed.action.type === 'token_approval' ||
      parsed.action.type === 'token_revoke') &&
    parsed.decoded?.signature === 'approve(address,uint256)';
  const badge = signatureOnlyApproval
    ? 'ASSET ACCESS'
    : actionLabels[parsed.action.type].toUpperCase();
  const rows: RpcReviewRow[] = [
    {label: 'NETWORK', value: chain.name},
    {label: 'FROM', value: from},
  ];

  if (transaction.to) rows.push({label: 'TO', value: transaction.to});
  if (!transaction.to) {
    rows.push({
      label: 'RECIPIENT',
      value: 'New contract',
      emphasis: 'warning',
    });
  }

  const nativeValue = formatUnits(transaction.value || '0x0', chain.nativeDecimals);
  rows.push({label: 'VALUE', value: `${nativeValue} ${chain.nativeSymbol}`});

  appendActionRows(rows, parsed, knownToken?.symbol, signatureOnlyApproval);
  if (transaction.gas) rows.push({label: 'GAS LIMIT', value: toDecimal(transaction.gas)});
  if (transaction.maxFeePerGas) {
    rows.push({label: 'MAX FEE / GAS', value: `${toDecimal(transaction.maxFeePerGas)} wei`});
  }

  const data = transaction.data || '0x';
  const payload = data === '0x' ? undefined : truncate(data, 1600);
  return {badge, rows, payload, parsed};
}

function appendActionRows(
  rows: RpcReviewRow[],
  parsed: ParseResult,
  tokenSymbol: string | undefined,
  signatureOnlyApproval: boolean,
): void {
  const data = parsed.action.data;
  if (!data) return;

  if (typeof data.to === 'string') {
    rows.push({label: 'RECIPIENT', value: data.to});
  }
  if (typeof data.spender === 'string') {
    rows.push({
      label: signatureOnlyApproval ? 'OPERATOR / SPENDER' : 'SPENDER',
      value: data.spender,
      emphasis: 'warning',
    });
  }
  if (typeof data.operator === 'string') {
    rows.push({label: 'OPERATOR', value: data.operator, emphasis: 'warning'});
  }
  if (typeof data.amount === 'string') {
    rows.push({
      label: tokenSymbol ? 'RAW TOKEN AMOUNT' : 'RAW AMOUNT',
      value: tokenSymbol ? `${data.amount} ${tokenSymbol} base units` : data.amount,
    });
  }
  if (typeof data.tokenId === 'string') {
    rows.push({label: 'TOKEN ID', value: data.tokenId});
  }
  if (typeof data.function === 'string') {
    rows.push({label: 'FUNCTION', value: data.function});
  }
}

function formatUnits(value: string, decimals: number): string {
  const amount = toBigInt(value);
  if (amount === 0n) return '0';
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = (amount % base)
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '')
    .slice(0, 8);
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function toDecimal(value: string): string {
  return toBigInt(value).toString();
}

function toBigInt(value: string): bigint {
  if (/^0x[0-9a-f]+$/i.test(value) || /^\d+$/.test(value)) return BigInt(value);
  return 0n;
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}
