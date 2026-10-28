import { describe, it, expect, vi } from 'vitest';
import {
  TauriSqliteAdapter,
  TauriRawDatabaseConnection,
} from '../lib/tauri/tauri-sqlite-adapter';

describe('Phase 10: Tauri 2 SQLite Database Adapter', () => {
  it('TC-10-03A: instantiates adapter and executes schema initialization', () => {
    const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 0, lastInsertId: 0 });
    const mockSelect = vi.fn().mockResolvedValue([]);

    const mockConnection: TauriRawDatabaseConnection = {
      execute: mockExecute,
      select: mockSelect,
    };

    const adapter = new TauriSqliteAdapter(mockConnection);
    expect(adapter).toBeDefined();

    // Call initialize to verify schema generation runs without error
    expect(() => adapter.initialize()).not.toThrow();
  });

  it('TC-10-03B: executes synchronous statement prepare, run, and all', () => {
    const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertId: 101 });
    const mockConnection: TauriRawDatabaseConnection = {
      execute: mockExecute,
      select: vi.fn().mockResolvedValue([]),
    };

    const adapter = new TauriSqliteAdapter(mockConnection);
    const stmt = adapter.prepare('INSERT INTO assets (id, user_id, name) VALUES (?, ?, ?)');

    const result = stmt.run('ast-1', 'usr-1', 'Reliance Industries');
    expect(result.changes).toBe(1);
    expect(result.lastInsertRowid).toBeDefined();

    const selectStmt = adapter.prepare<{ id: string; name: string }>(
      'SELECT id, name FROM assets'
    );
    const rows = selectStmt.all();
    expect(Array.isArray(rows)).toBe(true);

    const first = selectStmt.get();
    expect(first).toBeUndefined(); // Empty memory store
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
    const adapter = new TauriSqliteAdapter();

    expect(() => adapter.exec('CREATE TABLE test (id INT)')).not.toThrow();

    const execRes = await adapter.executeAsync('INSERT INTO test VALUES (1)');
    expect(execRes.changes).toBe(0);

    const selectRes = await adapter.selectAsync('SELECT * FROM test');
    expect(selectRes).toEqual([]);
  });
});
