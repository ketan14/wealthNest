export interface TauriRawDatabaseConnection {
  execute(
    query: string,
    bindValues?: unknown[]
  ): Promise<{ rowsAffected: number; lastInsertId: number }>;
  select<T = unknown>(query: string, bindValues?: unknown[]): Promise<T[]>;
}

export const LOCAL_SQLITE_STORAGE_KEY = 'wealthnest_local_sqlite_v1';
export const DEFAULT_LOCAL_USER_ID = 'usr-local-vault';

export type RowRecord = Record<string, unknown>;

export interface RelationalDatabaseState {
  profiles: RowRecord[];
  family_members: RowRecord[];
  portfolio_accounts: RowRecord[];
  asset_classes: RowRecord[];
  assets: RowRecord[];
  holdings: RowRecord[];
  transactions: RowRecord[];
  liabilities: RowRecord[];
  asset_valuations: RowRecord[];
  liability_balances: RowRecord[];
  asset_liability_links: RowRecord[];
  financial_goals: RowRecord[];
  goal_holdings: RowRecord[];
}

export function createEmptyState(): RelationalDatabaseState {
  return {
    profiles: [],
    family_members: [],
    portfolio_accounts: [],
    asset_classes: [],
    assets: [],
    holdings: [],
    transactions: [],
    liabilities: [],
    asset_valuations: [],
    liability_balances: [],
    asset_liability_links: [],
    financial_goals: [],
    goal_holdings: [],
  };
}

