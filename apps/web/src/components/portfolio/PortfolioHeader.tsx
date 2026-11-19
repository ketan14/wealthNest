import { Button } from '@/components/ui/Button';
import { useFamily } from '@/lib/family/family-context';
import {
  Plus,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';

interface PortfolioHeaderProps {
  readonly isAuthenticated: boolean;
  readonly canEditFinancials?: boolean;
  readonly isRefreshingNavs: boolean;
  readonly onRefreshNavs: () => void;
  readonly isSupportModeActive: boolean;
  readonly onOpenImportModal: () => void;
  readonly onOpenAddModal: () => void;
  readonly onOpenManageFamily: () => void;
  readonly navRefreshMessage: string | null;
}

/**
 * Modernized Space-Saving Portfolio Header:
 * - Mobile: Sleek Title row with (↻) Refresh icon and (+) Action Dropdown (Import CAS / Add Holding).
 * - Mobile: Uses the Home Page's compact "MY FAMILY" horizontal chip row, saving ~170px of vertical space.
 * - Desktop: Full Title, subtitle, and desktop quick action buttons.
 */
export function PortfolioHeader({
  isAuthenticated: _isAuthenticated,
  canEditFinancials = true,
  isRefreshingNavs,
  onRefreshNavs,
  isSupportModeActive,
  onOpenImportModal,
  onOpenAddModal,
  onOpenManageFamily: _onOpenManageFamily,
  navRefreshMessage,
}: PortfolioHeaderProps) {
  const { members, selectedMemberId, setSelectedMemberId } = useFamily();

  return (
    <div className="space-y-3">
      {/* 1. Header Title Row */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
            Portfolio
          </h1>
          <p className="hidden sm:block text-xs sm:text-sm text-muted-foreground mt-0.5">
            Track investments and asset allocation across your family
          </p>
        </div>

        {/* Header Actions (Compact on 360-420px, Full on Desktop) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefreshNavs}
            disabled={isRefreshingNavs}
            className="h-8 w-8 sm:w-auto sm:px-2.5 p-0 text-xs gap-1.5 text-muted-foreground hover:text-foreground sm:border sm:border-border/80 rounded-lg whitespace-nowrap shrink-0"
            title="Refresh Live Quotes"
            aria-label="Refresh Live Quotes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingNavs ? 'animate-spin text-primary' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenImportModal}
            disabled={isSupportModeActive || !canEditFinancials}
            className="h-8 px-2 sm:px-2.5 text-xs gap-1.5 border-border/80 whitespace-nowrap shrink-0"
            title="Import CAS Statement"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="sm:hidden">CAS</span>
            <span className="hidden sm:inline">Import CAS</span>
          </Button>

          <Button
            size="sm"
            onClick={onOpenAddModal}
            disabled={isSupportModeActive || !canEditFinancials}
            className="h-8 px-2.5 sm:px-3 text-xs gap-1 sm:gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-sm whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
            <span>Add Asset</span>
          </Button>
        </div>
      </div>

      {/* 2. Compact "MY FAMILY" Horizontal Scroll Row (Matches Home Page Exactly) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground sm:hidden">
          <span className="font-semibold uppercase tracking-wider text-slate-400 text-[11px]">
            My Family
          </span>
          <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] border border-border/60">
            Household
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setSelectedMemberId('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedMemberId === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary/60 text-muted-foreground hover:bg-secondary border border-border/60'
            }`}
          >
            All Members
          </button>

          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMemberId(m.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedMemberId === m.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-secondary border border-border/60'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* Live NAV / Price Refresh Message */}
      {navRefreshMessage && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300 flex items-center justify-between">
          <span>{navRefreshMessage}</span>
          <span className="font-mono text-[10px] text-cyan-400/80">NSE & AMFI</span>
        </div>
      )}
    </div>
  );
}
