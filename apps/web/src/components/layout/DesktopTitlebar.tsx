import { Minus, Square, X, ShieldCheck } from 'lucide-react';
import { isTauriDesktop } from '@/lib/tauri/tauri-runtime';

export function DesktopTitlebar() {
  if (!isTauriDesktop()) {
    return null;
  }

  const handleMinimize = async () => {
    try {
      const appWindow = (window as unknown as {
        __TAURI__?: {
          window?: {
            getCurrentWindow: () => {
              minimize: () => Promise<void>;
            };
          };
        };
      }).__TAURI__?.window?.getCurrentWindow();
      await appWindow?.minimize();
    } catch (err) {
      console.error('Failed to minimize window:', err);
    }
  };

  const handleToggleMaximize = async () => {
    try {
      const appWindow = (window as unknown as {
        __TAURI__?: {
          window?: {
            getCurrentWindow: () => {
              toggleMaximize: () => Promise<void>;
            };
          };
        };
      }).__TAURI__?.window?.getCurrentWindow();
      await appWindow?.toggleMaximize();
    } catch (err) {
      console.error('Failed to toggle maximize window:', err);
    }
  };

  const handleClose = async () => {
    try {
      const appWindow = (window as unknown as {
        __TAURI__?: {
          window?: {
            getCurrentWindow: () => {
              close: () => Promise<void>;
            };
          };
        };
      }).__TAURI__?.window?.getCurrentWindow();
      await appWindow?.close();
    } catch (err) {
      console.error('Failed to close window:', err);
    }
  };

  return (
    <header
      data-testid="desktop-titlebar"
      data-tauri-drag-region
      className="h-8 bg-card/90 border-b border-border/80 flex items-center justify-between px-3 select-none text-xs text-muted-foreground z-50 sticky top-0"
    >
      <div className="flex items-center gap-2 pointer-events-none">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span className="font-semibold text-foreground tracking-tight">WealthNest</span>
        <span className="text-[10px] font-mono text-muted-foreground">Desktop</span>
      </div>

      <div className="flex items-center -mr-1">
        <button
          type="button"
          onClick={handleMinimize}
          data-testid="titlebar-minimize"
          aria-label="Minimize"
          className="h-7 w-9 flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>

        <button
          type="button"
          onClick={handleToggleMaximize}
          data-testid="titlebar-maximize"
          aria-label="Maximize"
          className="h-7 w-9 flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <Square className="w-2.5 h-2.5" />
        </button>

        <button
          type="button"
          onClick={handleClose}
          data-testid="titlebar-close"
          aria-label="Close"
          className="h-7 w-9 flex items-center justify-center hover:bg-rose-500 hover:text-white text-muted-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
