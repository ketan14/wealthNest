import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { connectionManager } from '../lib/services/connection-manager';
import { SERVER_CONFIG_STORAGE_KEY } from '../lib/config/server-config';

describe('Phase 10: ConnectionManager & Endpoint Switching', () => {
  beforeEach(() => {
    window.localStorage.removeItem(SERVER_CONFIG_STORAGE_KEY);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-LAN-01: initializes with default LAN configuration (192.168.1.105:30000 / 54321) and lazily creates Supabase client', () => {
    const config = connectionManager.getConfig();
    expect(config.mode).toBe('lan');
    expect(config.host).toBe('192.168.1.105');
    expect(config.frontendPort).toBe(30000);
    expect(config.supabasePort).toBe(54321);

    const client = connectionManager.getClient();
    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
    expect(typeof client.auth.getSession).toBe('function');
  });

  it('TC-LAN-02: validates and tests healthy Supabase health endpoint', async () => {
    // Mock global fetch returning 200 OK for /auth/v1/health
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ version: 'v2.15.8' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const testRes = await connectionManager.testConnection({
      mode: 'lan',
      host: '192.168.1.105',
      supabasePort: 54321,
    });

    expect(testRes.success).toBe(true);
    expect(testRes.status).toBe('connected');
    expect(testRes.url).toBe('http://192.168.1.105:54321');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://192.168.1.105:54321/auth/v1/health',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('TC-LAN-03: returns helpful troubleshooting advice when network is unreachable', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const testRes = await connectionManager.testConnection({
      mode: 'lan',
      host: '192.168.1.199',
      supabasePort: 54321,
    });

    expect(testRes.success).toBe(false);
    expect(testRes.status).toBe('error');
    expect(testRes.troubleshooting).toBeDefined();
    expect(testRes.troubleshooting?.length).toBeGreaterThan(0);
    expect(testRes.message).toContain('192.168.1.199:54321');
  });

  it('TC-LAN-04: rejects invalid IPv4 addresses before issuing network request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const testRes = await connectionManager.testConnection({
      mode: 'lan',
      host: '192.168.1.999',
      supabasePort: 54321,
    });

    expect(testRes.success).toBe(false);
    expect(testRes.message).toContain('Invalid IPv4');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('TC-LAN-05: switches server configuration, updates active client, and notifies subscribers', async () => {
    let notifiedConfig = null;
    const unsub = connectionManager.subscribeConfig((cfg) => {
      notifiedConfig = cfg;
    });

    const result = await connectionManager.switchServer({
      mode: 'lan',
      host: '192.168.1.120',
      supabasePort: 54321,
    });

    expect(result.success).toBe(true);
    expect(connectionManager.getConfig().host).toBe('192.168.1.120');
    expect(connectionManager.getSupabaseUrl()).toBe('http://192.168.1.120:54321');
    expect(notifiedConfig).toBeDefined();

    unsub();
  });

  it('TC-LAN-06: resets to default LAN values on resetToDefaults()', async () => {
    await connectionManager.switchServer({
      mode: 'remote',
      customSupabaseUrl: 'https://custom.supabase.co',
    });

    expect(connectionManager.getConfig().mode).toBe('remote');

    await connectionManager.resetToDefaults();
    expect(connectionManager.getConfig().mode).toBe('lan');
    expect(connectionManager.getConfig().host).toBe('192.168.1.105');
    expect(connectionManager.getSupabaseUrl()).toBe('http://192.168.1.105:54321');
  });
});

