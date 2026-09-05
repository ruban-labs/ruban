import {
  AppIntentFailure,
  parseDeveloperAppIntent,
  type AppIntentEnvelope,
  type AppIntentReceipt,
} from '../appIntent';
import { AppIntentDispatcher } from '../appIntentDispatcher';

const address = '0x1111111111111111111111111111111111111111';

test('parses the bounded developer intent namespace', () => {
  expect(
    parseDeveloperAppIntent(
      `ruban-debug://dev/address/add?runId=add-1&address=${address}&label=Primary`,
      'debug',
    ),
  ).toEqual({
    runId: 'add-1',
    source: 'deep-link',
    intent: {
      action: 'wallet.add-watch-address',
      address,
      label: 'Primary',
    },
  });
  expect(
    parseDeveloperAppIntent(
      `ruban-regression://dev/portfolio/sync?runId=sync-1&address=${address}&provider=mock`,
      'regression',
    )?.intent,
  ).toEqual({ action: 'portfolio.sync', address, providerMode: 'mock' });
  expect(
    parseDeveloperAppIntent(
      'ruban-debug://dev/dapp/review?runId=review-1&decision=approve&method=eth_requestAccounts',
      'debug',
    )?.intent,
  ).toEqual({
    action: 'dapp.resolve-review',
    decision: 'approve',
    expectedMethod: 'eth_requestAccounts',
    timeoutMs: 30_000,
  });
});

test('rejects production, wrong schemes, duplicates, and malformed values', () => {
  expect(
    parseDeveloperAppIntent(
      'ruban://dev/runtime-ready?runId=ready-1',
      'production',
    ),
  ).toBeNull();
  expect(
    parseDeveloperAppIntent(
      'ruban-regression://dev/runtime-ready?runId=ready-1',
      'debug',
    ),
  ).toBeNull();
  expect(
    parseDeveloperAppIntent(
      'ruban-debug://dev/runtime-ready?runId=ready-1&runId=ready-2',
      'debug',
    ),
  ).toBeNull();
  expect(
    parseDeveloperAppIntent(
      'ruban-debug://dev/chain/select?runId=chain-1&chainId=08453',
      'debug',
    ),
  ).toBeNull();
  expect(
    parseDeveloperAppIntent(
      `ruban-debug://dev/address/add?runId=add-1&address=${address}&label=${encodeURIComponent(
        'bad\nlabel',
      )}`,
      'debug',
    ),
  ).toBeNull();
});

function envelope(runId: string, action = 'runtime.ready'): AppIntentEnvelope {
  if (action !== 'runtime.ready') throw new Error('unsupported test action');
  return { runId, source: 'deep-link', intent: { action } };
}

test('coalesces active runs and replays durable receipts', async () => {
  const stored = new Map<string, AppIntentReceipt>();
  const published: AppIntentReceipt[] = [];
  let executions = 0;
  const dispatcher = new AppIntentDispatcher({
    receipts: {
      get: async runId => stored.get(runId) || null,
      save: async receipt => {
        stored.set(receipt.runId, receipt);
      },
    },
    useCases: {
      execute: async () => {
        executions += 1;
        await Promise.resolve();
        return { ready: true };
      },
    },
    onReceipt: receipt => published.push(receipt),
    now: () => 123,
  });

  const first = dispatcher.dispatch(envelope('ready-1'));
  const second = dispatcher.dispatch(envelope('ready-1'));
  expect(first).toBe(second);
  await expect(first).resolves.toMatchObject({
    runId: 'ready-1',
    status: 'succeeded',
    result: { ready: true },
    completedAt: 123,
  });
  await dispatcher.dispatch(envelope('ready-1'));
  expect(executions).toBe(1);
  expect(published).toHaveLength(2);
});

test('persists bounded failures and rejects run id conflicts', async () => {
  const stored = new Map<string, AppIntentReceipt>();
  const dispatcher = new AppIntentDispatcher({
    receipts: {
      get: async runId => stored.get(runId) || null,
      save: async receipt => {
        stored.set(receipt.runId, receipt);
      },
    },
    useCases: {
      execute: async () => {
        throw new AppIntentFailure('runtime_unavailable');
      },
    },
  });

  await expect(dispatcher.dispatch(envelope('failed-1'))).resolves.toMatchObject(
    {
      status: 'failed',
      errorCode: 'runtime_unavailable',
    },
  );
  stored.set('conflict-1', {
    runId: 'conflict-1',
    action: 'wallet.select-chain',
    source: 'deep-link',
    status: 'succeeded',
    completedAt: 1,
  });
  await expect(dispatcher.dispatch(envelope('conflict-1'))).rejects.toEqual(
    new AppIntentFailure('run_id_conflict'),
  );
});
