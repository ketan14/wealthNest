import React, { useState, useEffect } from 'react';
import {
  Server,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Radio,
} from 'lucide-react';
import {
  ServerConfig,
  ConnectionMode,
  DEFAULT_LAN_HOST,
  DEFAULT_LOCAL_HOST,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
  LOCAL_DEMO_ANON_KEY,
  buildSupabaseUrl,
  isValidIPv4,
  isValidPort,
  isValidHttpUrl,
  isSecretApiKey,
  hasConfiguredRemoteBackend,
} from '@/lib/config/server-config';
import { connectionManager, ConnectionTestResult } from '@/lib/services/connection-manager';
import { Button } from '@/components/ui/Button';
import { ServerModeSelector } from '@/components/settings/ServerModeSelector';

interface BackendConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitched?: (nextUrl: string) => void;
}

/**
 * Unauthenticated backend endpoint configuration dialog for Login and Sign Up screens.
 * Enables mobile/desktop users to point the client to QA/Cloud Supabase or a LAN host
 * before signing in.
 */
export function BackendConnectionModal({
  isOpen,
  onClose,
  onSwitched,
}: BackendConnectionModalProps) {
  const [draftConfig, setDraftConfig] = useState<ServerConfig>(() => connectionManager.getConfig());
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isHttpsOrigin = typeof window !== 'undefined' && window.location.protocol === 'https:';

  useEffect(() => {
    if (!isOpen) return;
    setDraftConfig(connectionManager.getConfig());
    setTestResult(null);
    setSaveError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const targetUrl = buildSupabaseUrl(draftConfig);
  const hasSecretKey = isSecretApiKey(draftConfig.supabaseAnonKey);
  const isLanValid =
    draftConfig.mode !== 'lan' ||
    (isValidIPv4(draftConfig.host) && isValidPort(draftConfig.supabasePort));
  const isLocalValid = draftConfig.mode !== 'local' || isValidPort(draftConfig.supabasePort);
  const isRemoteValid =
    draftConfig.mode !== 'remote' ||
    (isValidHttpUrl(draftConfig.customSupabaseUrl || '') &&
      !(isHttpsOrigin && (draftConfig.customSupabaseUrl || '').trim().startsWith('http://')) &&
      draftConfig.supabaseAnonKey.trim().length > 0);
  const isHttpBlockedOnHttps = isHttpsOrigin && targetUrl.startsWith('http://');
  const isFormValid =
    !hasSecretKey && !isHttpBlockedOnHttps && isLanValid && isLocalValid && isRemoteValid;

  const handleModeChange = (newMode: ConnectionMode) => {
    setTestResult(null);
    setSaveError(null);
    setDraftConfig((prev) => {
      if (newMode === 'remote') {
        const nextUrl = prev.customSupabaseUrl || DEFAULT_SUPABASE_URL || '';
        const nextKey =
          prev.supabaseAnonKey === LOCAL_DEMO_ANON_KEY &&
          DEFAULT_SUPABASE_ANON_KEY !== LOCAL_DEMO_ANON_KEY
            ? DEFAULT_SUPABASE_ANON_KEY
            : prev.supabaseAnonKey;
        return {
          ...prev,
          mode: 'remote',
          customSupabaseUrl: nextUrl,
          supabaseAnonKey: nextKey,
        };
      }

      if (newMode === 'local') {
        return {
          ...prev,
          mode: 'local',
          host: DEFAULT_LOCAL_HOST,
        };
      }

      return {
        ...prev,
        mode: 'lan',
        host: prev.host === DEFAULT_LOCAL_HOST ? DEFAULT_LAN_HOST : prev.host,
      };
    });
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setSaveError(null);
    try {
      const res = await connectionManager.testConnection(draftConfig);
      setTestResult(res);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setTestResult(null);

    if (!isFormValid) return;

    setIsSaving(true);
    try {
      const res = await connectionManager.switchServer(draftConfig);
      if (!res.success) {
        setSaveError(res.message);
        return;
      }
      onSwitched?.(res.url);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backend-config-title"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-emerald-400" />
            <h3 id="backend-config-title" className="font-bold text-white text-base">
              Configure Backend Server
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close backend configuration"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 space-y-5">
          <ServerModeSelector mode={draftConfig.mode} onModeChange={handleModeChange} />

          {isHttpBlockedOnHttps && (
            <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This page is loaded over HTTPS. Switch to Remote / Production and enter an{' '}
                <code className="font-mono">https://</code> Supabase URL.
              </span>
            </div>
          )}

          {draftConfig.mode === 'remote' && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="auth-remote-url"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Supabase Project URL
                  </label>
                  {hasConfiguredRemoteBackend() &&
                    draftConfig.customSupabaseUrl !== DEFAULT_SUPABASE_URL && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            customSupabaseUrl: DEFAULT_SUPABASE_URL,
                            supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY,
                          }))
                        }
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        Use Build Default
                      </button>
                    )}
                </div>
                <input
                  id="auth-remote-url"
                  type="url"
                  value={draftConfig.customSupabaseUrl || ''}
                  onChange={(e) =>
                    setDraftConfig((prev) => ({ ...prev, customSupabaseUrl: e.target.value }))
                  }
                  placeholder="https://your-project.supabase.co"
                  className="w-full h-10 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                />
                {!isValidHttpUrl(draftConfig.customSupabaseUrl || '') &&
                  (draftConfig.customSupabaseUrl || '').length > 0 && (
                    <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Enter a valid HTTPS Supabase project URL.
                    </p>
                  )}
              </div>

              <div>
                <label
                  htmlFor="auth-remote-key"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Supabase Publishable / Anon Key (Public)
                </label>
                <textarea
                  id="auth-remote-key"
                  rows={2}
                  value={draftConfig.supabaseAnonKey}
                  onChange={(e) =>
                    setDraftConfig((prev) => ({ ...prev, supabaseAnonKey: e.target.value }))
                  }
                  placeholder="sb_publishable_... or eyJ..."
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 resize-none"
                />
              </div>
            </div>
          )}

          {draftConfig.mode === 'lan' && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="auth-lan-host"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Host Machine IPv4 Address
                  </label>
                  <input
                    id="auth-lan-host"
                    type="text"
                    value={draftConfig.host}
                    onChange={(e) => setDraftConfig((prev) => ({ ...prev, host: e.target.value }))}
                    placeholder="192.168.1.105"
                    className="w-full h-10 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="auth-lan-port"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Supabase Port
                  </label>
                  <input
                    id="auth-lan-port"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="65535"
                    value={draftConfig.supabasePort}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        supabasePort: Number(e.target.value),
                      }))
                    }
                    className="w-full h-10 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
              {!isValidIPv4(draftConfig.host) && draftConfig.host.length > 0 && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Must be a valid IPv4 address (e.g. 192.168.1.108).
                </p>
              )}
            </div>
          )}

          {draftConfig.mode === 'local' && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <label
                htmlFor="auth-local-port"
                className="block text-xs font-medium text-slate-300"
              >
                Local Supabase API Port (127.0.0.1)
              </label>
              <input
                id="auth-local-port"
                type="number"
                inputMode="numeric"
                min="1"
                max="65535"
                value={draftConfig.supabasePort}
                onChange={(e) =>
                  setDraftConfig((prev) => ({
                    ...prev,
                    supabasePort: Number(e.target.value),
                  }))
                }
                className="w-full h-10 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
              />
              <p className="text-[11px] text-slate-400">
                Local (127.0.0.1) works only on the machine running Supabase (use Remote / Cloud or
                LAN Wi-Fi from a phone).
              </p>
            </div>
          )}

          {hasSecretKey && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Never enter a <code className="font-mono">sb_secret_</code> or{' '}
                <code className="font-mono">service_role</code> key in client settings. Use your
                public Publishable or Anon key.
              </span>
            </div>
          )}

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
            <span className="text-slate-400 block text-[11px]">Target Supabase Endpoint:</span>
            <code className="font-mono text-emerald-400 break-all">{targetUrl}</code>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                testResult.success
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-start gap-2 font-medium">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
              {testResult.troubleshooting && testResult.troubleshooting.length > 0 && (
                <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90 pl-1">
                  {testResult.troubleshooting.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {saveError && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={isTesting || !isFormValid}
              className="border-slate-700 text-slate-200 gap-1.5"
            >
              {isTesting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
              )}
              Test Connection
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving || !isFormValid}
                className="bg-primary hover:bg-emerald-400 text-slate-950 font-bold"
              >
                {isSaving ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Connecting...
                  </span>
                ) : (
                  'Save & Connect'
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
