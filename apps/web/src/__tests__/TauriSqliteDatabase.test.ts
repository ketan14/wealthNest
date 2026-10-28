import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TauriSqliteAdapter,
  TauriRawDatabaseConnection,
  LOCAL_SQLITE_STORAGE_KEY,
  DEFAULT_LOCAL_USER_ID,
} from '../lib/tauri/tauri-sqlite-adapter';
import {
  SqliteHoldingAdapter,
  SqliteFamilyAdapter,
  SqliteTransactionAdapter,
  SqliteLiabilityAdapter,
  SqliteGoalAdapter,
} from '@wealthnest/application';

describe('Phase 10: Tauri 2 SQLite Database Adapter & Offline Persistence', () => {
  beforeEach(() => {
    window.localStorage.removeItem(LOCAL_SQLITE_STORAGE_KEY);
  });

  it('TC-10-03A: instantiates adapter, executes schema initialization, and pre-seeds Vaghela Household data', async () => {
    const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 0, lastInsertId: 0 });
    const mockSelect = vi.fn().mockResolvedValue([]);

    const mockConnection: TauriRawDatabaseConnection = {
      execute: mockExecute,
      select: mockSelect,
    };

    const adapter = new TauriSqliteAdapter(mockConnection);
    expect(adapter).toBeDefined();

    // Call initialize to verify schema generation & default household seeding runs without error
    expect(() => adapter.initialize()).not.toThrow();

    const familyRepo = new SqliteFamilyAdapter(adapter);
    const membersRes = await familyRepo.getMembers(DEFAULT_LOCAL_USER_ID);
    expect(membersRes.success).toBe(true);
    if (membersRes.success) {
      expect(membersRes.value.length).toBeGreaterThanOrEqual(5);
      expect(membersRes.value.some((m) => m.name === 'Ketan Vaghela')).toBe(true);
      expect(membersRes.value.some((m) => m.name === 'Parul Vaghela')).toBe(true);
      expect(membersRes.value.some((m) => m.name === 'Krisha Vaghela')).toBe(true);
      expect(membersRes.value.some((m) => m.name === 'Shamalbhai Vaghela HUF')).toBe(true);
      expect(membersRes.value.some((m) => m.name === 'Ramilaben Vaghela')).toBe(true);
    }
  });

  it('TC-10-03B: executes synchronous CRUD and persists state across adapter restarts', async () => {
    const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertId: 101 });
    const mockConnection: TauriRawDatabaseConnection = {
      execute: mockExecute,
      select: vi.fn().mockResolvedValue([]),
    };

    const adapter = new TauriSqliteAdapter(mockConnection);
    adapter.initialize();

    const holdingRepo = new SqliteHoldingAdapter(adapter);
    const createRes = await holdingRepo.createHoldingWithAsset({
      userId: DEFAULT_LOCAL_USER_ID,
      name: 'HDFC Bank Ltd',
      ticker: 'HDFCBANK',
      isin: 'INE040A01034',
      assetClassId: 'equity',
      quantity: 50,
      unitCostCents: 160000,
      currentValueCents: 8500000,
      currency: 'INR',
      memberId: 'mem-self',
      accountId: 'acc-zerodha',
    });

    expect(createRes.success).toBe(true);

    // Instantiate a brand new adapter instance to simulate app restart
    const restartedAdapter = new TauriSqliteAdapter();
    const restartedHoldingRepo = new SqliteHoldingAdapter(restartedAdapter);
    const listRes = await restartedHoldingRepo.listDetailsByUser(DEFAULT_LOCAL_USER_ID);

    expect(listRes.success).toBe(true);
    if (listRes.success) {
      const hdfc = listRes.value.find((h) => h.ticker === 'HDFCBANK');
      expect(hdfc).toBeDefined();
      expect(hdfc?.currentValueCents).toBe(8500000);
    }

    // Verify transactions, liabilities, and goals also work offline
    const txRepo = new SqliteTransactionAdapter(restartedAdapter);
    const txRes = await txRepo.listByUser(DEFAULT_LOCAL_USER_ID);
    expect(txRes.success).toBe(true);

    const liaRepo = new SqliteLiabilityAdapter(restartedAdapter);
    const liaRes = await liaRepo.listLiabilitiesByUser(DEFAULT_LOCAL_USER_ID);
    expect(liaRes.success).toBe(true);

    const goalRepo = new SqliteGoalAdapter(restartedAdapter);
    const goalRes = await goalRepo.listGoalsByUser(DEFAULT_LOCAL_USER_ID);
    expect(goalRes.success).toBe(true);
  });

  it('TC-10-03C: executes native async commands via executeAsync and selectAsync', async () => {
    const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 2, lastInsertId: 42 });
    const mockSelect = vi
      .fn()
      .mockResolvedValue([{ id: 'h-1', name: 'HDFC Bank', current_value_cents: 500000 }]);

    const mockConnection: TauriRawDatabaseConnection = {
      execute: mockExecute,
      select: mockSelect,
    };

    const adapter = new TauriSqliteAdapter(mockConnection);

    const execRes = await adapter.executeAsync('DELETE FROM holdings WHERE id = ?', ['h-old']);
    expect(mockExecute).toHaveBeenCalledWith('DELETE FROM holdings WHERE id = ?', ['h-old']);
    expect(execRes.changes).toBe(2);
    expect(execRes.lastInsertRowid).toBe(42);

    const selectRes = await adapter.selectAsync<{ id: string; name: string }>(
      'SELECT id, name FROM holdings WHERE user_id = ?',
      ['usr-1']
    );
    expect(mockSelect).toHaveBeenCalledWith(
      'SELECT id, name FROM holdings WHERE user_id = ?',
      ['usr-1']
    );
    expect(selectRes).toHaveLength(1);
    expect(selectRes[0]?.name).toBe('HDFC Bank');
  });

  it('TC-10-03D: handles adapter safely when rawConnection is omitted (in-memory mode)', async () => {
    const adapter = new TauriSqliteAdapter(undefined, { persistToStorage: false });

    expect(() => adapter.exec('CREATE TABLE test (id INT)')).not.toThrow();

    const execRes = await adapter.executeAsync('INSERT INTO test VALUES (1)');
    expect(execRes.changes).toBe(0);

    const selectRes = await adapter.selectAsync('SELECT * FROM test');
    expect(selectRes).toEqual([]);
  });
});
