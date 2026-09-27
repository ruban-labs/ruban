import { dataEngine } from '@ruban-labs/react-native-data-engine';
import { addWatchOnly } from '@ruban-labs/react-native-wallet-core';
import { repositories } from '../../storage/repositories';
import { DEMO_ADDRESS, hasSampleData } from '../../portfolio/demoPortfolio';
import { parseDeveloperAppIntent } from '../appIntent';
import { AppIntentDispatcher } from '../appIntentDispatcher';
import { appIntentUseCases } from '../appIntentUseCases';

jest.mock('@ruban-labs/react-native-data-engine', () => ({
  dataEngine: {
    syncMockPortfolio: jest.fn(),
    syncPortfolio: jest.fn(),
    getDeBankCredentialState: jest.fn(),
    configureByokDeBank: jest.fn(),
    importDeBankAccessKey: jest.fn(),
    clearDeBankAccessKey: jest.fn(),
  },
}));
jest.mock('@ruban-labs/react-native-wallet-core', () => ({
  addWatchOnly: jest.fn(),
}));
jest.mock('@ruban-labs/react-native-evm-client', () => ({
  defaultEvmChains: [],
}));
jest.mock('../../buildInfo', () => ({ buildInfo: {} }));
jest.mock('../../dapp/rpcReviewQueue', () => ({ appRpcReviewQueue: {} }));
jest.mock('../../data/DataEngineContext', () => ({
  ensureDataEngine: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../storage/dataSource', () => ({
  prepareDataSourceForNativeWrite: jest.fn(),
}));
jest.mock('../../storage/repositories', () => ({
  repositories: {
    listWalletAccounts: jest.fn(),
    saveWalletAccount: jest.fn(),
    setSelectedAccountId: jest.fn(),
    getPortfolioSnapshot: jest.fn(),
  },
}));

const realAddress = '0x1111111111111111111111111111111111111111';
const account = {
  id: 'demo',
  label: 'Example portfolio',
  address: DEMO_ADDRESS,
  kind: 'watch-only',
  createdAt: 1,
};
const mockEngine = jest.mocked(dataEngine);
const mockRepositories = jest.mocked(repositories);

beforeEach(() => {
  jest.resetAllMocks();
  mockRepositories.listWalletAccounts.mockResolvedValue([]);
  jest
    .mocked(addWatchOnly)
    .mockResolvedValue(account as Awaited<ReturnType<typeof addWatchOnly>>);
  mockEngine.getDeBankCredentialState.mockResolvedValue({
    providerId: 'debank',
    credentialState: 'missing',
  });
  mockEngine.syncMockPortfolio.mockResolvedValue({
    address: DEMO_ADDRESS,
    completedChains: 5,
    requestCount: 0,
  } as Awaited<ReturnType<typeof dataEngine.syncMockPortfolio>>);
  mockRepositories.getPortfolioSnapshot.mockResolvedValue({
    assets: [],
    totalValueUsd: 1400,
  } as unknown as NonNullable<Awaited<ReturnType<typeof repositories.getPortfolioSnapshot>>>);
});

test('example selection persists through the same use case without a key or live calls', async () => {
  const result = await appIntentUseCases.execute({
    action: 'wallet.open-demo',
  });
  expect(result.address).toBe(DEMO_ADDRESS);
  expect(mockEngine.syncMockPortfolio).toHaveBeenCalledWith(DEMO_ADDRESS);
  expect(mockRepositories.saveWalletAccount).toHaveBeenCalledWith(account);
  expect(mockRepositories.setSelectedAccountId).toHaveBeenCalledWith('demo');
  expect(mockEngine.syncPortfolio).not.toHaveBeenCalled();
  expect(mockEngine.importDeBankAccessKey).not.toHaveBeenCalled();
});

test('concurrent example entry creates one account', async () => {
  await Promise.all([
    appIntentUseCases.execute({ action: 'wallet.open-demo' }),
    appIntentUseCases.execute({ action: 'wallet.open-demo' }),
  ]);
  expect(addWatchOnly).toHaveBeenCalledTimes(1);
  expect(mockEngine.syncMockPortfolio).toHaveBeenCalledTimes(1);
});

test('reopening the persisted example reuses its account', async () => {
  mockRepositories.listWalletAccounts.mockResolvedValue([
    account as Awaited<ReturnType<typeof addWatchOnly>>,
  ]);
  await appIntentUseCases.execute({ action: 'wallet.open-demo' });
  expect(addWatchOnly).not.toHaveBeenCalled();
  expect(mockRepositories.setSelectedAccountId).toHaveBeenCalledWith('demo');
});

test('example refresh stays offline even when a paid key exists', async () => {
  mockEngine.getDeBankCredentialState.mockResolvedValue({
    providerId: 'debank',
    credentialState: 'configured',
  });
  await appIntentUseCases.execute({
    action: 'portfolio.sync',
    address: DEMO_ADDRESS,
    providerMode: 'current',
  });
  expect(mockEngine.syncMockPortfolio).toHaveBeenCalledWith(DEMO_ADDRESS);
  expect(mockEngine.syncPortfolio).not.toHaveBeenCalled();
  expect(mockEngine.configureByokDeBank).not.toHaveBeenCalled();
});

test('real addresses never receive mock balances or live calls without a key', async () => {
  await expect(
    appIntentUseCases.execute({
      action: 'portfolio.sync',
      address: realAddress,
      providerMode: 'current',
    }),
  ).rejects.toThrow('credential_missing');
  await expect(
    appIntentUseCases.execute({
      action: 'portfolio.sync',
      address: realAddress,
      providerMode: 'mock',
    }),
  ).rejects.toThrow('sample_requires_demo_address');
  expect(mockEngine.syncMockPortfolio).not.toHaveBeenCalled();
  expect(mockEngine.syncPortfolio).not.toHaveBeenCalled();
});

test('ordinary address import cannot alias the synthetic portfolio', async () => {
  await expect(
    appIntentUseCases.execute({
      action: 'wallet.add-watch-address',
      address: DEMO_ADDRESS,
      label: 'Real',
    }),
  ).rejects.toThrow('reserved_demo_address');
});

test('real sync uses BYOK only', async () => {
  mockEngine.getDeBankCredentialState.mockResolvedValue({
    providerId: 'debank',
    credentialState: 'configured',
  });
  mockEngine.syncPortfolio.mockResolvedValue({
    address: realAddress,
  } as Awaited<ReturnType<typeof dataEngine.syncPortfolio>>);
  await appIntentUseCases.execute({
    action: 'portfolio.sync',
    address: realAddress,
    providerMode: 'current',
  });
  expect(mockEngine.configureByokDeBank).toHaveBeenCalled();
  expect(mockEngine.syncPortfolio).toHaveBeenCalledWith(realAddress);
  expect(mockEngine.syncMockPortfolio).not.toHaveBeenCalled();
});

test.each([false, true])(
  'key import receipts never contain the input or raw errors (failure=%s)',
  async failure => {
    const input = 'synthetic-key-only-for-test';
    if (failure)
      mockEngine.importDeBankAccessKey.mockRejectedValue(new Error(input));
    else
      mockEngine.importDeBankAccessKey.mockResolvedValue({
        providerId: 'debank',
        credentialState: 'configured',
      });
    const save = jest.fn();
    const dispatcher = new AppIntentDispatcher({
      receipts: { get: async () => null, save },
      useCases: appIntentUseCases,
    });
    const receipt = await dispatcher.dispatch({
      runId: 'test-import',
      source: 'ui',
      intent: { action: 'data-source.import-key', accessKey: input },
    });
    expect(receipt.status).toBe(failure ? 'failed' : 'succeeded');
    expect(JSON.stringify(save.mock.calls)).not.toContain(input);
  },
);

test('demo deep link is nonproduction, rejects secrets, and shares the UI intent', () => {
  const url = 'ruban-debug://dev/portfolio/demo?runId=demo-1';
  expect(parseDeveloperAppIntent(url, 'debug')?.intent).toEqual({
    action: 'wallet.open-demo',
  });
  expect(parseDeveloperAppIntent(url, 'production')).toBeNull();
  expect(
    parseDeveloperAppIntent(`${url}&accessKey=secret`, 'debug'),
  ).toBeNull();
  expect(hasSampleData({ chains: [{ source: 'debank:mock' }] })).toBe(true);
  expect(hasSampleData({ chains: [{ source: 'debank:cloud' }] })).toBe(false);
});
