import { Server, Wifi, Globe } from 'lucide-react';
import { ConnectionMode } from '@/lib/config/server-config';

interface ServerModeSelectorProps {
  mode: ConnectionMode;
  onModeChange: (mode: ConnectionMode) => void;
}

export function ServerModeSelector({ mode, onModeChange }: ServerModeSelectorProps) {
  return (
    <div>
      <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-2">
        Connection Mode
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => onModeChange('local')}
          className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
            mode === 'local'
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
          onClick={() => onModeChange('lan')}
          className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
            mode === 'lan'
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
          onClick={() => onModeChange('remote')}
          className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
            mode === 'remote'
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
  );
}
