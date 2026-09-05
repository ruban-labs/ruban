jest.mock('react-native', () => ({
  NativeModules: {
    RubanDataEngine: {
      initialize: jest.fn().mockResolvedValue(undefined),
      configureMockSource: jest.fn().mockResolvedValue({
        providerId: 'debank',
        mode: 'mock',
        credentialState: 'mock',
        enabled: true,
        updatedAt: 1,
      }),
      configureByokSource: jest.fn().mockResolvedValue({
        providerId: 'debank',
        mode: 'byok',
        credentialState: 'configured',
        enabled: true,
        updatedAt: 1,
      }),
      importDeBankAccessKey: jest.fn().mockResolvedValue({
        providerId: 'debank',
        credentialState: 'configured',
      }),
      clearDeBankAccessKey: jest.fn().mockResolvedValue({
        providerId: 'debank',
        credentialState: 'missing',
      }),
      getDeBankCredentialState: jest.fn().mockResolvedValue({
        providerId: 'debank',
        credentialState: 'missing',
      }),
      syncPortfolio: jest.fn().mockResolvedValue({
        providerId: 'debank',
        address: '0x0000000000000000000000000000000000000001',
        runId: 'run',
        completedChains: 1,
        totalChains: 1,
        observedAt: 1,
        requestCount: 3,
        attemptCount: 3,
      }),
      syncMockPortfolio: jest.fn().mockResolvedValue({
        providerId: 'debank',
        address: '0x0000000000000000000000000000000000000001',
        runId: 'run',
        completedChains: 5,
        totalChains: 5,
        observedAt: 1,
      }),
      addListener: jest.fn(),
      removeListeners: jest.fn(),
    },
  },
  NativeEventEmitter: class {
    addListener(): { remove(): void } {
      return { remove() {} };
    }
  },
}));

import { dataEngine } from '..';

describe('dataEngine', () => {
  it('uses the explicit DeBank mock adapter', async () => {
    await expect(dataEngine.configureMockDeBank()).resolves.toMatchObject({
      providerId: 'debank',
      mode: 'mock',
    });
  });

  it('normalizes a full sync without exposing provider details', async () => {
    await dataEngine.syncPortfolio(
      '0x0000000000000000000000000000000000000001',
    );
    expect(
      require('react-native').NativeModules.RubanDataEngine.syncPortfolio,
    ).toHaveBeenCalledWith(
      'debank',
      '0x0000000000000000000000000000000000000001',
      { mode: 'full', chains: [] },
    );
  });

  it('passes a validated incremental chain selection', async () => {
    await dataEngine.syncPortfolio(
      '0x0000000000000000000000000000000000000001',
      { mode: 'incremental', chains: [{ id: 1, key: 'eth' }] },
    );
    expect(
      require('react-native').NativeModules.RubanDataEngine.syncPortfolio,
    ).toHaveBeenLastCalledWith(
      'debank',
      '0x0000000000000000000000000000000000000001',
      { mode: 'incremental', chains: [{ id: 1, key: 'eth' }] },
    );
  });

  it('rejects duplicate incremental chains before native IO', () => {
    expect(() =>
      dataEngine.syncPortfolio(
        '0x0000000000000000000000000000000000000001',
        {
          mode: 'incremental',
          chains: [
            { id: 1, key: 'eth' },
            { id: 1, key: 'base' },
          ],
        },
      ),
    ).toThrow('invalid_incremental_chains');
  });
});
