import { useState, useEffect } from 'react';
import {
  ServerConfig,
  ConnectionMode,
  buildSupabaseUrl,
  buildFrontendUrl,
  isValidIPv4,
  isValidPort,
  isValidHttpUrl,
} from '@/lib/config/server-config';
import {
  connectionManager,
  ConnectionStatus,
  ConnectionTestResult,
} from '@/lib/services/connection-manager';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import {
  Wifi,
  Server,
  Globe,
  Radio,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Info,
} from 'lucide-react';

export function ServerConnectionSettings() {
  const { user } = useAuth();
  const [config, setConfig] = useState<ServerConfig>(() => connectionManager.getConfig());
  const [status, setStatus] = useState<ConnectionStatus>(() => connectionManager.getStatus());
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [showSwitchWarningModal, setShowSwitchWarningModal] = useState(false);
  const [pendingSaveConfig, setPendingSaveConfig] = useState<ServerConfig | null>(null);

  // Advanced toggles
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const unsubConfig = connectionManager.subscribeConfig((newCfg) => setConfig(newCfg));
    const unsubStatus = connectionManager.subscribeStatus((newStat) => setStatus(newStat));
    return () => {
      unsubConfig();
      unsubStatus();
    };
  }, []);

  const computedSupabaseUrl = buildSupabaseUrl(config);
  const computedFrontendUrl = buildFrontendUrl(config);

  const isLanValid = config.mode !== 'lan' || (isValidIPv4(config.host) && isValidPort(config.supabasePort));
  const isRemoteValid = config.mode !== 'remote' || isValidHttpUrl(config.customSupabaseUrl || '');

  const handleModeChange = (newMode: ConnectionMode) => {
    setConfig((prev) => ({
      ...prev,
      mode: newMode,
      host: newMode === 'local' ? '127.0.0.1' : prev.host === '127.0.0.1' ? '192.168.1.105' : prev.host,
    }));
    setTestResult(null);
    setSaveSuccessMsg(null);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setSaveSuccessMsg(null);
    try {
      const res = await connectionManager.testConnection(config);
      setTestResult(res);
      setStatus(res.status);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndReconnect = async () => {
    setSaveSuccessMsg(null);
    setTestResult(null);

    // If an active authenticated session exists and the backend URL is changing, ask confirmation
    const currentActiveUrl = connectionManager.getSupabaseUrl();
    const targetUrl = buildSupabaseUrl(config);
    if (user && user.id !== 'usr-local-vault' && currentActiveUrl !== targetUrl) {
      setPendingSaveConfig(config);
      setShowSwitchWarningModal(true);
      return;
    }

    await applyNewConfig(config);
  };

  const applyNewConfig = async (cfgToApply: ServerConfig) => {
    setIsSaving(true);
    try {
      const res = await connectionManager.switchServer(cfgToApply);
      if (res.success) {
        setSaveSuccessMsg(res.message);
        setStatus('connected');
        setTimeout(() => setSaveSuccessMsg(null), 5000);
      } else {
        setTestResult(res);
      }
    } finally {
      setIsSaving(false);
      setPendingSaveConfig(null);
      setShowSwitchWarningModal(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (window.confirm('Reset server connection settings back to default LAN settings (192.168.1.105:30000 / 54321)?')) {
      await connectionManager.resetToDefaults();
      setConfig(connectionManager.getConfig());
      setTestResult(null);
      setSaveSuccessMsg('Server configuration reset to default LAN settings (http://192.168.1.105:30000).');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <Card className="border-border/80 bg-card/60 backdrop-blur-md">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Server & Local Network (LAN) Connection</CardTitle>
                <CardDescription>
                  Configure backend IPv4 address for Wi-Fi access from mobile devices without rebuilding.
                </CardDescription>
              </div>
            </div>

            {/* Live Connection Status Badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <Badge
                variant={status === 'connected' ? 'success' : status === 'connecting' ? 'secondary' : 'destructive'}
                className="gap-1.5 py-1 px-3"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    status === 'connected'
                      ? 'bg-emerald-400 animate-pulse'
                      : status === 'connecting'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-rose-400'
                  }`}
                />
                <span className="capitalize font-mono">{status}</span>
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Connection Mode Radio Tabs */}
          <div>
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-2">
              Connection Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleModeChange('local')}
                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                  config.mode === 'local'
                    ? 'border-indigo-500 bg-indigo-500/10 text-foreground ring-1 ring-indigo-500/30'
                    : 'border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                }`}
              >
                <Server className="w-4 h-4 mt-0.5 text-indigo-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Local Development</div>
                  <div className="text-[11px] opacity-80">Development machine (127.0.0.1)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('lan')}
                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                  config.mode === 'lan'
                    ? 'border-emerald-500 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/30'
                    : 'border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                }`}
              >
                <Wifi className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">LAN Development (Wi-Fi)</div>
                  <div className="text-[11px] opacity-80">Access via Phone or Laptop on Wi-Fi</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('remote')}
                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                  config.mode === 'remote'
                    ? 'border-cyan-500 bg-cyan-500/10 text-foreground ring-1 ring-cyan-500/30'
                    : 'border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                }`}
              >
                <Globe className="w-4 h-4 mt-0.5 text-cyan-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Remote / Production</div>
                  <div className="text-[11px] opacity-80">Deployed cloud project (.supabase.co)</div>
                </div>
              </button>
            </div>
          </div>

          {/* Form Fields according to Mode */}
          {config.mode === 'lan' && (
            <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Host IPv4 */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="server-ip-input" className="text-xs font-medium text-foreground flex items-center justify-between">
                    <span>Host Machine IPv4 Address</span>
                    <span className="text-[11px] text-muted-foreground">From Windows "ipconfig"</span>
                  </label>
                  <input
                    id="server-ip-input"
                    type="text"
                    value={config.host}
                    onChange={(e) => setConfig((prev) => ({ ...prev, host: e.target.value }))}
                    placeholder="192.168.1.105"
                    className="w-full h-9 rounded-md bg-background border border-border px-3 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {!isValidIPv4(config.host) && config.host.length > 0 && (
                    <p className="text-[11px] text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Must be a valid IPv4 address (e.g. 192.168.1.105).
                    </p>
                  )}
                </div>

                {/* Supabase Port */}
                <div className="space-y-1.5">
                  <label htmlFor="supabase-port-input" className="text-xs font-medium text-foreground">
                    Supabase API Port
                  </label>
                  <input
                    id="supabase-port-input"
                    type="number"
                    value={config.supabasePort}
                    onChange={(e) => setConfig((prev) => ({ ...prev, supabasePort: Number(e.target.value) }))}
                    placeholder="54321"
                    min="1"
                    max="65535"
                    className="w-full h-9 rounded-md bg-background border border-border px-3 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Frontend Port & Note */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label htmlFor="frontend-port-input" className="text-xs font-medium text-foreground">
                    Frontend Web Port
                  </label>
                  <input
                    id="frontend-port-input"
                    type="number"
                    value={config.frontendPort}
                    onChange={(e) => setConfig((prev) => ({ ...prev, frontendPort: Number(e.target.value) }))}
                    placeholder="30000"
                    min="1"
                    max="65535"
                    className="w-full h-9 rounded-md bg-background border border-border px-3 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[10px] text-muted-foreground">Default: 30000 (Docker Nginx) or 5174/5173</p>
                </div>

                <div className="sm:col-span-2 flex items-center p-3 rounded-lg bg-background/50 border border-border/50 text-[11px] text-muted-foreground leading-relaxed">
                  <Info className="w-4 h-4 text-primary shrink-0 mr-2" />
                  <span>
                    Access the app from your mobile browser at: <strong className="font-mono text-foreground">{computedFrontendUrl}</strong>.
                  </span>
                </div>
              </div>
            </div>
          )}

          {config.mode === 'remote' && (
            <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-3">
              <label htmlFor="remote-url-input" className="text-xs font-medium text-foreground block">
                Remote Supabase Project URL
              </label>
              <input
                id="remote-url-input"
                type="url"
                value={config.customSupabaseUrl || ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, customSupabaseUrl: e.target.value }))}
                placeholder="https://your-project.supabase.co"
                className="w-full h-9 rounded-md bg-background border border-border px-3 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {!isValidHttpUrl(config.customSupabaseUrl || '') && (config.customSupabaseUrl || '').length > 0 && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Must be a valid HTTPS URL (e.g. https://your-project.supabase.co).
                </p>
              )}
            </div>
          )}

          {/* Constructed API Endpoint Preview */}
          <div className="p-3 rounded-lg bg-secondary/40 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="space-y-0.5">
              <span className="text-muted-foreground block text-[11px]">Active Supabase API Endpoint:</span>
              <span className="font-mono text-primary font-medium">{computedSupabaseUrl}</span>
            </div>
            {config.lastConnectedAt && (
              <span className="text-[11px] text-muted-foreground">
                Last checked: {new Date(config.lastConnectedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Advanced Supabase Anon Key Toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>{showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced API Keys'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 p-3.5 rounded-lg bg-secondary/30 border border-border/50 space-y-2 animate-in fade-in">
                <label htmlFor="anon-key-input" className="text-xs font-medium text-foreground block">
                  Supabase Anon Key (Public)
                </label>
                <textarea
                  id="anon-key-input"
                  rows={2}
                  value={config.supabaseAnonKey}
                  onChange={(e) => setConfig((prev) => ({ ...prev, supabaseAnonKey: e.target.value }))}
                  className="w-full rounded-md bg-background border border-border p-2 text-[11px] font-mono text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
                <p className="text-[10px] text-muted-foreground">
                  Never input a service_role secret key here. Only public client anon keys are allowed.
                </p>
              </div>
            )}
          </div>

          {/* Feedback & Troubleshooting Messages */}
          {testResult && (
            <div
              className={`p-3.5 rounded-lg border text-xs space-y-2 ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>

              {testResult.troubleshooting && testResult.troubleshooting.length > 0 && (
                <div className="pt-1 border-t border-rose-500/20">
                  <span className="font-semibold block mb-1 text-[11px]">Troubleshooting Checklist:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90">
                    {testResult.troubleshooting.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {saveSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTesting || !isLanValid || !isRemoteValid}
                className="gap-2 text-xs h-9 border-border hover:bg-secondary"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5 text-primary" />}
                Test Connection
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleSaveAndReconnect}
                disabled={isSaving || !isLanValid || !isRemoteValid}
                className="gap-2 text-xs h-9 bg-primary hover:bg-emerald-400 text-slate-950 font-semibold"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Save & Reconnect
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetToDefaults}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-9"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal when switching servers while authenticated */}
      <ConfirmActionModal
        isOpen={showSwitchWarningModal}
        title="Switch Server Connection?"
        message={`You are currently signed in. Switching backend endpoints to ${
          pendingSaveConfig ? buildSupabaseUrl(pendingSaveConfig) : ''
        } will reconnect the application to a different server instance. You may need to sign in again on the new backend.`}
        confirmLabel="Proceed & Reconnect"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={() => {
          if (pendingSaveConfig) applyNewConfig(pendingSaveConfig);
        }}
        onCancel={() => {
          setShowSwitchWarningModal(false);
          setPendingSaveConfig(null);
        }}
      />
    </div>
  );
}
