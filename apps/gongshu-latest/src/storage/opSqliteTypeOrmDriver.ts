import {
  open,
  type DB,
  type QueryResult,
  type Scalar,
  type Transaction,
} from '@op-engineering/op-sqlite';

type OpenDatabaseOptions = {
  name: string;
  location?: string;
  encryptionKey?: string;
};

type TypeOrmRows = QueryResult['rows'] & {
  item: (index: number) => Record<string, Scalar>;
};

type TypeOrmConnection = {
  getDb: () => DB;
  executeSql: <Result = QueryResult>(
    sql: string,
    params?: Scalar[],
    success?: (result: QueryResult) => void,
    failure?: (error: unknown) => void,
  ) => Promise<Result>;
  transaction: (
    operation: (transaction: Transaction) => Promise<void>,
  ) => Promise<void>;
  close: (success: () => void, failure: (error: unknown) => void) => void;
  attach: (
    databaseName: string,
    alias: string,
    secondaryLocation: string | undefined,
    success: () => void,
  ) => void;
  detach: (alias: string, success: () => void) => void;
};

let activeDatabase: DB | null = null;

export function getOpSqliteDatabasePath(): string {
  if (!activeDatabase) throw new Error('Ruban database is not initialized');
  return activeDatabase.getDbPath();
}

function enhanceQueryResult(result: QueryResult): void {
  const rows = result.rows as TypeOrmRows;
  rows.item = (index: number) => rows[index];
}

function resolveLocation(location?: string): string | undefined {
  return !location || location === 'default' ? undefined : location;
}

function isTransactionControlStatement(sql: string): boolean {
  return /^(?:BEGIN(?:\s+TRANSACTION)?|COMMIT|ROLLBACK(?:\s+TO\s+SAVEPOINT)?|SAVEPOINT|RELEASE\s+SAVEPOINT)\b/i.test(
    sql.trim(),
  );
}

export const opSqliteTypeOrmDriver = {
  openDatabase(
    options: OpenDatabaseOptions,
    success?: (connection: TypeOrmConnection) => void,
    failure?: (error: unknown) => void,
  ): TypeOrmConnection {
    try {
      const location = resolveLocation(options.location);
      const database = open({
        name: options.name,
        ...(location ? { location } : {}),
        ...(options.encryptionKey
          ? { encryptionKey: options.encryptionKey }
          : {}),
      });
      activeDatabase = database;
      let operationQueue: Promise<void> = Promise.resolve();

      function enqueue<Result>(
        operation: () => Result | Promise<Result>,
      ): Promise<Result> {
        const execution = operationQueue.then(operation, operation);
        operationQueue = execution.then(
          () => undefined,
          () => undefined,
        );
        return execution;
      }

      const connection: TypeOrmConnection = {
        getDb: () => database,
        async executeSql<Result = QueryResult>(
          sql: string,
          params?: Scalar[],
          onSuccess?: (result: QueryResult) => void,
          onFailure?: (error: unknown) => void,
        ): Promise<Result> {
          return enqueue(async () => {
            try {
              const result = isTransactionControlStatement(sql)
                ? database.executeSync(sql, params)
                : await database.execute(sql, params);
              enhanceQueryResult(result);
              onSuccess?.(result);
              return result as Result;
            } catch (error) {
              onFailure?.(error);
              throw error;
            }
          });
        },
        transaction: operation => database.transaction(operation),
        close(onSuccess, onFailure) {
          try {
            database.close();
            if (activeDatabase === database) activeDatabase = null;
            onSuccess();
          } catch (error) {
            onFailure(error);
          }
        },
        attach(databaseName, alias, secondaryLocation, onSuccess) {
          database.attach({
            secondaryDbFileName: databaseName,
            alias,
            ...(secondaryLocation ? { location: secondaryLocation } : {}),
          });
          onSuccess();
        },
        detach(alias, onSuccess) {
          database.detach(alias);
          onSuccess();
        },
      };
      success?.(connection);
      return connection;
    } catch (error) {
      failure?.(error);
      throw error;
    }
  },
};
