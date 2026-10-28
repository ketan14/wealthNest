export interface SqliteRunResult {
  readonly changes: number | bigint;
  readonly lastInsertRowid: number | bigint;
}

export interface SqliteStatement<T = Record<string, unknown>> {
  run(...params: unknown[]): SqliteRunResult;
  all(...params: unknown[]): T[];
  get(...params: unknown[]): T | undefined;
}

export interface SqliteDatabase {
  exec(sql: string): void;
  prepare<T = Record<string, unknown>>(sql: string): SqliteStatement<T>;
}
