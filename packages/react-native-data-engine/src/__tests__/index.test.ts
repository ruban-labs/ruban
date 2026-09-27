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
      cancelPortfolioSync: jest.fn().mockResolvedValue({
        providerId: 'debank',
        address: '0x0000000000000000000000000000000000000001',
        cancelled: true,
        runId: 'run',
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('coalesces identical in-flight synchronizations', async () => {
    let resolveSync!: (value: Record<string, unknown>) => void;
    const native = require('react-native').NativeModules.RubanDataEngine;
    native.syncPortfolio.mockReturnValueOnce(
      new Promise(resolve => {
        resolveSync = resolve;
      }),
    );

    const first = dataEngine.syncPortfolio(
      '0x0000000000000000000000000000000000000001',
    );
    const second = dataEngine.syncPortfolio(
      '0x0000000000000000000000000000000000000001',
    );

    expect(second).toBe(first);
    expect(native.syncPortfolio).toHaveBeenCalledTimes(1);
    resolveSync({ runId: 'shared' });
    await expect(first).resolves.toMatchObject({ runId: 'shared' });
  });

  it('cancels an incompatible run before starting its replacement', async () => {
    let resolveFirst!: (value: Record<string, unknown>) => void;
    const native = require('react-native').NativeModules.RubanDataEngine;
    native.syncPortfolio
      .mockReturnValueOnce(
        new Promise(resolve => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce({ runId: 'replacement' });

    const first = dataEngine.syncPortfolio(
      '0x0000000000000000000000000000000000000001',
    );
    const replacement = dataEngine.syncPortfolio(
      '0x0000000000000000000000000000000000000001',
      { mode: 'incremental', chains: [{ id: 1, key: 'eth' }] },
    );
    await expect(replacement).resolves.toMatchObject({ runId: 'replacement' });

    expect(native.cancelPortfolioSync).toHaveBeenCalledWith(
      'debank',
      '0x0000000000000000000000000000000000000001',
    );
    expect(native.syncPortfolio).toHaveBeenCalledTimes(2);
    resolveFirst({ runId: 'original' });
    await first;
  });
});
