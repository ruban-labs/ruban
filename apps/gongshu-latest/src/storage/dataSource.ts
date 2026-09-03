import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm/browser';
import { ensureUnreleasedBaselineSchema } from './baselineSchema';
import { entities } from './entities';
import { opSqliteTypeOrmDriver } from './opSqliteTypeOrmDriver';

type DataSourceState = {
  dataSource: DataSource | null;
  initialization: Promise<DataSource> | null;
};

type RubanGlobal = typeof globalThis & {
  __rubanDataSourceState?: DataSourceState;
};

const globalState = globalThis as RubanGlobal;
const state = (globalState.__rubanDataSourceState ||= {
  dataSource: null,
  initialization: null,
});

const options: DataSourceOptions = {
  type: 'react-native',
  database: 'ruban.sqlite',
  location: 'default',
  driver: opSqliteTypeOrmDriver,
  entities,
  synchronize: false,
  logging: ['error'],
};

async function initializeDataSource(): Promise<DataSource> {
  const dataSource = new DataSource(options);
  try {
    await dataSource.initialize();
    await dataSource.query('PRAGMA journal_mode = WAL');
    await dataSource.query('PRAGMA synchronous = NORMAL');
    await dataSource.query('PRAGMA busy_timeout = 5000');
    await ensureUnreleasedBaselineSchema(dataSource);
    state.dataSource = dataSource;
    return dataSource;
  } catch (error) {
    if (dataSource.isInitialized) await dataSource.destroy();
    throw error;
  }
}

export function getDataSource(): Promise<DataSource> {
  if (state.dataSource?.isInitialized) {
    return Promise.resolve(state.dataSource);
  }
  if (!state.initialization) {
    state.initialization = initializeDataSource().catch(error => {
      state.initialization = null;
      throw error;
    });
  }
  return state.initialization;
}
