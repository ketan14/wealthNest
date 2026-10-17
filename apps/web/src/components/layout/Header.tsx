import { Badge } from '@/components/ui/Badge';
import { Globe, Terminal, User } from 'lucide-react';

export function Header() {
  return (
    <header className="h-16 border-b border-border bg-card/40 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Environment:</span>
        <Badge variant="success" className="gap-1.5 py-1 px-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          wealthnest.local (WSL2 / Docker)
        </Badge>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-accent/40 border border-border/40 px-3 py-1.5 rounded-md font-mono">
          <Terminal className="w-3.5 h-3.5 text-primary" />
          <span>npm workspaces</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent/40 border border-border/40 px-3 py-1.5 rounded-md font-mono">
          <Globe className="w-3.5 h-3.5 text-primary" />
          <span>port: 80 / 5173</span>
        </div>

        <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground">
          <User className="w-4 h-4" />
        </div>
      </div>
    </header>
  );
}
