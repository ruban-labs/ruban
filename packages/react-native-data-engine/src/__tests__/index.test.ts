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
});
