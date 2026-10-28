import { SqliteDatabase } from './sqlite-connection.js';

export const SQLITE_SCHEMA_V1 = `
PRAGMA foreign_keys = ON;

-- 1. Profiles & Preferences
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  default_currency TEXT NOT NULL DEFAULT 'INR',
  preferences_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Family Entities (Legal entities, HUF, Spouse, Children, Self)
CREATE TABLE IF NOT EXISTS family_members (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('self', 'spouse', 'huf', 'child', 'parent', 'other')),
  pan_masked TEXT,
  color_hex TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, id)
);

-- 3. Demat & Folio Accounts
CREATE TABLE IF NOT EXISTS portfolio_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  broker_name TEXT NOT NULL,
  depository TEXT NOT NULL,
  account_number_masked TEXT,
  account_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, id),
  FOREIGN KEY (user_id, member_id) REFERENCES family_members(user_id, id) ON DELETE CASCADE
);

-- 4. Asset Classes (Taxonomy)
CREATE TABLE IF NOT EXISTS asset_classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

-- 5. Assets (Unique per user + id for composite FK enforcement)
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ticker TEXT,
  isin TEXT,
  asset_class_id TEXT NOT NULL REFERENCES asset_classes(id),
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, id)
);

-- 6. Holdings (Quantities and integer paise cost basis)
CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  unit_cost_paise INTEGER NOT NULL DEFAULT 0,
  current_value_paise INTEGER NOT NULL DEFAULT 0,
  member_id TEXT,
  account_id TEXT,
  demat_account_id TEXT,
  folio_number TEXT,
  amc_name TEXT,
  scheme_plan TEXT,
  cost_basis_verified INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, asset_id),
  FOREIGN KEY (user_id, asset_id) REFERENCES assets(user_id, id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, member_id) REFERENCES family_members(user_id, id) ON DELETE SET NULL,
  FOREIGN KEY (user_id, account_id) REFERENCES portfolio_accounts(user_id, id) ON DELETE SET NULL
);

-- 7. Transactions (Cashflow and trade audit log)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'fee')),
  quantity REAL,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  transaction_date TEXT NOT NULL,
  notes TEXT,
  member_id TEXT,
  account_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id, asset_id) REFERENCES assets(user_id, id) ON DELETE SET NULL,
  FOREIGN KEY (user_id, member_id) REFERENCES family_members(user_id, id) ON DELETE SET NULL,
  FOREIGN KEY (user_id, account_id) REFERENCES portfolio_accounts(user_id, id) ON DELETE SET NULL
);

-- 8. Liabilities (Debts and Mortgages)
CREATE TABLE IF NOT EXISTS liabilities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  loan_type TEXT NOT NULL,
  lender TEXT NOT NULL,
  account_number TEXT,
  original_principal_paise INTEGER NOT NULL CHECK (original_principal_paise > 0),
  interest_rate REAL NOT NULL,
  interest_type TEXT NOT NULL DEFAULT 'floating',
  tenure_months INTEGER,
  emi_amount_paise INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  linked_asset_id TEXT,
  member_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, id),
  FOREIGN KEY (user_id, linked_asset_id) REFERENCES assets(user_id, id) ON DELETE SET NULL,
  FOREIGN KEY (user_id, member_id) REFERENCES family_members(user_id, id) ON DELETE SET NULL
);

-- 9. Asset Valuations (Dated historical appraisals)
CREATE TABLE IF NOT EXISTS asset_valuations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  valuation_paise INTEGER NOT NULL CHECK (valuation_paise >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  as_of_date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual_appraisal',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, asset_id, as_of_date),
  FOREIGN KEY (user_id, asset_id) REFERENCES assets(user_id, id) ON DELETE CASCADE
);

-- 10. Liability Balances (Dated outstanding debt snapshots)
CREATE TABLE IF NOT EXISTS liability_balances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  liability_id TEXT NOT NULL,
  balance_paise INTEGER NOT NULL CHECK (balance_paise >= 0),
  as_of_date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(liability_id, as_of_date),
  FOREIGN KEY (user_id, liability_id) REFERENCES liabilities(user_id, id) ON DELETE CASCADE
);

-- 11. Asset Liability Links (Multi-loan collateral mapping)
CREATE TABLE IF NOT EXISTS asset_liability_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  liability_id TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'mortgage',
  ownership_share_percentage REAL NOT NULL DEFAULT 100.00,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(asset_id, liability_id),
  FOREIGN KEY (user_id, asset_id) REFERENCES assets(user_id, id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, liability_id) REFERENCES liabilities(user_id, id) ON DELETE CASCADE
);

-- 12. Financial Goals
CREATE TABLE IF NOT EXISTS financial_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  target_amount_paise INTEGER NOT NULL CHECK (target_amount_paise > 0),
  target_date TEXT NOT NULL,
  initial_saved_paise INTEGER NOT NULL DEFAULT 0,
  monthly_contribution_paise INTEGER NOT NULL DEFAULT 0,
  expected_return_rate REAL NOT NULL DEFAULT 12.0,
  inflation_rate REAL NOT NULL DEFAULT 6.0,
  priority TEXT NOT NULL DEFAULT 'medium',
  currency TEXT NOT NULL DEFAULT 'INR',
  notes TEXT,
  member_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id, member_id) REFERENCES family_members(user_id, id) ON DELETE SET NULL
);

-- 13. Goal Holding Links
CREATE TABLE IF NOT EXISTS goal_holdings (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES financial_goals(id) ON DELETE CASCADE,
  holding_id TEXT NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
  allocation_percentage REAL NOT NULL DEFAULT 100.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(goal_id, holding_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_liabilities_user ON liabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_valuations_user_date ON asset_valuations(user_id, as_of_date);
CREATE INDEX IF NOT EXISTS idx_liability_balances_user_date ON liability_balances(user_id, as_of_date);
CREATE INDEX IF NOT EXISTS idx_financial_goals_user ON financial_goals(user_id);
`;

export const DEFAULT_ASSET_CLASSES = [
  { id: 'equity', name: 'Equity & Stocks', color_hex: '#10B981', display_order: 1 },
  { id: 'mutual_fund', name: 'Mutual Funds', color_hex: '#3B82F6', display_order: 2 },
  { id: 'fixed_income', name: 'Fixed Income & Deposits', color_hex: '#F59E0B', display_order: 3 },
  { id: 'gold_silver', name: 'Gold & Precious Metals', color_hex: '#EAB308', display_order: 4 },
  { id: 'real_estate', name: 'Real Estate', color_hex: '#8B5CF6', display_order: 5 },
  { id: 'cash_bank', name: 'Cash & Liquid', color_hex: '#06B6D4', display_order: 6 },
  { id: 'crypto', name: 'Digital Assets', color_hex: '#EC4899', display_order: 7 },
  { id: 'alternative', name: 'Alternative Assets', color_hex: '#64748B', display_order: 8 },
] as const;

export function initializeSqliteSchema(db: SqliteDatabase): void {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SQLITE_SCHEMA_V1);

  const insertClass = db.prepare(
    `INSERT OR IGNORE INTO asset_classes (id, name, color_hex, display_order) VALUES (?, ?, ?, ?)`
  );

  for (const ac of DEFAULT_ASSET_CLASSES) {
    insertClass.run(ac.id, ac.name, ac.color_hex, ac.display_order);
  }
}
