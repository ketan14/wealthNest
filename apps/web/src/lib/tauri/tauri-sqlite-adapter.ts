import {
  SqliteDatabase,
  SqliteStatement,
  SqliteRunResult,
  initializeSqliteSchema,
} from '@wealthnest/application';
import {
  TauriRawDatabaseConnection,
  LOCAL_SQLITE_STORAGE_KEY,
  DEFAULT_LOCAL_USER_ID,
  RelationalDatabaseState,
  createEmptyState,
} from './tauri-sqlite-types';
import { seedDefaultHouseholdState } from './tauri-sqlite-seed';
import { executePortfolioWrite } from './tauri-sqlite-write-portfolio';
import { executePlanningWrite } from './tauri-sqlite-write-planning';
import { executeRelationalRead } from './tauri-sqlite-read';

export {
  type TauriRawDatabaseConnection,
  LOCAL_SQLITE_STORAGE_KEY,
  DEFAULT_LOCAL_USER_ID,
};

/**
 * Concrete Tauri 2 & Offline Local SQLite Database Adapter.
 * Executes synchronous SQL queries across all 13 relational tables, persists
 * snapshots to localStorage across restarts, and mirrors commands to Tauri's
 * native SQLite plugin IPC when available.
 */
export class TauriSqliteAdapter implements SqliteDatabase {
  private readonly rawConnection?: TauriRawDatabaseConnection;
  private state: RelationalDatabaseState;
  private transactionBackup: string | null = null;
  private readonly persistToStorage: boolean;

  constructor(
    rawConnection?: TauriRawDatabaseConnection,
    options?: { persistToStorage?: boolean }
  ) {
    this.rawConnection = rawConnection;
    this.persistToStorage = options?.persistToStorage ?? true;
    this.state = this.loadStateFromStorage();
  }

  private loadStateFromStorage(): RelationalDatabaseState {
    if (!this.persistToStorage || typeof window === 'undefined') {
      return createEmptyState();
    }
    try {
      const raw = window.localStorage.getItem(LOCAL_SQLITE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<RelationalDatabaseState>;
        return {
          ...createEmptyState(),
          ...parsed,
        };
      }
    } catch {
      // ignore corrupted storage
    }
    return createEmptyState();
  }

  private saveStateToStorage(): void {
    if (!this.persistToStorage || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(LOCAL_SQLITE_STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // ignore quota errors
    }
  }

  /**
   * Initializes the relational schema, default asset classes, and default
   * Vaghela Household offline data on first launch.
   */
  public initialize(): void {
    initializeSqliteSchema(this);
    this.seedDefaultHouseholdIfNeeded(DEFAULT_LOCAL_USER_ID);
    this.saveStateToStorage();
  }

  /**
   * Seeds the Vaghela Household profile, family members, Demat/Folio accounts,
   * holdings, transactions, liabilities, and financial goals for offline usage
   * when no profile exists yet for the default local user.
   */
  public seedDefaultHouseholdIfNeeded(userId: string = DEFAULT_LOCAL_USER_ID): void {
    seedDefaultHouseholdState(this.state, userId);
  }

  public exec(sql: string): void {
    const normalized = sql.trim().toUpperCase();
    if (normalized.startsWith('BEGIN')) {
      this.transactionBackup = JSON.stringify(this.state);
    } else if (normalized.startsWith('COMMIT')) {
      this.transactionBackup = null;
      this.saveStateToStorage();
    } else if (normalized.startsWith('ROLLBACK')) {
      if (this.transactionBackup) {
        this.state = JSON.parse(this.transactionBackup) as RelationalDatabaseState;
        this.transactionBackup = null;
        this.saveStateToStorage();
      }
    }

    if (this.rawConnection) {
      this.rawConnection.execute(sql).catch((err) => {
        console.error('Tauri SQLite exec error:', err);
      });
    }
  }

  public prepare<T = Record<string, unknown>>(sql: string): SqliteStatement<T> {
    const raw = this.rawConnection;
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    return {
      run: (...params: unknown[]): SqliteRunResult => {
        if (raw) {
          raw.execute(sql, params).catch((err) => {
            console.error('Tauri SQLite run error:', err);
          });
        }
        const changes = this.executeWrite(normalizedSql, params);
        if (!this.transactionBackup) {
          this.saveStateToStorage();
        }
        return {
          changes,
          lastInsertRowid: Date.now(),
        };
      },

      all: (...params: unknown[]): T[] => {
        return executeRelationalRead<T>(this.state, normalizedSql, params);
      },

      get: (...params: unknown[]): T | undefined => {
        const rows = executeRelationalRead<T>(this.state, normalizedSql, params);
        return rows[0];
      },
    };
  }

  private executeWrite(sql: string, params: unknown[]): number {
    const now = new Date().toISOString();
    const portfolioResult = executePortfolioWrite(this.state, sql, params, now);
    if (portfolioResult !== null) return portfolioResult;

    const planningResult = executePlanningWrite(this.state, sql, params, now);
    if (planningResult !== null) return planningResult;

    return 1;
  }

  /**
   * Direct asynchronous query interface for Tauri native IPC.
   */
  public async executeAsync(sql: string, params: unknown[] = []): Promise<SqliteRunResult> {
    if (!this.rawConnection) {
      return { changes: 0, lastInsertRowid: 0 };
    }
    const res = await this.rawConnection.execute(sql, params);
    return {
      changes: res.rowsAffected,
      lastInsertRowid: res.lastInsertId,
    };
  }

  /**
   * Direct asynchronous select interface for Tauri native IPC.
   */
  public async selectAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.rawConnection) return [];
    return this.rawConnection.select<T>(sql, params);
  }
}
