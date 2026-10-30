import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/supabase/auth-context';
import { isTauri } from '@/lib/tauri/tauri-runtime';
import { connectionManager } from '@/lib/services/connection-manager';
import { ServerConfig } from '@/lib/config/server-config';
import { Globe, Terminal, User, LogIn, UserPlus, LogOut, HardDrive, Wifi, Server } from 'lucide-react';

export function Header() {
  const { user, isOfflineUser, signOut } = useAuth();
  const inTauri = isTauri();
  const [config, setConfig] = useState<ServerConfig>(() => connectionManager.getConfig());

  useEffect(() => {
    return connectionManager.subscribeConfig((cfg) => setConfig(cfg));
  }, []);

  const renderEnvironmentBadge = () => {
    if (isOfflineUser) {
      return (
        <Badge variant="secondary" className="gap-1.5 py-1 px-3 border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
          <HardDrive className="w-3.5 h-3.5" />
          <span>OFFLINE LOCAL VAULT</span>
        </Badge>
      );
    }

    if (config.mode === 'lan') {
      return (
        <Link to="/settings?tab=connection" title="Click to manage Server Connection">
          <Badge variant="secondary" className="gap-1.5 py-1 px-3 bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 transition-colors">
            <Wifi className="w-3.5 h-3.5 animate-pulse text-amber-400" />
            <span>LAN DEV ({config.host})</span>
          </Badge>
        </Link>
      );
    }

    if (config.mode === 'remote') {
      return (
        <Link to="/settings?tab=connection" title="Click to manage Server Connection">
          <Badge variant="outline" className="gap-1.5 py-1 px-3 bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20 transition-colors">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>PRODUCTION</span>
          </Badge>
        </Link>
      );
    }

    // Default Local Development
    return (
      <Link to="/settings?tab=connection" title="Click to manage Server Connection">
        <Badge variant="success" className="gap-1.5 py-1 px-3 hover:bg-emerald-500/20 transition-colors">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Server className="w-3 h-3 text-emerald-400" />
          <span>LOCAL DEV (127.0.0.1)</span>
        </Badge>
      </Link>
    );
  };

  return (
    <header className="h-16 border-b border-border bg-card/40 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Environment:</span>
        {renderEnvironmentBadge()}
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-accent/40 border border-border/40 px-3 py-1.5 rounded-md font-mono">
          <Terminal className="w-3.5 h-3.5 text-primary" />
          <span>npm workspaces</span>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground bg-accent/40 border border-border/40 px-3 py-1.5 rounded-md font-mono">
          <Globe className="w-3.5 h-3.5 text-primary" />
          <span>port: 80 / 5173</span>
        </div>

        {/* User Authentication state */}
        {user ? (
          <div className="flex items-center gap-3">
            {isOfflineUser && (
              <Badge
                variant="secondary"
                className="hidden sm:inline-flex gap-1.5 py-1 px-2.5 text-[11px] border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              >
                <HardDrive className="w-3 h-3" />
                Offline Local Vault
              </Badge>
            )}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-secondary/60 border border-border/60 text-xs">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium text-foreground max-w-[140px] truncate">
                {user.email}
              </span>
            </div>
            {!inTauri && (
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                title="Sign Out"
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </Button>
            </Link>
            <Link to="/signup">
              <Button
                size="sm"
                className="h-8 text-xs font-semibold bg-primary hover:bg-emerald-400 text-slate-950 gap-1.5 shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Sign Up
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
