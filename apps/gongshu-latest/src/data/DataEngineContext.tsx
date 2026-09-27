import {
  dataEngine,
  type PortfolioDataSource,
} from '@ruban-labs/react-native-data-engine';
import * as React from 'react';
import { getDatabasePath } from '../storage/dataSource';

type DataEngineContextValue = {
  ready: boolean;
  source: PortfolioDataSource | null;
  error: string | null;
  refreshSource: () => Promise<PortfolioDataSource>;
};

type RuntimeState = {
  initialization: Promise<PortfolioDataSource> | null;
};

type RubanGlobal = typeof globalThis & {
  __rubanDataEngineRuntime?: RuntimeState;
};

const globalState = globalThis as RubanGlobal;
const runtime = (globalState.__rubanDataEngineRuntime ||= {
  initialization: null,
});

const DataEngineContext = React.createContext<DataEngineContextValue | null>(
  null,
);

export function ensureDataEngine(): Promise<PortfolioDataSource> {
  if (!runtime.initialization) {
    runtime.initialization = getDatabasePath()
      .then(databasePath => dataEngine.initialize(databasePath))
      .then(() => dataEngine.configureByokDeBank())
      .catch(error => {
        runtime.initialization = null;
        throw error;
      });
  }
  return runtime.initialization;
}

export function DataEngineProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [source, setSource] = React.useState<PortfolioDataSource | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const refreshSource = React.useCallback(async () => {
    await ensureDataEngine();
    const value = await dataEngine.configureByokDeBank();
    runtime.initialization = Promise.resolve(value);
    setSource(value);
    return value;
  }, []);

  React.useEffect(() => {
    let active = true;
    ensureDataEngine().then(
      value => {
        if (active) setSource(value);
      },
      failure => {
        if (!active) return;
        setError(
          failure instanceof Error
            ? failure.message
            : 'Portfolio data engine failed',
        );
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <DataEngineContext.Provider
      value={{ ready: source !== null, source, error, refreshSource }}
    >
      {children}
    </DataEngineContext.Provider>
  );
}

export function useDataEngine(): DataEngineContextValue {
  const value = React.useContext(DataEngineContext);
  if (!value) throw new Error('DataEngineProvider is missing');
  return value;
}
