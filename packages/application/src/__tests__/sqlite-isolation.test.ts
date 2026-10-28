import { describe, it, expect, beforeEach } from 'vitest';
import { createTestSqliteDb } from './test-sqlite-helper.js';
import { SqliteDatabase } from '../persistence/sqlite/sqlite-connection.js';

describe('Phase 9.1: Cross-User SQLite Isolation (Composite Foreign Keys)', () => {
  let db: SqliteDatabase;

  beforeEach(() => {
    db = createTestSqliteDb();

    // Setup User A (Ketan Vaghela)
    db.prepare("INSERT INTO profiles (id, display_name) VALUES ('usr-ketan', 'Ketan Vaghela');").run();
    db.prepare(
      "INSERT INTO family_members (id, user_id, name, relationship, color_hex) VALUES ('fm-ketan-self', 'usr-ketan', 'Ketan Vaghela', 'self', '#3B82F6');"
    ).run();
    db.prepare(
      "INSERT INTO assets (id, user_id, name, asset_class_id) VALUES ('ast-ketan-equity', 'usr-ketan', 'HDFC Bank', 'equity');"
    ).run();

    // Setup User B (External User / Tenant B)
    db.prepare("INSERT INTO profiles (id, display_name) VALUES ('usr-other', 'Other Investor');").run();
    db.prepare(
      "INSERT INTO family_members (id, user_id, name, relationship, color_hex) VALUES ('fm-other-self', 'usr-other', 'Other Person', 'self', '#EF4444');"
    ).run();
    db.prepare(
      "INSERT INTO assets (id, user_id, name, asset_class_id) VALUES ('ast-other-equity', 'usr-other', 'Infosys', 'equity');"
    ).run();
  });

  it('TC-9.1-02A: rejects holding creation if asset belongs to a different user', () => {
    // Attempting to create a holding for Ketan with Tenant B's asset MUST fail
    expect(() => {
      db.prepare(
        "INSERT INTO holdings (id, user_id, asset_id, quantity, unit_cost_paise, current_value_paise) VALUES ('hld-bad', 'usr-ketan', 'ast-other-equity', 10, 100000, 120000);"
      ).run();
    }).toThrow(/FOREIGN KEY/i);
  });

  it('TC-9.1-02B: rejects portfolio account linking to another user family member', () => {
    // Attempting to create a demat account for Ketan linking to Tenant B's family member MUST fail
    expect(() => {
      db.prepare(
        "INSERT INTO portfolio_accounts (id, user_id, member_id, account_name, broker_name, depository, account_type) VALUES ('acc-bad', 'usr-ketan', 'fm-other-self', 'Illegal Demat', 'Zerodha', 'CDSL', 'demat');"
      ).run();
    }).toThrow(/FOREIGN KEY/i);
  });

  it('TC-9.1-02C: rejects liability linking another user asset as collateral', () => {
    // Attempting to create a liability for Ketan linking Tenant B's asset as collateral MUST fail
    expect(() => {
      db.prepare(
        "INSERT INTO liabilities (id, user_id, name, loan_type, lender, original_principal_paise, interest_rate, linked_asset_id) VALUES ('liab-bad', 'usr-ketan', 'Bad Loan', 'home_loan', 'SBI', 500000000, 8.5, 'ast-other-equity');"
      ).run();
    }).toThrow(/FOREIGN KEY/i);
  });

  it('TC-9.1-02D: rejects financial goal linking another user family member', () => {
    // Attempting to assign Tenant B's family member as beneficiary for Ketan's goal MUST fail
    expect(() => {
      db.prepare(
        "INSERT INTO financial_goals (id, user_id, name, category, target_amount_paise, target_date, member_id) VALUES ('goal-bad', 'usr-ketan', 'Bad Goal', 'education', 250000000, '2035-01-01', 'fm-other-self');"
      ).run();
    }).toThrow(/FOREIGN KEY/i);
  });

  it('TC-9.1-02E: succeeds when all composite entities belong to the same user', () => {
    // Valid holding creation for Ketan
    expect(() => {
      db.prepare(
        "INSERT INTO holdings (id, user_id, asset_id, quantity, unit_cost_paise, current_value_paise, member_id) VALUES ('hld-good', 'usr-ketan', 'ast-ketan-equity', 50, 160000, 175000, 'fm-ketan-self');"
      ).run();
    }).not.toThrow();

    const holding = db
      .prepare('SELECT id, user_id, asset_id, quantity FROM holdings WHERE id = ?;')
      .get('hld-good');
    expect(holding).toEqual({
      id: 'hld-good',
      user_id: 'usr-ketan',
      asset_id: 'ast-ketan-equity',
      quantity: 50,
    });
  });
});
