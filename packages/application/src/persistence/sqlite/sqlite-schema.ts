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

-- 1b. Households (Collaborative Family Workspaces)
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  plan_tier TEXT NOT NULL DEFAULT 'family' CHECK (plan_tier IN ('free', 'pro', 'family')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 1c. Household Access Members (Authenticated Accounts & RBAC Roles)
CREATE TABLE IF NOT EXISTS household_members (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_role TEXT NOT NULL CHECK (household_role IN ('primary_owner', 'admin', 'member', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(household_id, user_id)
);

-- 1d. Household Invitations
CREATE TABLE IF NOT EXISTS household_invitations (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  family_member_id TEXT REFERENCES family_members(id) ON DELETE SET NULL,
  invited_email TEXT NOT NULL,
  household_role TEXT NOT NULL CHECK (household_role IN ('admin', 'member', 'viewer')),
  token_hash TEXT NOT NULL,
  invited_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  accepted_by_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 1e. Family Member Access Grants
CREATE TABLE IF NOT EXISTS family_member_access (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  family_member_id TEXT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  can_view INTEGER NOT NULL DEFAULT 1,
  can_manage INTEGER NOT NULL DEFAULT 0,
  granted_by_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(household_id, family_member_id, user_id)
);

-- 1f. Restricted Record Grants
CREATE TABLE IF NOT EXISTS restricted_record_grants (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  grantee_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  can_edit INTEGER NOT NULL DEFAULT 0,
  granted_by_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(household_id, record_type, record_id, grantee_user_id)
);

-- 1g. Household Audit Logs
CREATE TABLE IF NOT EXISTS household_audit_logs (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  actor_user_id TEXT,
  target_user_id TEXT,
  target_family_member_id TEXT,
  action TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Family Entities (Legal entities, HUF, Spouse, Children, Self)
CREATE TABLE IF NOT EXISTS family_members (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  linked_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT,
  entity_type TEXT NOT NULL DEFAULT 'individual' CHECK (entity_type IN ('individual', 'huf', 'minor', 'joint_pool')),
  name TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('self', 'spouse', 'huf', 'child', 'parent', 'other')),
  pan_masked TEXT,
  color_hex TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, id)
);

-- 3. Demat & Folio Accounts
CREATE TABLE IF NOT EXISTS portfolio_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  broker_name TEXT NOT NULL,
  depository TEXT NOT NULL,
  account_number_masked TEXT,
  account_type TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'household_shared' CHECK (visibility IN ('household_shared', 'owner_only', 'restricted')),
  created_by TEXT,
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
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ticker TEXT,
  isin TEXT,
  asset_class_id TEXT NOT NULL REFERENCES asset_classes(id),
  currency TEXT NOT NULL DEFAULT 'INR',
  visibility TEXT NOT NULL DEFAULT 'household_shared' CHECK (visibility IN ('household_shared', 'owner_only', 'restricted')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, id)
);

-- 6. Holdings (Quantities and integer paise cost basis)
CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
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
  visibility TEXT NOT NULL DEFAULT 'household_shared' CHECK (visibility IN ('household_shared', 'owner_only', 'restricted')),
  created_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, asset_id),
  FOREIGN KEY (user_id, asset_id) REFERENCES assets(user_id, id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, member_id) REFERENCES family_members(user_id, id) ON DELETE SET NULL,
  FOREIGN KEY (user_id, account_id) REFERENCES portfolio_accounts(user_id, id) ON DELETE SET NULL
);

-- 6b. Joint Holding Ownership Allocations
CREATE TABLE IF NOT EXISTS holding_owners (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  holding_id TEXT NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
  family_member_id TEXT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  ownership_share REAL NOT NULL CHECK (ownership_share > 0 AND ownership_share <= 100),
  is_primary_owner INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(holding_id, family_member_id)
);

-- 7. Transactions (Cashflow and trade audit log)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  asset_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'fee', 'transfer')),
  quantity REAL,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  transaction_date TEXT NOT NULL,
  notes TEXT,
  member_id TEXT,
  account_id TEXT,
  destination_account_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'household_shared' CHECK (visibility IN ('household_shared', 'owner_only', 'restricted')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id, asset_id) REFERENCES assets(user_id, id) ON DELETE SET NULL,
  FOREIGN KEY (user_id, member_id) REFERENCES family_members(user_id, id) ON DELETE SET NULL,
  FOREIGN KEY (user_id, account_id) REFERENCES portfolio_accounts(user_id, id) ON DELETE SET NULL,
  FOREIGN KEY (user_id, destination_account_id) REFERENCES portfolio_accounts(user_id, id) ON DELETE SET NULL
);

-- 8. Liabilities (Debts and Mortgages)
CREATE TABLE IF NOT EXISTS liabilities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
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
  visibility TEXT NOT NULL DEFAULT 'household_shared' CHECK (visibility IN ('household_shared', 'owner_only', 'restricted')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, id),
  FOREIGN KEY (user_id, linked_asset_id) REFERENCES assets(user_id, id) ON DELETE SET NULL,
  FOREIGN KEY (user_id, member_id) REFERENCES family_members(user_id, id) ON DELETE SET NULL
);

-- 8b. Joint Liability Borrowers & Guarantors
CREATE TABLE IF NOT EXISTS liability_parties (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  liability_id TEXT NOT NULL REFERENCES liabilities(id) ON DELETE CASCADE,
  family_member_id TEXT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  party_role TEXT NOT NULL DEFAULT 'primary_borrower' CHECK (party_role IN ('primary_borrower', 'co_borrower', 'guarantor')),
  liability_share REAL NOT NULL CHECK (liability_share > 0 AND liability_share <= 100),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(liability_id, family_member_id)
);

-- 9. Asset Valuations (Dated historical appraisals)
CREATE TABLE IF NOT EXISTS asset_valuations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  valuation_paise INTEGER NOT NULL CHECK (valuation_paise >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  as_of_date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual_appraisal',
  notes TEXT,
  visibility TEXT NOT NULL DEFAULT 'household_shared' CHECK (visibility IN ('household_shared', 'owner_only', 'restricted')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, asset_id, as_of_date),
  FOREIGN KEY (user_id, asset_id) REFERENCES assets(user_id, id) ON DELETE CASCADE
);

-- 10. Liability Balances (Dated outstanding debt snapshots)
CREATE TABLE IF NOT EXISTS liability_balances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  liability_id TEXT NOT NULL,
  balance_paise INTEGER NOT NULL CHECK (balance_paise >= 0),
  as_of_date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  visibility TEXT NOT NULL DEFAULT 'household_shared' CHECK (visibility IN ('household_shared', 'owner_only', 'restricted')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(liability_id, as_of_date),
  FOREIGN KEY (user_id, liability_id) REFERENCES liabilities(user_id, id) ON DELETE CASCADE
);

-- 11. Asset Liability Links (Multi-loan collateral mapping)
CREATE TABLE IF NOT EXISTS asset_liability_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  liability_id TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'mortgage',
  ownership_share_percentage REAL NOT NULL DEFAULT 100.00,
  visibility TEXT NOT NULL DEFAULT 'household_shared' CHECK (visibility IN ('household_shared', 'owner_only', 'restricted')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(asset_id, liability_id),
  FOREIGN KEY (user_id, asset_id) REFERENCES assets(user_id, id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, liability_id) REFERENCES liabilities(user_id, id) ON DELETE CASCADE
);

-- 12. Financial Goals
CREATE TABLE IF NOT EXISTS financial_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
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
  visibility TEXT NOT NULL DEFAULT 'household_shared' CHECK (visibility IN ('household_shared', 'owner_only', 'restricted')),
  created_by TEXT,
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

-- 14. Family Document Vault (Metadata + Local Data URL for Offline Vault)
CREATE TABLE IF NOT EXISTS family_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  member_id TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN (
      'identity_pan',
      'property_deed',
      'cas_statement',
      'insurance_policy',
      'huf_deed',
      'tax_itr',
      'loan_agreement',
      'other'
    )
  ),
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0),
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  document_date TEXT,
  expiry_date TEXT,
  notes TEXT,
  is_encrypted INTEGER NOT NULL DEFAULT 0,
  local_data_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'household_shared' CHECK (visibility IN ('household_shared', 'owner_only', 'restricted')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id, member_id) REFERENCES family_members(user_id, id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_household_members_user ON household_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_family_members_household ON family_members(household_id);
CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_household ON holdings(household_id);
CREATE INDEX IF NOT EXISTS idx_holding_owners_holding ON holding_owners(holding_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_household ON transactions(household_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_liabilities_user ON liabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_liabilities_household ON liabilities(household_id);
CREATE INDEX IF NOT EXISTS idx_liability_parties_liability ON liability_parties(liability_id);
CREATE INDEX IF NOT EXISTS idx_asset_valuations_user_date ON asset_valuations(user_id, as_of_date);
CREATE INDEX IF NOT EXISTS idx_liability_balances_user_date ON liability_balances(user_id, as_of_date);
CREATE INDEX IF NOT EXISTS idx_financial_goals_user ON financial_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_goals_household ON financial_goals(household_id);
CREATE INDEX IF NOT EXISTS idx_family_documents_user ON family_documents(user_id, category);
CREATE INDEX IF NOT EXISTS idx_family_documents_household ON family_documents(household_id, category);
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

  try {
    db.exec(`ALTER TABLE households ADD COLUMN plan_tier TEXT NOT NULL DEFAULT 'family';`);
  } catch {
    // Column already exists on initialized databases
  }

  const insertClass = db.prepare(
    `INSERT OR IGNORE INTO asset_classes (id, name, color_hex, display_order) VALUES (?, ?, ?, ?)`
  );

  for (const ac of DEFAULT_ASSET_CLASSES) {
    insertClass.run(ac.id, ac.name, ac.color_hex, ac.display_order);
  }
}
