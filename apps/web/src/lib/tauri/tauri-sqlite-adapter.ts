import {
  SqliteDatabase,
  SqliteStatement,
  SqliteRunResult,
  initializeSqliteSchema,
} from '@wealthnest/application';

export interface TauriRawDatabaseConnection {
  execute(query: string, bindValues?: unknown[]): Promise<{ rowsAffected: number; lastInsertId: number }>;
  select<T = unknown>(query: string, bindValues?: unknown[]): Promise<T[]>;
}

export const LOCAL_SQLITE_STORAGE_KEY = 'wealthnest_local_sqlite_v1';
export const DEFAULT_LOCAL_USER_ID = 'usr-local-vault';

type RowRecord = Record<string, unknown>;

interface RelationalDatabaseState {
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

function createEmptyState(): RelationalDatabaseState {
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
    const existingProfile = this.state.profiles.find((p) => p.id === userId);
    if (existingProfile) return;

    const now = new Date().toISOString();

    // 1. Profile
    this.state.profiles.push({
      id: userId,
      display_name: 'Ketan Vaghela',
      default_currency: 'INR',
      preferences_json: null,
      created_at: now,
      updated_at: now,
    });

    // 2. Vaghela Household Family Members
    const members: RowRecord[] = [
      {
        id: 'mem-self',
        user_id: userId,
        name: 'Ketan Vaghela',
        relationship: 'self',
        pan_masked: 'ABCDE1234F',
        color_hex: '#3b82f6',
        is_primary: 1,
        notes: 'Age 38 — Freelance Contractor (ex-MNC), Primary Demats & Equity Portfolio',
        created_at: now,
      },
      {
        id: 'mem-spouse',
        user_id: userId,
        name: 'Parul Vaghela',
        relationship: 'spouse',
        pan_masked: 'BGTYU5678K',
        color_hex: '#ec4899',
        is_primary: 0,
        notes: 'Age 35 — Clerk at Bank of Baroda, Direct Mutual Funds & Demat',
        created_at: now,
      },
      {
        id: 'mem-child',
        user_id: userId,
        name: 'Krisha Vaghela',
        relationship: 'child',
        pan_masked: 'MINR90123C',
        color_hex: '#10b981',
        is_primary: 0,
        notes: 'Age 6 (1st Standard) — Long-term Higher Education Compounding & Sukanya/MF Fund',
        created_at: now,
      },
      {
        id: 'mem-huf',
        user_id: userId,
        name: 'Shamalbhai Vaghela HUF',
        relationship: 'huf',
        pan_masked: 'AAACH9999H',
        color_hex: '#8b5cf6',
        is_primary: 0,
        notes: 'Karta: Shamalbhai (Age 68, Retired Govt) — Section 112A ₹1.25L Annual LTCG Tax Shield',
        created_at: now,
      },
      {
        id: 'mem-mother',
        user_id: userId,
        name: 'Ramilaben Vaghela',
        relationship: 'parent',
        pan_masked: 'PRTYK4321M',
        color_hex: '#f59e0b',
        is_primary: 0,
        notes: 'Age 61 (Housewife) — Senior Citizen FDs & Sovereign Gold Bonds',
        created_at: now,
      },
    ];
    this.state.family_members.push(...members);

    // 3. Portfolio & Demat Accounts
    const accounts: RowRecord[] = [
      {
        id: 'acc-zerodha',
        user_id: userId,
        member_id: 'mem-self',
        account_name: 'Zerodha Kite',
        broker_name: 'Zerodha',
        depository: 'CDSL',
        account_number_masked: '12081600****1234',
        account_type: 'demat',
        created_at: now,
      },
      {
        id: 'acc-groww',
        user_id: userId,
        member_id: 'mem-spouse',
        account_name: 'Groww / BoB Direct Demat',
        broker_name: 'Groww',
        depository: 'CDSL',
        account_number_masked: '12088700****5678',
        account_type: 'demat',
        created_at: now,
      },
      {
        id: 'acc-icici',
        user_id: userId,
        member_id: 'mem-huf',
        account_name: 'ICICI Direct HUF',
        broker_name: 'ICICI Direct',
        depository: 'NSDL',
        account_number_masked: 'IN300126****9999',
        account_type: 'demat',
        created_at: now,
      },
      {
        id: 'acc-cams',
        user_id: userId,
        member_id: 'mem-child',
        account_name: 'CAMS / Parag Parikh Folio',
        broker_name: 'CAMS',
        depository: 'CAMS',
        account_number_masked: 'MF-FOLIO-****8821',
        account_type: 'mutual_fund_folio',
        created_at: now,
      },
      {
        id: 'acc-sbi-ppf',
        user_id: userId,
        member_id: 'mem-self',
        account_name: 'SBI PPF & Fixed Income',
        broker_name: 'SBI',
        depository: 'OTHER',
        account_number_masked: 'SBI-PPF-****4412',
        account_type: 'ppf_epf',
        created_at: now,
      },
      {
        id: 'acc-bob-fd',
        user_id: userId,
        member_id: 'mem-mother',
        account_name: 'Bank of Baroda Senior Citizen Deposit',
        broker_name: 'Bank of Baroda',
        depository: 'OTHER',
        account_number_masked: 'BOB-FD-****7109',
        account_type: 'savings_bank',
        created_at: now,
      },
    ];
    this.state.portfolio_accounts.push(...accounts);

    // 4. Seed Assets & Holdings (Integer Paise)
    const seededHoldings = [
      {
        assetId: 'asset-1',
        holdingId: 'hld-local-1',
        name: 'Reliance Industries Ltd',
        ticker: 'RELIANCE',
        isin: 'INE002A01018',
        assetClassId: 'equity',
        quantity: 80,
        unitCostPaise: 250000,
        currentValuePaise: 23600000,
        memberId: 'mem-self',
        accountId: 'acc-zerodha',
        dematAccountId: '1208160000000000',
        folioNumber: null,
        amcName: null,
        schemePlan: null,
        costBasisVerified: 1,
      },
      {
        assetId: 'asset-2',
        holdingId: 'hld-local-2',
        name: 'Parag Parikh Flexi Cap Fund',
        ticker: 'PPFAS-FLEXI',
        isin: 'INF879O01019',
        assetClassId: 'mutual_fund',
        quantity: 1500,
        unitCostPaise: 5500,
        currentValuePaise: 11000000,
        memberId: 'mem-spouse',
        accountId: 'acc-groww',
        dematAccountId: null,
        folioNumber: '10123456/90',
        amcName: 'PPFAS Mutual Fund',
        schemePlan: 'Direct Plan - Growth',
        costBasisVerified: 1,
      },
      {
        assetId: 'asset-3',
        holdingId: 'hld-local-3',
        name: 'Tata Consultancy Services',
        ticker: 'TCS',
        isin: 'INE467B01029',
        assetClassId: 'equity',
        quantity: 40,
        unitCostPaise: 360000,
        currentValuePaise: 16600000,
        memberId: 'mem-huf',
        accountId: 'acc-icici',
        dematAccountId: '1208160000000000',
        folioNumber: null,
        amcName: null,
        schemePlan: null,
        costBasisVerified: 1,
      },
      {
        assetId: 'asset-4',
        holdingId: 'hld-local-4',
        name: 'Sovereign Gold Bond 2028',
        ticker: 'SGB-2028',
        isin: 'IN0020180017',
        assetClassId: 'gold_silver',
        quantity: 30,
        unitCostPaise: 580000,
        currentValuePaise: 22950000,
        memberId: 'mem-self',
        accountId: 'acc-zerodha',
        dematAccountId: '1208160000000000',
        folioNumber: null,
        amcName: null,
        schemePlan: null,
        costBasisVerified: 1,
      },
      {
        assetId: 'asset-2b',
        holdingId: 'hld-local-2b',
        name: 'Bandhan Large & Mid Cap Fund',
        ticker: 'BANDHAN-LM',
        isin: 'INF194K01V89',
        assetClassId: 'mutual_fund',
        quantity: 2268.239,
        unitCostPaise: 14720,
        currentValuePaise: 37671800,
        memberId: 'mem-child',
        accountId: 'acc-cams',
        dematAccountId: null,
        folioNumber: '209928335/70',
        amcName: 'Bandhan Mutual Fund',
        schemePlan: 'Direct Plan - Growth',
        costBasisVerified: 0,
      },
      {
        assetId: 'asset-5',
        holdingId: 'hld-local-5',
        name: 'Public Provident Fund (PPF)',
        ticker: 'PPF',
        isin: null,
        assetClassId: 'fixed_income',
        quantity: 1,
        unitCostPaise: 150000000,
        currentValuePaise: 150000000,
        memberId: 'mem-self',
        accountId: 'acc-sbi-ppf',
        dematAccountId: null,
        folioNumber: null,
        amcName: null,
        schemePlan: null,
        costBasisVerified: 1,
      },
      {
        assetId: 'asset-6',
        holdingId: 'hld-local-6',
        name: 'Bank of Baroda Senior Citizen FD',
        ticker: 'BOB-FD',
        isin: null,
        assetClassId: 'fixed_income',
        quantity: 1,
        unitCostPaise: 50000000,
        currentValuePaise: 50000000,
        memberId: 'mem-mother',
        accountId: 'acc-bob-fd',
        dematAccountId: null,
        folioNumber: null,
        amcName: null,
        schemePlan: null,
        costBasisVerified: 1,
      },
    ];

    for (const item of seededHoldings) {
      this.state.assets.push({
        id: item.assetId,
        user_id: userId,
        name: item.name,
        ticker: item.ticker,
        isin: item.isin,
        asset_class_id: item.assetClassId,
        currency: 'INR',
        created_at: now,
      });

      this.state.holdings.push({
        id: item.holdingId,
        user_id: userId,
        asset_id: item.assetId,
        quantity: item.quantity,
        unit_cost_paise: item.unitCostPaise,
        current_value_paise: item.currentValuePaise,
        member_id: item.memberId,
        account_id: item.accountId,
        demat_account_id: item.dematAccountId,
        folio_number: item.folioNumber,
        amc_name: item.amcName,
        scheme_plan: item.schemePlan,
        cost_basis_verified: item.costBasisVerified,
        updated_at: now,
      });
    }

    // 5. Seed Baseline Transactions
    this.state.transactions.push(
      {
        id: 'txn-local-1',
        user_id: userId,
        asset_id: 'asset-1',
        type: 'buy',
        quantity: 15,
        amount_paise: 3750000,
        currency: 'INR',
        transaction_date: '2026-04-03',
        notes: 'Ketan Vaghela direct equity accumulation on NSE dip',
        member_id: 'mem-self',
        account_id: 'acc-zerodha',
        created_at: now,
      },
      {
        id: 'txn-local-2',
        user_id: userId,
        asset_id: 'asset-2b',
        type: 'buy',
        quantity: 67.93,
        amount_paise: 1000000,
        currency: 'INR',
        transaction_date: '2026-04-10',
        notes: 'Krisha Vaghela monthly education compounding SIP',
        member_id: 'mem-child',
        account_id: 'acc-cams',
        created_at: now,
      },
      {
        id: 'txn-local-3',
        user_id: userId,
        asset_id: 'asset-3',
        type: 'dividend',
        quantity: null,
        amount_paise: 480000,
        currency: 'INR',
        transaction_date: '2026-04-12',
        notes: 'Q4 Final Dividend credited to Shamalbhai Vaghela HUF bank account',
        member_id: 'mem-huf',
        account_id: 'acc-icici',
        created_at: now,
      }
    );

    // 6. Seed Baseline Liability
    this.state.liabilities.push({
      id: 'lia-local-1',
      user_id: userId,
      name: 'SBI Green Home Loan',
      loan_type: 'home_loan',
      lender: 'State Bank of India',
      account_number: '38192004812',
      original_principal_paise: 500000000,
      interest_rate: 8.5,
      interest_type: 'floating',
      tenure_months: 240,
      emi_amount_paise: 4339100,
      currency: 'INR',
      start_date: '2023-01-15',
      end_date: '2043-01-15',
      status: 'active',
      linked_asset_id: null,
      member_id: 'mem-self',
      notes: 'Pegged to EBLR repo rate',
      created_at: now,
    });
    this.state.liability_balances.push({
      id: 'lbal-local-1',
      user_id: userId,
      liability_id: 'lia-local-1',
      balance_paise: 412500000,
      as_of_date: '2026-01-10',
      source: 'manual',
      notes: 'Latest statement balance',
      created_at: now,
    });

    // 7. Seed Baseline Financial Goals
    this.state.financial_goals.push(
      {
        id: 'gol-local-1',
        user_id: userId,
        name: 'Krisha Higher Education & University Corpus',
        category: 'education',
        target_amount_paise: 350000000,
        target_date: '2038-06-01',
        initial_saved_paise: 60000000,
        monthly_contribution_paise: 1500000,
        expected_return_rate: 11.5,
        inflation_rate: 8.5,
        priority: 'high',
        currency: 'INR',
        notes: 'Krisha Vaghela (Age 6, 1st Std) targeting university & professional degree corpus at age 18.',
        member_id: 'mem-child',
        created_at: now,
      },
      {
        id: 'gol-local-2',
        user_id: userId,
        name: 'Ketan & Parul Retirement (FIRE Target: 52)',
        category: 'retirement',
        target_amount_paise: 2500000000,
        target_date: '2040-04-01',
        initial_saved_paise: 280000000,
        monthly_contribution_paise: 4500000,
        expected_return_rate: 12.0,
        inflation_rate: 6.0,
        priority: 'critical',
        currency: 'INR',
        notes: 'Ketan (Freelance Contractor, ex-MNC) & Parul (Bank of Baroda) long-term equity, PPF, and NPS accumulation.',
        member_id: 'mem-self',
        created_at: now,
      }
    );
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
        return this.executeRead<T>(normalizedSql, params);
      },

      get: (...params: unknown[]): T | undefined => {
        const rows = this.executeRead<T>(normalizedSql, params);
        return rows[0];
      },
    };
  }

  private executeWrite(sql: string, params: unknown[]): number {
    const now = new Date().toISOString();

    // 1. asset_classes
    if (/INSERT OR IGNORE INTO asset_classes/i.test(sql)) {
      const [id, name, color_hex, display_order] = params;
      if (!this.state.asset_classes.some((r) => r.id === id)) {
        this.state.asset_classes.push({ id, name, color_hex, display_order });
        return 1;
      }
      return 0;
    }

    // 2. profiles
    if (/INSERT OR IGNORE INTO profiles/i.test(sql)) {
      const [id, display_name] = params;
      if (!this.state.profiles.some((r) => r.id === id)) {
        this.state.profiles.push({
          id,
          display_name: display_name || 'Local Investor',
          default_currency: 'INR',
          preferences_json: null,
          created_at: now,
          updated_at: now,
        });
        return 1;
      }
      return 0;
    }

    if (/INSERT INTO profiles/i.test(sql)) {
      const [id, display_name, default_currency] = params;
      const existing = this.state.profiles.find((r) => r.id === id);
      if (existing) {
        existing.display_name = display_name;
        existing.default_currency = default_currency || 'INR';
        existing.updated_at = now;
      } else {
        this.state.profiles.push({
          id,
          display_name,
          default_currency: default_currency || 'INR',
          preferences_json: null,
          created_at: now,
          updated_at: now,
        });
      }
      return 1;
    }

    // 3. family_members
    if (/INSERT INTO family_members/i.test(sql)) {
      const [id, user_id, name, relationship, pan_masked, color_hex, is_primary, notes] = params;
      const existing = this.state.family_members.find((r) => r.id === id);
      if (existing) {
        existing.name = name;
        existing.relationship = relationship;
        existing.pan_masked = pan_masked;
        existing.color_hex = color_hex;
        existing.is_primary = is_primary;
        existing.notes = notes;
      } else {
        this.state.family_members.push({
          id,
          user_id,
          name,
          relationship,
          pan_masked,
          color_hex,
          is_primary,
          notes,
          created_at: now,
        });
      }
      return 1;
    }

    if (/DELETE FROM family_members WHERE id = \?/i.test(sql)) {
      const [id] = params;
      const before = this.state.family_members.length;
      this.state.family_members = this.state.family_members.filter((r) => r.id !== id);
      return before - this.state.family_members.length;
    }

    // 4. portfolio_accounts
    if (/INSERT INTO portfolio_accounts/i.test(sql)) {
      const [
        id,
        user_id,
        member_id,
        account_name,
        broker_name,
        depository,
        account_number_masked,
        account_type,
      ] = params;
      const existing = this.state.portfolio_accounts.find((r) => r.id === id);
      if (existing) {
        existing.member_id = member_id;
        existing.account_name = account_name;
        existing.broker_name = broker_name;
        existing.depository = depository;
        existing.account_number_masked = account_number_masked;
        existing.account_type = account_type;
      } else {
        this.state.portfolio_accounts.push({
          id,
          user_id,
          member_id,
          account_name,
          broker_name,
          depository,
          account_number_masked,
          account_type,
          created_at: now,
        });
      }
      return 1;
    }

    if (/DELETE FROM portfolio_accounts WHERE id = \?/i.test(sql)) {
      const [id] = params;
      const before = this.state.portfolio_accounts.length;
      this.state.portfolio_accounts = this.state.portfolio_accounts.filter((r) => r.id !== id);
      return before - this.state.portfolio_accounts.length;
    }

    // 5. assets
    if (/INSERT INTO assets/i.test(sql)) {
      if (/'mutual_fund'/i.test(sql) && params.length === 6) {
        const [id, user_id, name, ticker, isin, currency] = params;
        this.state.assets.push({
          id,
          user_id,
          name,
          ticker,
          isin,
          asset_class_id: 'mutual_fund',
          currency: currency || 'INR',
          created_at: now,
        });
        return 1;
      }
      const [id, user_id, name, ticker, isin, asset_class_id, currency] = params;
      const existing = this.state.assets.find((r) => r.id === id);
      if (existing) {
        existing.name = name;
        existing.ticker = ticker ?? existing.ticker;
        existing.isin = isin ?? existing.isin;
        existing.asset_class_id = asset_class_id || existing.asset_class_id || 'equity';
        existing.currency = currency || existing.currency || 'INR';
      } else {
        this.state.assets.push({
          id,
          user_id,
          name,
          ticker: ticker ?? null,
          isin: isin ?? null,
          asset_class_id: asset_class_id || 'equity',
          currency: currency || 'INR',
          created_at: now,
        });
      }
      return 1;
    }

    if (/UPDATE assets SET name = \?, isin = COALESCE\(\?, isin\)/i.test(sql)) {
      const [name, isin, ticker, id, user_id] = params;
      const asset = this.state.assets.find((r) => r.id === id && r.user_id === user_id);
      if (asset) {
        asset.name = name;
        if (isin !== null && isin !== undefined) asset.isin = isin;
        if (ticker !== null && ticker !== undefined) asset.ticker = ticker;
        return 1;
      }
      return 0;
    }

    if (/UPDATE assets SET name = \?, ticker = COALESCE\(\?, ticker\)/i.test(sql)) {
      const [name, ticker, id, user_id] = params;
      const asset = this.state.assets.find((r) => r.id === id && r.user_id === user_id);
      if (asset) {
        asset.name = name;
        if (ticker !== null && ticker !== undefined) asset.ticker = ticker;
        return 1;
      }
      return 0;
    }

    // 6. holdings
    if (/INSERT INTO holdings/i.test(sql)) {
      const [
        id,
        user_id,
        asset_id,
        quantity,
        unit_cost_paise,
        current_value_paise,
        member_id,
        account_id,
        demat_account_id,
        folio_number,
        amc_name,
        scheme_plan,
        cost_basis_verified,
      ] = params;
      const existing = this.state.holdings.find(
        (r) => r.id === id || (r.user_id === user_id && r.asset_id === asset_id)
      );
      if (existing) {
        existing.quantity = quantity;
        existing.unit_cost_paise = unit_cost_paise;
        existing.current_value_paise = current_value_paise;
        existing.updated_at = now;
      } else {
        this.state.holdings.push({
          id,
          user_id,
          asset_id,
          quantity,
          unit_cost_paise,
          current_value_paise,
          member_id: member_id ?? null,
          account_id: account_id ?? null,
          demat_account_id: demat_account_id ?? null,
          folio_number: folio_number ?? null,
          amc_name: amc_name ?? null,
          scheme_plan: scheme_plan ?? null,
          cost_basis_verified: cost_basis_verified ?? 1,
          updated_at: now,
        });
      }
      return 1;
    }

    if (/UPDATE holdings SET quantity = \?, unit_cost_paise = \?, current_value_paise = \?, demat_account_id/i.test(sql)) {
      const [
        quantity,
        unit_cost_paise,
        current_value_paise,
        demat_account_id,
        folio_number,
        amc_name,
        scheme_plan,
        cost_basis_verified,
        member_id,
        account_id,
        id,
        user_id,
      ] = params;
      const h = this.state.holdings.find((r) => r.id === id && r.user_id === user_id);
      if (h) {
        h.quantity = quantity;
        h.unit_cost_paise = unit_cost_paise;
        h.current_value_paise = current_value_paise;
        if (demat_account_id !== null && demat_account_id !== undefined) h.demat_account_id = demat_account_id;
        if (folio_number !== null && folio_number !== undefined) h.folio_number = folio_number;
        if (amc_name !== null && amc_name !== undefined) h.amc_name = amc_name;
        if (scheme_plan !== null && scheme_plan !== undefined) h.scheme_plan = scheme_plan;
        h.cost_basis_verified = cost_basis_verified;
        if (member_id !== null && member_id !== undefined) h.member_id = member_id;
        if (account_id !== null && account_id !== undefined) h.account_id = account_id;
        h.updated_at = now;
        return 1;
      }
      return 0;
    }

    if (/UPDATE holdings SET quantity = \?, unit_cost_paise = \?, current_value_paise = \?/i.test(sql)) {
      const [quantity, unit_cost_paise, current_value_paise, id, user_id] = params;
      const h = this.state.holdings.find((r) => r.id === id && r.user_id === user_id);
      if (h) {
        h.quantity = quantity;
        h.unit_cost_paise = unit_cost_paise;
        h.current_value_paise = current_value_paise;
        h.updated_at = now;
        return 1;
      }
      return 0;
    }

    if (/DELETE FROM holdings WHERE id = \?/i.test(sql)) {
      const [id, user_id] = params;
      const before = this.state.holdings.length;
      this.state.holdings = this.state.holdings.filter(
        (r) => !(r.id === id && (!user_id || r.user_id === user_id))
      );
      return before - this.state.holdings.length;
    }

    // 7. transactions
    if (/INSERT INTO transactions/i.test(sql)) {
      const [
        id,
        user_id,
        asset_id,
        type,
        quantity,
        amount_paise,
        currency,
        transaction_date,
        notes,
        member_id,
        account_id,
      ] = params;
      const existing = this.state.transactions.find((r) => r.id === id);
      if (existing) {
        existing.amount_paise = amount_paise;
        existing.notes = notes;
      } else {
        this.state.transactions.push({
          id,
          user_id,
          asset_id: asset_id ?? null,
          type,
          quantity: quantity ?? null,
          amount_paise,
          currency: currency || 'INR',
          transaction_date,
          notes: notes ?? null,
          member_id: member_id ?? null,
          account_id: account_id ?? null,
          created_at: now,
        });
      }
      return 1;
    }

    if (/DELETE FROM transactions WHERE id = \?/i.test(sql)) {
      const [id, user_id] = params;
      const before = this.state.transactions.length;
      this.state.transactions = this.state.transactions.filter(
        (r) => !(r.id === id && (!user_id || r.user_id === user_id))
      );
      return before - this.state.transactions.length;
    }

    // 8. liabilities
    if (/INSERT INTO liabilities/i.test(sql)) {
      const [
        id,
        user_id,
        name,
        loan_type,
        lender,
        account_number,
        original_principal_paise,
        interest_rate,
        interest_type,
        tenure_months,
        emi_amount_paise,
        currency,
        start_date,
        end_date,
        status,
        linked_asset_id,
        member_id,
        notes,
      ] = params;
      const existing = this.state.liabilities.find((r) => r.id === id);
      if (existing) {
        existing.interest_rate = interest_rate;
        existing.emi_amount_paise = emi_amount_paise;
      } else {
        this.state.liabilities.push({
          id,
          user_id,
          name,
          loan_type,
          lender,
          account_number: account_number ?? null,
          original_principal_paise,
          interest_rate,
          interest_type: interest_type || 'floating',
          tenure_months: tenure_months ?? null,
          emi_amount_paise: emi_amount_paise ?? 0,
          currency: currency || 'INR',
          start_date: start_date ?? null,
          end_date: end_date ?? null,
          status: status || 'active',
          linked_asset_id: linked_asset_id ?? null,
          member_id: member_id ?? null,
          notes: notes ?? null,
          created_at: now,
        });
      }
      return 1;
    }

    if (/UPDATE liabilities SET/i.test(sql)) {
      const [
        name,
        loan_type,
        lender,
        account_number,
        interest_rate,
        interest_type,
        tenure_months,
        emi_amount_paise,
        status,
        linked_asset_id,
        member_id,
        notes,
        id,
        user_id,
      ] = params;
      const lia = this.state.liabilities.find((r) => r.id === id && r.user_id === user_id);
      if (lia) {
        if (name !== null && name !== undefined) lia.name = name;
        if (loan_type !== null && loan_type !== undefined) lia.loan_type = loan_type;
        if (lender !== null && lender !== undefined) lia.lender = lender;
        if (account_number !== null && account_number !== undefined) lia.account_number = account_number;
        if (interest_rate !== null && interest_rate !== undefined) lia.interest_rate = interest_rate;
        if (interest_type !== null && interest_type !== undefined) lia.interest_type = interest_type;
        if (tenure_months !== null && tenure_months !== undefined) lia.tenure_months = tenure_months;
        if (emi_amount_paise !== null && emi_amount_paise !== undefined) lia.emi_amount_paise = emi_amount_paise;
        if (status !== null && status !== undefined) lia.status = status;
        if (linked_asset_id !== null && linked_asset_id !== undefined) lia.linked_asset_id = linked_asset_id;
        if (member_id !== null && member_id !== undefined) lia.member_id = member_id;
        if (notes !== null && notes !== undefined) lia.notes = notes;
        return 1;
      }
      return 0;
    }

    if (/DELETE FROM liabilities WHERE id = \?/i.test(sql)) {
      const [id, user_id] = params;
      const before = this.state.liabilities.length;
      this.state.liabilities = this.state.liabilities.filter(
        (r) => !(r.id === id && (!user_id || r.user_id === user_id))
      );
      return before - this.state.liabilities.length;
    }

    // 9. liability_balances
    if (/INSERT INTO liability_balances/i.test(sql)) {
      const [id, user_id, liability_id, balance_paise, as_of_date, source, notes] = params;
      const existing = this.state.liability_balances.find(
        (r) => r.liability_id === liability_id && r.as_of_date === as_of_date
      );
      if (existing) {
        existing.balance_paise = balance_paise;
        if (source) existing.source = source;
        if (notes !== undefined) existing.notes = notes;
      } else {
        this.state.liability_balances.push({
          id,
          user_id,
          liability_id,
          balance_paise,
          as_of_date,
          source: source || 'manual',
          notes: notes ?? null,
          created_at: now,
        });
      }
      return 1;
    }

    // 10. asset_valuations
    if (/INSERT INTO asset_valuations/i.test(sql)) {
      const [id, user_id, asset_id, valuation_paise, currency, as_of_date, source, notes] = params;
      const existing = this.state.asset_valuations.find(
        (r) => r.user_id === user_id && r.asset_id === asset_id && r.as_of_date === as_of_date
      );
      if (existing) {
        existing.valuation_paise = valuation_paise;
        existing.source = source;
        existing.notes = notes;
      } else {
        this.state.asset_valuations.push({
          id,
          user_id,
          asset_id,
          valuation_paise,
          currency: currency || 'INR',
          as_of_date,
          source: source || 'manual_appraisal',
          notes: notes ?? null,
          created_at: now,
        });
      }
      return 1;
    }

    // 11. asset_liability_links
    if (/INSERT INTO asset_liability_links/i.test(sql)) {
      const [id, user_id, asset_id, liability_id, link_type, ownership_share_percentage] = params;
      const existing = this.state.asset_liability_links.find(
        (r) => r.asset_id === asset_id && r.liability_id === liability_id
      );
      if (existing) {
        existing.link_type = link_type;
        existing.ownership_share_percentage = ownership_share_percentage;
      } else {
        this.state.asset_liability_links.push({
          id,
          user_id,
          asset_id,
          liability_id,
          link_type: link_type || 'mortgage',
          ownership_share_percentage: ownership_share_percentage ?? 100,
          created_at: now,
        });
      }
      return 1;
    }

    if (/DELETE FROM asset_liability_links/i.test(sql)) {
      const [user_id, asset_id, liability_id] = params;
      const before = this.state.asset_liability_links.length;
      this.state.asset_liability_links = this.state.asset_liability_links.filter(
        (r) => !(r.user_id === user_id && r.asset_id === asset_id && r.liability_id === liability_id)
      );
      return before - this.state.asset_liability_links.length;
    }

    // 12. financial_goals
    if (/INSERT INTO financial_goals/i.test(sql)) {
      const [
        id,
        user_id,
        name,
        category,
        target_amount_paise,
        target_date,
        initial_saved_paise,
        monthly_contribution_paise,
        expected_return_rate,
        inflation_rate,
        priority,
        currency,
        notes,
        member_id,
      ] = params;
      const existing = this.state.financial_goals.find((r) => r.id === id);
      if (existing) {
        existing.target_amount_paise = target_amount_paise;
      } else {
        this.state.financial_goals.push({
          id,
          user_id,
          name,
          category,
          target_amount_paise,
          target_date,
          initial_saved_paise: initial_saved_paise ?? 0,
          monthly_contribution_paise: monthly_contribution_paise ?? 0,
          expected_return_rate: expected_return_rate ?? 12.0,
          inflation_rate: inflation_rate ?? 6.0,
          priority: priority || 'medium',
          currency: currency || 'INR',
          notes: notes ?? null,
          member_id: member_id ?? null,
          created_at: now,
        });
      }
      return 1;
    }

    if (/UPDATE financial_goals SET/i.test(sql)) {
      const [
        name,
        category,
        target_amount_paise,
        target_date,
        initial_saved_paise,
        monthly_contribution_paise,
        expected_return_rate,
        inflation_rate,
        priority,
        notes,
        member_id,
        id,
        user_id,
      ] = params;
      const gol = this.state.financial_goals.find((r) => r.id === id && r.user_id === user_id);
      if (gol) {
        if (name !== null && name !== undefined) gol.name = name;
        if (category !== null && category !== undefined) gol.category = category;
        if (target_amount_paise !== null && target_amount_paise !== undefined) gol.target_amount_paise = target_amount_paise;
        if (target_date !== null && target_date !== undefined) gol.target_date = target_date;
        if (initial_saved_paise !== null && initial_saved_paise !== undefined) gol.initial_saved_paise = initial_saved_paise;
        if (monthly_contribution_paise !== null && monthly_contribution_paise !== undefined) gol.monthly_contribution_paise = monthly_contribution_paise;
        if (expected_return_rate !== null && expected_return_rate !== undefined) gol.expected_return_rate = expected_return_rate;
        if (inflation_rate !== null && inflation_rate !== undefined) gol.inflation_rate = inflation_rate;
        if (priority !== null && priority !== undefined) gol.priority = priority;
        if (notes !== null && notes !== undefined) gol.notes = notes;
        if (member_id !== null && member_id !== undefined) gol.member_id = member_id;
        return 1;
      }
      return 0;
    }

    if (/DELETE FROM financial_goals WHERE id = \?/i.test(sql)) {
      const [id, user_id] = params;
      const before = this.state.financial_goals.length;
      this.state.financial_goals = this.state.financial_goals.filter(
        (r) => !(r.id === id && (!user_id || r.user_id === user_id))
      );
      return before - this.state.financial_goals.length;
    }

    // 13. goal_holdings
    if (/INSERT INTO goal_holdings/i.test(sql)) {
      const [id, goal_id, holding_id, allocation_percentage] = params;
      const existing = this.state.goal_holdings.find(
        (r) => r.goal_id === goal_id && r.holding_id === holding_id
      );
      if (existing) {
        existing.allocation_percentage = allocation_percentage;
      } else {
        this.state.goal_holdings.push({
          id,
          goal_id,
          holding_id,
          allocation_percentage,
          created_at: now,
        });
      }
      return 1;
    }

    if (/DELETE FROM goal_holdings/i.test(sql)) {
      const [goal_id, holding_id] = params;
      const before = this.state.goal_holdings.length;
      this.state.goal_holdings = this.state.goal_holdings.filter(
        (r) => !(r.goal_id === goal_id && r.holding_id === holding_id)
      );
      return before - this.state.goal_holdings.length;
    }

    return 1;
  }

  private executeRead<T>(sql: string, params: unknown[]): T[] {
    // 1. asset_classes
    if (/FROM asset_classes WHERE id = \?/i.test(sql)) {
      const [id] = params;
      return this.state.asset_classes.filter((r) => r.id === id) as unknown as T[];
    }
    if (/FROM asset_classes/i.test(sql)) {
      return [...this.state.asset_classes].sort(
        (a, b) => Number(a.display_order || 0) - Number(b.display_order || 0)
      ) as unknown as T[];
    }

    // 2. family_members
    if (/FROM family_members WHERE user_id = \? AND id = \?/i.test(sql)) {
      const [user_id, id] = params;
      return this.state.family_members.filter(
        (r) => r.user_id === user_id && r.id === id
      ) as unknown as T[];
    }
    if (/FROM family_members WHERE user_id = \?/i.test(sql)) {
      const [user_id] = params;
      return this.state.family_members
        .filter((r) => r.user_id === user_id)
        .sort((a, b) => Number(b.is_primary || 0) - Number(a.is_primary || 0)) as unknown as T[];
    }
    if (/FROM family_members WHERE id = \?/i.test(sql)) {
      const [id] = params;
      return this.state.family_members.filter((r) => r.id === id) as unknown as T[];
    }

    // 3. portfolio_accounts
    if (/FROM portfolio_accounts WHERE user_id = \? AND id = \?/i.test(sql)) {
      const [user_id, id] = params;
      return this.state.portfolio_accounts.filter(
        (r) => r.user_id === user_id && r.id === id
      ) as unknown as T[];
    }
    if (/FROM portfolio_accounts WHERE user_id = \?/i.test(sql)) {
      const [user_id] = params;
      return this.state.portfolio_accounts.filter(
        (r) => r.user_id === user_id
      ) as unknown as T[];
    }
    if (/FROM portfolio_accounts WHERE id = \?/i.test(sql)) {
      const [id] = params;
      return this.state.portfolio_accounts.filter((r) => r.id === id) as unknown as T[];
    }

    // 4. Holdings joined with assets and asset_classes
    if (/FROM holdings h JOIN assets a/i.test(sql)) {
      const [user_id] = params;
      const rows = this.state.holdings
        .filter((h) => h.user_id === user_id)
        .map((h) => {
          const asset = this.state.assets.find(
            (a) => a.user_id === h.user_id && a.id === h.asset_id
          );
          if (!asset) return null;
          const ac =
            this.state.asset_classes.find((c) => c.id === asset.asset_class_id) || {
              id: asset.asset_class_id || 'equity',
              name: 'Equity & Stocks',
              color_hex: '#10B981',
            };
          return {
            holdingId: h.id,
            assetId: asset.id,
            name: asset.name,
            ticker: asset.ticker,
            isin: asset.isin,
            assetClassId: ac.id,
            assetClassName: ac.name,
            assetClassColor: ac.color_hex,
            quantity: h.quantity,
            unitCostCents: h.unit_cost_paise,
            currentValueCents: h.current_value_paise,
            currency: asset.currency || 'INR',
            updatedAt: h.updated_at,
            dematAccountId: h.demat_account_id,
            folioNumber: h.folio_number,
            amcName: h.amc_name,
            schemePlan: h.scheme_plan,
            costBasisVerified: h.cost_basis_verified,
            memberId: h.member_id,
            accountId: h.account_id,
          };
        })
        .filter(Boolean);
      return rows as unknown as T[];
    }

    if (/FROM holdings WHERE user_id = \? AND asset_id = \?/i.test(sql)) {
      const [user_id, asset_id] = params;
      return this.state.holdings.filter(
        (h) => h.user_id === user_id && h.asset_id === asset_id
      ) as unknown as T[];
    }

    // 5. assets lookups
    if (/FROM assets WHERE user_id = \? AND isin = \?/i.test(sql)) {
      const [user_id, isin] = params;
      return this.state.assets.filter(
        (a) => a.user_id === user_id && a.isin === isin
      ) as unknown as T[];
    }
    if (/FROM assets WHERE user_id = \? AND LOWER\(name\) = LOWER\(\?\)/i.test(sql)) {
      const [user_id, name] = params;
      const target = String(name || '').toLowerCase();
      return this.state.assets.filter(
        (a) => a.user_id === user_id && String(a.name || '').toLowerCase() === target
      ) as unknown as T[];
    }

    // 6. transactions
    if (/FROM transactions t LEFT JOIN assets a/i.test(sql)) {
      const [user_id] = params;
      const rows = this.state.transactions
        .filter((t) => t.user_id === user_id)
        .map((t) => {
          const asset = this.state.assets.find(
            (a) => a.user_id === t.user_id && a.id === t.asset_id
          );
          return {
            id: t.id,
            userId: t.user_id,
            assetId: t.asset_id,
            assetName: asset?.name,
            assetTicker: asset?.ticker,
            type: t.type,
            quantity: t.quantity,
            amountCents: t.amount_paise,
            currency: t.currency || 'INR',
            transactionDate: t.transaction_date,
            notes: t.notes,
            memberId: t.member_id,
            accountId: t.account_id,
            createdAt: t.created_at,
          };
        })
        .sort((a, b) => String(b.transactionDate).localeCompare(String(a.transactionDate)));
      return rows as unknown as T[];
    }

    if (/FROM transactions WHERE user_id = \? AND asset_id = \?/i.test(sql)) {
      const [user_id, asset_id, transaction_date, amount_paise, type] = params;
      return this.state.transactions.filter(
        (t) =>
          t.user_id === user_id &&
          t.asset_id === asset_id &&
          t.transaction_date === transaction_date &&
          t.amount_paise === amount_paise &&
          t.type === type
      ) as unknown as T[];
    }

    // 7. liabilities & balances
    if (/FROM liabilities WHERE user_id = \?/i.test(sql)) {
      const [user_id] = params;
      return this.state.liabilities.filter((l) => l.user_id === user_id) as unknown as T[];
    }

    if (/FROM liability_balances WHERE liability_id = \? AND user_id = \?/i.test(sql)) {
      const [liability_id, user_id] = params;
      return this.state.liability_balances
        .filter((b) => b.liability_id === liability_id && b.user_id === user_id)
        .sort((a, b) => String(b.as_of_date).localeCompare(String(a.as_of_date))) as unknown as T[];
    }

    if (/FROM liability_balances WHERE liability_id = \?/i.test(sql)) {
      const [liability_id] = params;
      return this.state.liability_balances
        .filter((b) => b.liability_id === liability_id)
        .sort((a, b) => String(b.as_of_date).localeCompare(String(a.as_of_date))) as unknown as T[];
    }

    // 8. asset_valuations & links
    if (/FROM asset_valuations WHERE asset_id = \? AND user_id = \?/i.test(sql)) {
      const [asset_id, user_id] = params;
      return this.state.asset_valuations
        .filter((v) => v.asset_id === asset_id && v.user_id === user_id)
        .sort((a, b) => String(b.as_of_date).localeCompare(String(a.as_of_date))) as unknown as T[];
    }

    if (/FROM asset_liability_links WHERE user_id = \?/i.test(sql)) {
      const [user_id] = params;
      return this.state.asset_liability_links.filter(
        (l) => l.user_id === user_id
      ) as unknown as T[];
    }

    // 9. financial_goals & goal_holdings
    if (/FROM financial_goals WHERE user_id = \?/i.test(sql)) {
      const [user_id] = params;
      return this.state.financial_goals
        .filter((g) => g.user_id === user_id)
        .sort((a, b) => String(a.target_date).localeCompare(String(b.target_date))) as unknown as T[];
    }

    if (/FROM goal_holdings gh JOIN holdings h/i.test(sql)) {
      const [goal_id] = params;
      const rows = this.state.goal_holdings
        .filter((gh) => gh.goal_id === goal_id)
        .map((gh) => {
          const h = this.state.holdings.find((item) => item.id === gh.holding_id);
          if (!h) return null;
          const asset = this.state.assets.find(
            (a) => a.user_id === h.user_id && a.id === h.asset_id
          );
          if (!asset) return null;
          return {
            holding_id: gh.holding_id,
            allocation_percentage: gh.allocation_percentage,
            holding_name: asset.name,
            ticker: asset.ticker,
            current_value_paise: h.current_value_paise,
          };
        })
        .filter(Boolean);
      return rows as unknown as T[];
    }

    return [];
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
