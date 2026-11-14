import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  ConnectionMode,
  ServerConfig,
  DEFAULT_LAN_HOST,
  DEFAULT_LOCAL_HOST,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_PORT,
  LOCAL_DEMO_ANON_KEY,
  hasConfiguredRemoteBackend,
} from '@/lib/config/server-config';
import { connectionManager } from '@/lib/services/connection-manager';
import { isTauri, isTauriMobile, isMobileUserAgent } from '@/lib/tauri/tauri-runtime';
import { BackendConnectionModal } from '@/components/auth/BackendConnectionModal';

export function isNetworkFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes('Failed to fetch') ||
    err.message.includes('NetworkError') ||
    err.message.includes('Load failed') ||
    err.name === 'TypeError'
  );
}

export function shouldAutoHealLanConfig(config: ServerConfig, isHttps: boolean): boolean {
  if (!hasConfiguredRemoteBackend()) return false;
  if (isHttps && config.mode === 'lan') return true;
  if (
    isTauri() &&
    config.mode === 'lan' &&
    config.host === DEFAULT_LAN_HOST &&
    (!config.lastConnectedAt || config.supabaseAnonKey === LOCAL_DEMO_ANON_KEY)
  ) {
    return true;
  }
  return false;
}

export function formatBackendUnreachableMessage(options: {
  activeUrl: string;
  activeMode: ConnectionMode;
  hasConfiguredRemote: boolean;
  isMobile: boolean;
  isHttps: boolean;
}): string {
  const { activeUrl, activeMode, hasConfiguredRemote, isMobile, isHttps } = options;
  if (hasConfiguredRemote && activeMode !== 'remote') {
    return `Cannot reach backend at ${activeUrl}. Switch to Cloud Supabase or tap "Configure" to set your server endpoint.`;
  }
  if (isMobile || isHttps) {
    return `Cannot reach backend at ${activeUrl}. Tap "Configure" to update your Cloud Supabase URL or host LAN IP.`;
  }
  return `Cannot reach backend at ${activeUrl}. Verify Supabase is running, switch to Local (127.0.0.1), or tap "Configure".`;
}

export interface AuthBackendConnectionState {
  activeUrl: string;
  activeMode: ConnectionMode;
  isHttps: boolean;
  isMobile: boolean;
  hasConfiguredRemote: boolean;
  connectionSwitched: boolean;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  switchToConfiguredRemote: () => Promise<{ ok: boolean; error?: string }>;
  switchToLocal: () => Promise<void>;
  markSwitched: (url: string) => void;
}

export function useAuthBackendConnection(): AuthBackendConnectionState {
  const [activeUrl, setActiveUrl] = useState(() => connectionManager.getSupabaseUrl());
  const [activeMode, setActiveMode] = useState<ConnectionMode>(
    () => connectionManager.getConfig().mode
  );
  const [connectionSwitched, setConnectionSwitched] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const isMobile = isTauriMobile() || isMobileUserAgent();
  const hasConfiguredRemote = hasConfiguredRemoteBackend();

  const switchToConfiguredRemote = useCallback(async () => {
    if (!DEFAULT_SUPABASE_URL) {
      return {
        ok: false,
        error:
          'Remote Supabase endpoint is not baked into this build. Tap "Configure" to enter your Cloud Supabase URL and Publishable/Anon key.',
      };
    }

    const res = await connectionManager.switchServer({
      mode: 'remote',
      customSupabaseUrl: DEFAULT_SUPABASE_URL,
      supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY,
    });
    if (!res.success) {
      return { ok: false, error: res.message };
    }
    setActiveUrl(res.url);
    setActiveMode('remote');
    setConnectionSwitched(true);
    return { ok: true };
  }, []);

  const switchToLocal = useCallback(async () => {
    const res = await connectionManager.switchServer({
      mode: 'local',
      host: DEFAULT_LOCAL_HOST,
      supabasePort: DEFAULT_SUPABASE_PORT,
    });
    setActiveUrl(res.url);
    setActiveMode('local');
    setConnectionSwitched(true);
  }, []);

  const markSwitched = useCallback((url: string) => {
    setActiveUrl(url);
    setActiveMode(connectionManager.getConfig().mode);
    setConnectionSwitched(true);
  }, []);

  useEffect(() => {
    const unsub = connectionManager.subscribeConfig((cfg) => {
      setActiveUrl(connectionManager.getSupabaseUrl());
      setActiveMode(cfg.mode);
    });

    const isTest = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';
    if (!isTest && shouldAutoHealLanConfig(connectionManager.getConfig(), isHttps)) {
      void switchToConfiguredRemote();
    }

    return () => unsub();
  }, [isHttps, switchToConfiguredRemote]);

  return {
    activeUrl,
    activeMode,
    isHttps,
    isMobile,
    hasConfiguredRemote,
    connectionSwitched,
    isModalOpen,
    openModal: () => setIsModalOpen(true),
    closeModal: () => setIsModalOpen(false),
    switchToConfiguredRemote,
    switchToLocal,
    markSwitched,
  };
}

interface AuthBackendRecoveryActionsProps {
  backend: AuthBackendConnectionState;
  onErrorClear: () => void;
  onError: (msg: string) => void;
}

export function AuthBackendRecoveryActions({
  backend,
  onErrorClear,
  onError,
}: AuthBackendRecoveryActionsProps) {
  const showCloudQuickSwitch = backend.hasConfiguredRemote && backend.activeMode !== 'remote';
  const showLocalQuickSwitch = !backend.isHttps && !backend.isMobile && backend.activeMode !== 'local';

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      {showCloudQuickSwitch && (
        <button
          type="button"
          onClick={async () => {
            const res = await backend.switchToConfiguredRemote();
            if (res.ok) {
              onErrorClear();
            } else if (res.error) {
              onError(res.error);
            }
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-medium transition-colors text-[11px] border border-slate-700"
        >
          <RotateCcw className="w-3 h-3" />
          Switch to QA Cloud (Supabase)
        </button>
      )}

      {!showCloudQuickSwitch && showLocalQuickSwitch && (
        <button
          type="button"
          onClick={async () => {
            await backend.switchToLocal();
            onErrorClear();
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-medium transition-colors text-[11px] border border-slate-700"
        >
          <RotateCcw className="w-3 h-3" />
          Switch to Local Server (127.0.0.1:54321)
        </button>
      )}

      <button
        type="button"
        onClick={backend.openModal}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors text-[11px] border border-slate-700"
      >
        <SlidersHorizontal className="w-3 h-3" />
        Configure Backend
      </button>
    </div>
  );
}

interface AuthBackendStatusBarProps {
  backend: AuthBackendConnectionState;
  onSwitched?: (nextUrl: string) => void;
}

export function AuthBackendStatusBar({ backend, onSwitched }: AuthBackendStatusBarProps) {
  const isUnconfiguredPlaceholder =
    backend.activeMode === 'lan' &&
    backend.activeUrl === `http://${DEFAULT_LAN_HOST}:${DEFAULT_SUPABASE_PORT}` &&
    (backend.isMobile || backend.isHttps);

  const showQuickRemote = backend.hasConfiguredRemote && backend.activeMode !== 'remote';
  const showQuickLocal = !showQuickRemote && !backend.isHttps && !backend.isMobile;

  return (
    <>
      <div className="mt-5 pt-4 border-t border-slate-800/60 flex items-center justify-between gap-2 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 truncate min-w-0" title={backend.activeUrl}>
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isUnconfiguredPlaceholder ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
          />
          <span className="truncate">
            Backend:{' '}
            <code className="text-slate-300 font-mono text-[11px]">{backend.activeUrl}</code>
          </span>
        </span>

        <div className="flex items-center gap-2.5 shrink-0">
          {showQuickRemote && (
            <button
              type="button"
              onClick={() => void backend.switchToConfiguredRemote()}
              className="text-emerald-400 hover:text-emerald-300 transition-colors text-xs font-medium"
            >
              Use QA Cloud
            </button>
          )}
          {showQuickLocal && (
            <button
              type="button"
              onClick={() => void backend.switchToLocal()}
              className="text-emerald-400 hover:text-emerald-300 transition-colors text-xs font-medium"
            >
              Use 127.0.0.1
            </button>
          )}
          <button
            type="button"
            onClick={backend.openModal}
            className="text-slate-300 hover:text-white transition-colors text-xs font-medium inline-flex items-center gap-1"
          >
            <SlidersHorizontal className="w-3 h-3" />
            Configure
          </button>
        </div>
      </div>

      {backend.connectionSwitched && (
        <p className="mt-2 text-[11px] text-emerald-400 text-center animate-in fade-in">
          ✓ Switched to {backend.activeUrl}. You can now continue.
        </p>
      )}

      <BackendConnectionModal
        isOpen={backend.isModalOpen}
        onClose={backend.closeModal}
        onSwitched={(nextUrl) => {
          backend.markSwitched(nextUrl);
          onSwitched?.(nextUrl);
        }}
      />
    </>
  );
}
