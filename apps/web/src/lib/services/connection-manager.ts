import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ServerConfig,
  buildSupabaseUrl,
  loadServerConfig,
  saveServerConfig,
  resetServerConfig,
  isValidIPv4,
  isValidPort,
  isValidHttpUrl,
} from '../config/server-config';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface ConnectionTestResult {
  success: boolean;
  status: ConnectionStatus;
  message: string;
  url: string;
  latencyMs?: number;
  troubleshooting?: string[];
}

export type ConfigChangeListener = (config: ServerConfig) => void;
export type StatusChangeListener = (status: ConnectionStatus) => void;

/**
 * Singleton ConnectionManager that coordinates dynamic Supabase client
 * lifecycle, server endpoint switching, and connectivity health probes.
 */
export class ConnectionManager {
  private static instance: ConnectionManager;
  private currentConfig: ServerConfig;
  private clientInstance: SupabaseClient | null = null;
  private currentStatus: ConnectionStatus = 'disconnected';
  private configListeners = new Set<ConfigChangeListener>();
  private statusListeners = new Set<StatusChangeListener>();

  private constructor() {
    this.currentConfig = loadServerConfig();
  }

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  public getConfig(): ServerConfig {
    return { ...this.currentConfig };
  }

  public getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  public getSupabaseUrl(): string {
    return buildSupabaseUrl(this.currentConfig);
  }

  /**
   * Retrieves or lazily instantiates the active SupabaseClient.
   */
  public getClient(): SupabaseClient {
    if (!this.clientInstance) {
      this.clientInstance = this.createClientInstance(this.currentConfig);
    }
    return this.clientInstance;
  }

  private createClientInstance(config: ServerConfig): SupabaseClient {
    const url = buildSupabaseUrl(config);
    return createClient(url, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  /**
   * Tests connectivity against a target Supabase API endpoint without
   * modifying active application state.
   */
  public async testConnection(
    candidateConfig?: Partial<ServerConfig>
  ): Promise<ConnectionTestResult> {
    const configToTest: ServerConfig = {
      ...this.currentConfig,
      ...candidateConfig,
    };

    if (configToTest.mode === 'lan' && !isValidIPv4(configToTest.host)) {
      return {
        success: false,
        status: 'error',
        url: buildSupabaseUrl(configToTest),
        message: 'Invalid IPv4 address format. Expected format: 192.168.1.105 (octets 0-255).',
      };
    }

    if (!isValidPort(configToTest.supabasePort)) {
      return {
        success: false,
        status: 'error',
        url: buildSupabaseUrl(configToTest),
        message: 'Invalid Supabase API port. Port must be an integer between 1 and 65535.',
      };
    }

    if (configToTest.mode === 'remote') {
      if (!configToTest.customSupabaseUrl || !isValidHttpUrl(configToTest.customSupabaseUrl)) {
        return {
          success: false,
          status: 'error',
          url: configToTest.customSupabaseUrl || '',
          message: 'Invalid Remote Supabase URL. Must be a valid HTTP or HTTPS address.',
        };
      }
    }

    const targetUrl = buildSupabaseUrl(configToTest);
    const healthEndpoint = `${targetUrl}/auth/v1/health`;
    const startTime = performance.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    try {
      const response = await fetch(healthEndpoint, {
        method: 'GET',
        headers: {
          apikey: configToTest.supabaseAnonKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - startTime);

      // Supabase /auth/v1/health responds with 200 {"version":...}
      if (response.ok || response.status === 200) {
        return {
          success: true,
          status: 'connected',
          url: targetUrl,
          latencyMs,
          message: `Connected successfully to Supabase API (${latencyMs}ms).`,
        };
      }

      // If auth health endpoint returned 401/403, server is alive but apikey may be invalid
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          status: 'error',
          url: targetUrl,
          latencyMs,
          message: `Server reached at ${targetUrl}, but returned authentication error (${response.status}). Verify your Supabase Anon Key.`,
        };
      }

      return {
        success: false,
        status: 'error',
        url: targetUrl,
        latencyMs,
        message: `Server reached at ${targetUrl}, but responded with HTTP ${response.status}.`,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = (err as Error)?.name === 'AbortError';

      const troubleshooting = [
        'Ensure the host machine is running and connected to the same Wi-Fi network.',
        'Verify Supabase is running (run "supabase status" on the host).',
        'Check that Windows Firewall allows inbound connections on port ' + configToTest.supabasePort + '.',
        'If running inside WSL2, verify port forwarding rule: "netsh interface portproxy add v4tov4 ...".',
        'Verify the configured IPv4 address matches your host machine current Wi-Fi IP (ipconfig).',
      ];

      return {
        success: false,
        status: 'error',
        url: targetUrl,
        message: isAbort
          ? `Connection timed out after 4.5 seconds reaching ${targetUrl}.`
          : `Unable to reach server at ${targetUrl}. (${(err as Error)?.message || 'Network unreachable'})`,
        troubleshooting,
      };
    }
  }

  /**
   * Applies and persists a new server configuration, safely reinitializing
   * the active Supabase client.
   */
  public async switchServer(
    newConfig: Partial<ServerConfig>,
    options?: { testFirst?: boolean }
  ): Promise<ConnectionTestResult> {
    const updated: ServerConfig = {
      ...this.currentConfig,
      ...newConfig,
    };

    if (options?.testFirst) {
      const testRes = await this.testConnection(updated);
      if (!testRes.success) {
        return testRes;
      }
    }

    const previousUrl = buildSupabaseUrl(this.currentConfig);
    const nextUrl = buildSupabaseUrl(updated);
    const isProjectChanging = previousUrl !== nextUrl;

    this.setStatus('connecting');

    // If changing projects, sign out of previous project instance to avoid stale cross-project tokens
    if (isProjectChanging && this.clientInstance) {
      try {
        await this.clientInstance.auth.signOut();
      } catch {
        // ignore signout errors on unreachable old server
      }
    }

    updated.lastConnectedAt = new Date().toISOString();
    this.currentConfig = updated;
    saveServerConfig(updated);

    // Reinitialize Supabase client instance with the new URL and Anon Key
    this.clientInstance = this.createClientInstance(updated);
    this.setStatus('connected');

    this.notifyConfigListeners();
    return {
      success: true,
      status: 'connected',
      url: nextUrl,
      message: `Reconnected successfully to ${nextUrl}.`,
    };
  }

  /**
   * Resets connection configuration to default local settings.
   */
  public async resetToDefaults(): Promise<void> {
    const defaults = resetServerConfig();
    this.currentConfig = defaults;
    this.clientInstance = this.createClientInstance(defaults);
    this.setStatus('connected');
    this.notifyConfigListeners();
  }

  public subscribeConfig(listener: ConfigChangeListener): () => void {
    this.configListeners.add(listener);
    return () => this.configListeners.delete(listener);
  }

  public subscribeStatus(listener: StatusChangeListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: ConnectionStatus): void {
    this.currentStatus = status;
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch {
        // ignore listener errors
      }
    }
  }

  private notifyConfigListeners(): void {
    for (const listener of this.configListeners) {
      try {
        listener({ ...this.currentConfig });
      } catch {
        // ignore listener errors
      }
    }
  }
}

export const connectionManager = ConnectionManager.getInstance();

