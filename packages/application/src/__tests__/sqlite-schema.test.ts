import { describe, it, expect, beforeEach } from 'vitest';
import { createTestSqliteDb } from './test-sqlite-helper.js';
import { SqliteDatabase } from '../persistence/sqlite/sqlite-connection.js';

describe('Phase 9.1: SQLite Schema & Engine Initialization', () => {
  let db: SqliteDatabase;

  beforeEach(() => {
    db = createTestSqliteDb();
  });

  it('TC-9.1-01A: initializes all 12 core tables plus link tables', () => {
    const tables = db
      .prepare<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
      .all()
      .map((r) => r.name);

    const expectedTables = [
      'asset_classes',
      'asset_liability_links',
      'asset_valuations',
      'assets',
      'family_members',
      'financial_goals',
      'goal_holdings',
      'holdings',
      'liabilities',
      'liability_balances',
      'portfolio_accounts',
      'profiles',
      'transactions',
    ];

    for (const expected of expectedTables) {
      expect(tables).toContain(expected);
    }
  });

  it('TC-9.1-01B: seeds default asset classes with correct colors and display order', () => {
    const assetClasses = db
      .prepare<{ id: string; name: string; color_hex: string }>(
        'SELECT id, name, color_hex FROM asset_classes ORDER BY display_order ASC;'
      )
      .all();

    expect(assetClasses.length).toBeGreaterThanOrEqual(8);
    const equity = assetClasses.find((ac) => ac.id === 'equity');
    expect(equity).toBeDefined();
    expect(equity?.name).toBe('Equity & Stocks');
    expect(equity?.color_hex).toBe('#10B981');
  });

  it('TC-9.1-01C: enforces PRAGMA foreign_keys = ON and rejects invalid references', () => {
    // Attempting to insert an asset for a non-existent profile fails
    expect(() => {
      db.prepare(
        "INSERT INTO assets (id, user_id, name, asset_class_id) VALUES ('asset-1', 'non-existent-user', 'TCS', 'equity');"
      ).run();
    }).toThrow(/FOREIGN KEY/i);
  });

  it('TC-9.1-01D: cascades deletion from profile to assets and holdings', () => {
    // Create profile
    db.prepare("INSERT INTO profiles (id, display_name) VALUES ('usr-1', 'Ketan Vaghela');").run();

    // Create asset
    db.prepare(
      "INSERT INTO assets (id, user_id, name, asset_class_id) VALUES ('ast-1', 'usr-1', 'Reliance Industries', 'equity');"
    ).run();

    // Create holding
    db.prepare(
      "INSERT INTO holdings (id, user_id, asset_id, quantity, unit_cost_paise, current_value_paise) VALUES ('hld-1', 'usr-1', 'ast-1', 10, 250000, 290000);"
    ).run();

    // Confirm existence
    expect(db.prepare('SELECT COUNT(*) as cnt FROM holdings WHERE user_id = ?;').get('usr-1')).toEqual({
      cnt: 1,
    });

    // Delete profile
    db.prepare('DELETE FROM profiles WHERE id = ?;').run('usr-1');

    // Confirm cascade to assets and holdings
    expect(db.prepare('SELECT COUNT(*) as cnt FROM assets WHERE user_id = ?;').get('usr-1')).toEqual({
      cnt: 0,
    });
    expect(db.prepare('SELECT COUNT(*) as cnt FROM holdings WHERE user_id = ?;').get('usr-1')).toEqual({
      cnt: 0,
    });
  });
});
