import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { runUiAppIntent } from '../../application/AppIntentRuntime';
import { useDataEngine } from '../../data/DataEngineContext';
import { repositories } from '../../storage/repositories';
import { DEMO_ADDRESS } from '../demoPortfolio';
import { usePortfolio } from '../usePortfolio';

jest.mock('@ruban-labs/react-native-data-engine', () => ({
  dataEngine: { addSyncStateListener: () => ({ remove: jest.fn() }) },
}));
jest.mock('@ruban-labs/react-native-evm-client', () => ({
  createEvmClient: jest.fn(),
}));
jest.mock('../../application/AppIntentRuntime', () => ({
  runUiAppIntent: jest.fn(),
}));
jest.mock('../../data/DataEngineContext', () => ({
  useDataEngine: jest.fn(),
}));
jest.mock('../../storage/repositories', () => ({
  repositories: {
    getPortfolioSnapshot: jest.fn(),
    listPortfolioChainSnapshots: jest.fn(),
    listPortfolioProtocolPositions: jest.fn(),
    getPortfolioSyncState: jest.fn(),
  },
}));

const address = '0x1111111111111111111111111111111111111111';
let renderer: ReactTestRenderer;
let state: ReturnType<typeof usePortfolio>;

function PortfolioProbe({ selected = address }: { selected?: string }) {
  state = usePortfolio(selected);
  return null;
}

function setCredential(configured: boolean) {
  jest.mocked(useDataEngine).mockReturnValue({
    ready: true,
    error: null,
    refreshSource: jest.fn(),
    source: {
      providerId: 'debank',
      mode: 'byok',
      credentialState: configured ? 'configured' : 'missing',
      enabled: configured,
    } as NonNullable<ReturnType<typeof useDataEngine>['source']>,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setCredential(true);
  jest.mocked(repositories.getPortfolioSnapshot).mockResolvedValue(null);
  jest.mocked(repositories.listPortfolioChainSnapshots).mockResolvedValue([]);
  jest
    .mocked(repositories.listPortfolioProtocolPositions)
    .mockResolvedValue([]);
  jest.mocked(repositories.getPortfolioSyncState).mockResolvedValue(null);
});

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});

test('opening an uncached real address does not spend API units', async () => {
  await act(async () => {
    renderer = create(<PortfolioProbe />);
  });
  expect(runUiAppIntent).not.toHaveBeenCalled();
  expect(state.refreshing).toBe(false);
  expect(state.error).toBe('Pull to refresh.');
  await act(async () => state.refresh());
  expect(runUiAppIntent).toHaveBeenCalledWith({
    action: 'portfolio.sync',
    address,
    providerMode: 'current',
  });
});

test('saving a key changes guidance without starting synchronization', async () => {
  setCredential(false);
  await act(async () => {
    renderer = create(<PortfolioProbe />);
  });
  expect(state.error).toContain('Add your DeBank key');
  await act(async () => state.refresh());
  expect(runUiAppIntent).not.toHaveBeenCalled();
  setCredential(true);
  await act(async () => renderer.update(<PortfolioProbe />));
  expect(state.refreshing).toBe(false);
  expect(runUiAppIntent).not.toHaveBeenCalled();
});

test('cached real balances remain available after removing the key', async () => {
  const snapshot = {
    chains: [{ source: 'debank:cloud' }],
    assets: [],
    totalValueUsd: 10,
  };
  jest
    .mocked(repositories.getPortfolioSnapshot)
    .mockResolvedValue(snapshot as never);
  await act(async () => {
    renderer = create(<PortfolioProbe />);
  });
  setCredential(false);
  await act(async () => renderer.update(<PortfolioProbe />));
  expect(state.snapshot).toEqual(snapshot);
  expect(state.error).toBeNull();
  expect(state.refreshing).toBe(false);
  expect(runUiAppIntent).not.toHaveBeenCalled();
});

test('legacy sample balances cannot appear under a real address', async () => {
  jest.mocked(repositories.getPortfolioSnapshot).mockResolvedValue({
    chains: [{ source: 'debank:mock' }],
    assets: [],
    totalValueUsd: 10,
  } as never);
  await act(async () => {
    renderer = create(<PortfolioProbe />);
  });
  expect(state.snapshot).toBeNull();
  expect(state.chains).toEqual([]);
  expect(state.protocols).toEqual([]);
  expect(runUiAppIntent).not.toHaveBeenCalled();
});

test('reopening the offline sample reads SQLite without regenerating data', async () => {
  const snapshot = {
    chains: [{ source: 'debank:mock' }],
    assets: [],
    totalValueUsd: 10,
  };
  jest
    .mocked(repositories.getPortfolioSnapshot)
    .mockResolvedValue(snapshot as never);
  await act(async () => {
    renderer = create(<PortfolioProbe selected={DEMO_ADDRESS} />);
  });
  expect(state.snapshot).toEqual(snapshot);
  expect(runUiAppIntent).not.toHaveBeenCalled();
});

test('a database failure is not treated as permission to fetch paid data', async () => {
  jest
    .mocked(repositories.getPortfolioSnapshot)
    .mockRejectedValueOnce(new Error('Read failed'));
  await act(async () => {
    renderer = create(<PortfolioProbe />);
  });
  expect(state.refreshing).toBe(false);
  expect(state.error).toBe('Read failed');
  expect(runUiAppIntent).not.toHaveBeenCalled();
});
