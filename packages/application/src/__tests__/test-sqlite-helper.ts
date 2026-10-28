import { SqliteDatabase, SqliteStatement } from '../persistence/sqlite/sqlite-connection.js';
import { initializeSqliteSchema } from '../persistence/sqlite/sqlite-schema.js';

// Dynamically load node:sqlite to prevent TypeScript compile errors when @types/node is not installed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DatabaseSyncClass: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite = (eval('require') as (id: string) => any)('node:sqlite');
  DatabaseSyncClass = sqlite.DatabaseSync;
} catch {
  // node:sqlite unavailable
}

export function createTestSqliteDb(): SqliteDatabase {
  if (!DatabaseSyncClass) {
    throw new Error('node:sqlite DatabaseSync is not available in this runtime.');
  }

  const syncDb = new DatabaseSyncClass(':memory:');
  const db: SqliteDatabase = {
    exec(sql: string) {
      syncDb.exec(sql);
    },
    prepare<T = Record<string, unknown>>(sql: string): SqliteStatement<T> {
      const stmt = syncDb.prepare(sql);
      return {
        run(...params: unknown[]) {
          const res = stmt.run(...params);
          return {
            changes: res.changes,
            lastInsertRowid: res.lastInsertRowid,
          };
        },
        all(...params: unknown[]): T[] {
          return stmt.all(...params) as T[];
        },
        get(...params: unknown[]): T | undefined {
          return stmt.get(...params) as T | undefined;
        },
      };
    },
  };

  initializeSqliteSchema(db);
  return db;
}
