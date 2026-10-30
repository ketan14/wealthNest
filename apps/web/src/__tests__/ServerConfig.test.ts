import { describe, it, expect, beforeEach } from 'vitest';
import {
  isValidIPv4,
  isValidPort,
  isValidHttpUrl,
  buildSupabaseUrl,
  buildFrontendUrl,
  loadServerConfig,
  saveServerConfig,
  resetServerConfig,
  SERVER_CONFIG_STORAGE_KEY,
  ServerConfig,
} from '../lib/config/server-config';

describe('Phase 10: ServerConfig & LAN Validation Suite', () => {
  beforeEach(() => {
    window.localStorage.removeItem(SERVER_CONFIG_STORAGE_KEY);
  });

  describe('IPv4 Address Validation', () => {
    it('accepts valid private and public IPv4 addresses', () => {
      expect(isValidIPv4('192.168.1.105')).toBe(true);
      expect(isValidIPv4('192.168.0.1')).toBe(true);
      expect(isValidIPv4('10.0.0.5')).toBe(true);
      expect(isValidIPv4('172.16.0.10')).toBe(true);
      expect(isValidIPv4('127.0.0.1')).toBe(true);
      expect(isValidIPv4('255.255.255.255')).toBe(true);
      expect(isValidIPv4('0.0.0.0')).toBe(true);
    });

    it('rejects invalid octets, leading zeros, and malformed strings', () => {
      expect(isValidIPv4('192.168.1.999')).toBe(false); // Octet > 255
      expect(isValidIPv4('192.168.1.-1')).toBe(false); // Negative
      expect(isValidIPv4('192.168.1')).toBe(false); // Incomplete
      expect(isValidIPv4('192.168.1.105.1')).toBe(false); // 5 octets
      expect(isValidIPv4('192.168.01.1')).toBe(false); // Leading zero in multi-digit
      expect(isValidIPv4('192.168.1.abc')).toBe(false); // Alphanumeric
      expect(isValidIPv4('')).toBe(false); // Empty
      expect(isValidIPv4('localhost')).toBe(false); // Hostname
    });
  });

  describe('Port & URL Validation', () => {
    it('validates TCP port boundaries', () => {
      expect(isValidPort(80)).toBe(true);
      expect(isValidPort(5174)).toBe(true);
      expect(isValidPort(54321)).toBe(true);
      expect(isValidPort(65535)).toBe(true);
      expect(isValidPort(0)).toBe(false);
      expect(isValidPort(-80)).toBe(false);
      expect(isValidPort(65536)).toBe(false);
      expect(isValidPort(NaN)).toBe(false);
    });

    it('validates HTTP/HTTPS URL protocols only', () => {
      expect(isValidHttpUrl('http://192.168.1.105:54321')).toBe(true);
      expect(isValidHttpUrl('https://project.supabase.co')).toBe(true);
      expect(isValidHttpUrl('ftp://example.com')).toBe(false);
      expect(isValidHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isValidHttpUrl('not a url')).toBe(false);
    });
  });

  describe('Endpoint URL Construction', () => {
    it('builds local development URL', () => {
      const config: ServerConfig = {
        version: 1,
        mode: 'local',
        host: '127.0.0.1',
        frontendPort: 5174,
        supabasePort: 54321,
        supabaseAnonKey: 'test-key',
      };
      expect(buildSupabaseUrl(config)).toBe('http://127.0.0.1:54321');
      expect(buildFrontendUrl(config)).toBe('http://127.0.0.1:5174');
    });

    it('builds LAN development URL dynamically from host IP and port', () => {
      const config: ServerConfig = {
        version: 1,
        mode: 'lan',
        host: '192.168.1.110',
        frontendPort: 5174,
        supabasePort: 54321,
        supabaseAnonKey: 'test-key',
      };
      expect(buildSupabaseUrl(config)).toBe('http://192.168.1.110:54321');
      expect(buildFrontendUrl(config)).toBe('http://192.168.1.110:5174');
    });

    it('builds remote production URL', () => {
      const config: ServerConfig = {
        version: 1,
        mode: 'remote',
        host: 'custom',
        frontendPort: 443,
        supabasePort: 443,
        customSupabaseUrl: 'https://xyz123.supabase.co',
        supabaseAnonKey: 'test-key',
      };
      expect(buildSupabaseUrl(config)).toBe('https://xyz123.supabase.co');
    });
  });

  describe('Configuration Persistence & Defaults', () => {
    it('loads default LAN config (192.168.1.105:30000 / 54321) when localStorage is empty', () => {
      const loaded = loadServerConfig();
      expect(loaded.mode).toBe('lan');
      expect(loaded.host).toBe('192.168.1.105');
      expect(loaded.frontendPort).toBe(30000);
      expect(loaded.supabasePort).toBe(54321);
      expect(loaded.version).toBe(1);
    });

    it('persists and restores updated LAN configuration', () => {
      const custom: ServerConfig = {
        version: 1,
        mode: 'lan',
        host: '192.168.1.200',
        frontendPort: 5174,
        supabasePort: 54321,
        supabaseAnonKey: 'custom-anon-key',
        lastConnectedAt: '2026-10-30T10:00:00Z',
      };

      saveServerConfig(custom);
      const restored = loadServerConfig();
      expect(restored.mode).toBe('lan');
      expect(restored.host).toBe('192.168.1.200');
      expect(restored.supabaseAnonKey).toBe('custom-anon-key');
    });

    it('resets configuration back to defaults safely', () => {
      saveServerConfig({
        version: 1,
        mode: 'lan',
        host: '192.168.1.99',
        frontendPort: 9000,
        supabasePort: 9001,
        supabaseAnonKey: 'custom',
      });

      const reset = resetServerConfig();
      expect(reset.mode).toBe('lan');
      expect(reset.host).toBe('192.168.1.105');
      expect(loadServerConfig().mode).toBe('lan');
    });
  });
});
