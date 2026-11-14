/**
 * WealthNest — Centralized Server & Connection Configuration
 * Supports Local Development, LAN Development (Wi-Fi), and Remote / Production.
 */
import { isTauri } from '../tauri/tauri-runtime';

export type ConnectionMode = 'local' | 'lan' | 'remote';

export interface ServerConfig {
  version: 1;
  mode: ConnectionMode;
  host: string;
  frontendPort: number;
  supabasePort: number;
  customSupabaseUrl?: string;
  supabaseAnonKey: string;
  lastConnectedAt?: string;
}

export const SERVER_CONFIG_STORAGE_KEY = 'wealthnest_server_config_v1';

export const DEFAULT_LOCAL_HOST = '127.0.0.1';
export const DEFAULT_LAN_HOST = '192.168.1.105';
export const DEFAULT_FRONTEND_PORT = 30000;
export const DEFAULT_SUPABASE_PORT = 54321;

export const LOCAL_DEMO_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export const DEFAULT_SUPABASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL?.trim()) || undefined;

// Standard Supabase local development anon key (supports legacy anon key and new publishable key)
export const DEFAULT_SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim() ||
      import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim())) ||
  LOCAL_DEMO_ANON_KEY;

/**
 * Returns true when a valid remote Supabase URL was supplied at build time.
 */
export function hasConfiguredRemoteBackend(): boolean {
  return Boolean(DEFAULT_SUPABASE_URL && isValidHttpUrl(DEFAULT_SUPABASE_URL));
}

/**
 * Detects server-only Supabase secret keys (sb_secret_* or service_role JWTs)
 * so client configuration forms reject privileged keys before saving.
 */
export function isSecretApiKey(apiKey: string): boolean {
  const trimmed = apiKey.trim();
  if (!trimmed) return false;
  if (/^sb_secret_/i.test(trimmed)) return true;

  const parts = trimmed.split('.');
  const payloadPart = parts[1];
  if (parts.length !== 3 || !payloadPart || typeof atob !== 'function') return false;
  try {
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

const isTestEnv = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  version: 1,
  mode: !isTestEnv && DEFAULT_SUPABASE_URL ? 'remote' : 'lan',
  host: DEFAULT_LAN_HOST,
  frontendPort: DEFAULT_FRONTEND_PORT,
  supabasePort: DEFAULT_SUPABASE_PORT,
  customSupabaseUrl: !isTestEnv ? DEFAULT_SUPABASE_URL : undefined,
  supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY,
};

/**
 * Validates strictly formatted IPv4 addresses (4 octets, 0..255).
 * Rejects empty, incomplete, out-of-range, and alphanumeric strings.
 */
export function isValidIPv4(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 4) return false;

  for (const part of parts) {
    if (!/^\d+$/.test(part)) return false;
    // Check leading zeros for multi-digit numbers (e.g., "01" is invalid)
    if (part.length > 1 && part.startsWith('0')) return false;
    const num = Number(part);
    if (num < 0 || num > 255) return false;
  }
  return true;
}

/**
 * Validates TCP port number (1..65535).
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Validates HTTP/HTTPS URLs. Rejects non-HTTP protocols (e.g., ftp:, javascript:).
 */
export function isValidHttpUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Derives the active Supabase API URL based on connection mode and configuration.
 */
export function buildSupabaseUrl(config: ServerConfig): string {
  if (config.mode === 'remote') {
    if (config.customSupabaseUrl && isValidHttpUrl(config.customSupabaseUrl)) {
      return config.customSupabaseUrl.trim().replace(/\/+$/, '');
    }
    if (DEFAULT_SUPABASE_URL && isValidHttpUrl(DEFAULT_SUPABASE_URL)) {
      return DEFAULT_SUPABASE_URL.trim().replace(/\/+$/, '');
    }
    return `http://${DEFAULT_LOCAL_HOST}:${DEFAULT_SUPABASE_PORT}`;
  }

  if (config.mode === 'lan') {
    const isTest = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';

    // If running on HTTPS (production/cloud edge) where HTTP LAN is blocked by browser Mixed Content policy,
    // route directly to configured remote endpoint if available
    if (!isTest && typeof window !== 'undefined' && window.location.protocol === 'https:') {
      if (DEFAULT_SUPABASE_URL && isValidHttpUrl(DEFAULT_SUPABASE_URL)) {
        return DEFAULT_SUPABASE_URL.trim().replace(/\/+$/, '');
      }
    }

    // If accessed via localhost / 127.0.0.1 and host is the default template IP (192.168.1.105),
    // route directly to 127.0.0.1 to avoid network timeout on developer machine (bypassed in vitest)
    if (
      !isTest &&
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      config.host === DEFAULT_LAN_HOST
    ) {
      const port = isValidPort(config.supabasePort) ? config.supabasePort : DEFAULT_SUPABASE_PORT;
      return `http://${DEFAULT_LOCAL_HOST}:${port}`;
    }
    const host = isValidIPv4(config.host) ? config.host.trim() : DEFAULT_LAN_HOST;
    const port = isValidPort(config.supabasePort) ? config.supabasePort : DEFAULT_SUPABASE_PORT;
    return `http://${host}:${port}`;
  }

  // mode === 'local'
  const port = isValidPort(config.supabasePort) ? config.supabasePort : DEFAULT_SUPABASE_PORT;
  return `http://${DEFAULT_LOCAL_HOST}:${port}`;
}

/**
 * Derives the expected frontend URL for development / LAN verification.
 */
export function buildFrontendUrl(config: ServerConfig): string {
  const port = isValidPort(config.frontendPort) ? config.frontendPort : DEFAULT_FRONTEND_PORT;
  if (config.mode === 'lan') {
    const host = isValidIPv4(config.host) ? config.host.trim() : DEFAULT_LAN_HOST;
    return `http://${host}:${port}`;
  }
  return `http://${DEFAULT_LOCAL_HOST}:${port}`;
}

/**
 * Safely loads server connection configuration from persistent storage (localStorage),
 * falling back to default configuration when absent or invalid.
 */
export function loadServerConfig(): ServerConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_SERVER_CONFIG };
  }

  try {
    const raw = window.localStorage.getItem(SERVER_CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SERVER_CONFIG };

    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1) {
      const isTest = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';
      let mode: ConnectionMode =
        parsed.mode === 'lan' || parsed.mode === 'remote' ? parsed.mode : 'local';
      let customUrl =
        typeof parsed.customSupabaseUrl === 'string' && parsed.customSupabaseUrl.trim()
          ? parsed.customSupabaseUrl.trim()
          : undefined;
      const rawSavedKey =
        typeof parsed.supabaseAnonKey === 'string' ? parsed.supabaseAnonKey.trim() : '';

      const shouldUpgradeToRemoteOnHttps =
        !isTest &&
        typeof window !== 'undefined' &&
        window.location.protocol === 'https:' &&
        mode !== 'remote' &&
        Boolean(customUrl || hasConfiguredRemoteBackend());

      const isStalePlaceholderLanConfig =
        mode === 'lan' &&
        parsed.host === DEFAULT_LAN_HOST &&
        (!parsed.lastConnectedAt || rawSavedKey === LOCAL_DEMO_ANON_KEY);

      const shouldUpgradeToRemoteOnTauri =
        !isTest && isTauri() && hasConfiguredRemoteBackend() && isStalePlaceholderLanConfig;

      if (shouldUpgradeToRemoteOnHttps || shouldUpgradeToRemoteOnTauri) {
        mode = 'remote';
        customUrl = customUrl || DEFAULT_SUPABASE_URL;
      }

      const shouldUpgradeDemoKey =
        (shouldUpgradeToRemoteOnHttps || shouldUpgradeToRemoteOnTauri) &&
        (!rawSavedKey || rawSavedKey === LOCAL_DEMO_ANON_KEY) &&
        DEFAULT_SUPABASE_ANON_KEY !== LOCAL_DEMO_ANON_KEY;

      return {
        version: 1,
        mode,
        host: typeof parsed.host === 'string' ? parsed.host : DEFAULT_LOCAL_HOST,
        frontendPort: isValidPort(parsed.frontendPort)
          ? parsed.frontendPort
          : DEFAULT_FRONTEND_PORT,
        supabasePort: isValidPort(parsed.supabasePort)
          ? parsed.supabasePort
          : DEFAULT_SUPABASE_PORT,
        customSupabaseUrl: customUrl,
        supabaseAnonKey: shouldUpgradeDemoKey
          ? DEFAULT_SUPABASE_ANON_KEY
          : rawSavedKey || DEFAULT_SUPABASE_ANON_KEY,
        lastConnectedAt:
          typeof parsed.lastConnectedAt === 'string' ? parsed.lastConnectedAt : undefined,
      };
    }
  } catch {
    // Ignore corrupted local storage
  }

  return { ...DEFAULT_SERVER_CONFIG };
}

/**
 * Persists server configuration to persistent storage.
 */
export function saveServerConfig(config: ServerConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SERVER_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Resets server configuration to default LAN values (192.168.1.105:5174 / 54321).
 */
export function resetServerConfig(): ServerConfig {
  const defaults = { ...DEFAULT_SERVER_CONFIG };
  saveServerConfig(defaults);
  return defaults;
}
