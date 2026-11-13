import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FamilyFilterBar } from '@/components/family/FamilyFilterBar';
import { FamilyDistributionWidget } from '@/components/family/FamilyDistributionWidget';
import {
  Plus,
  ArrowUpRight,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  Radio,
} from 'lucide-react';

interface MarketSessionInfo {
  readonly isOpen: boolean;
  readonly description: string;
  readonly istTimeString: string;
}

interface PortfolioHeaderProps {
  readonly isAuthenticated: boolean;
  readonly marketSession: MarketSessionInfo;
  readonly isPolling: boolean;
  readonly onTogglePolling: () => void;
  readonly isRefreshingNavs: boolean;
  readonly onRefreshNavs: () => void;
  readonly isSupportModeActive: boolean;
  readonly onOpenImportModal: () => void;
  readonly onOpenAddModal: () => void;
  readonly onOpenManageFamily: () => void;
  readonly selectedMemberId: string;
  readonly navRefreshMessage: string | null;
}

/**
 * Renders the Portfolio page header, live NSE/BSE session badge, auto-poll & import actions,
 * family filter bar, and demo mode / quote refresh banners.
 */
export function PortfolioHeader({
  isAuthenticated,
  marketSession,
  isPolling,
  onTogglePolling,
  isRefreshingNavs,
  onRefreshNavs,
  isSupportModeActive,
  onOpenImportModal,
  onOpenAddModal,
  onOpenManageFamily,
  selectedMemberId,
  navRefreshMessage,
}: PortfolioHeaderProps) {
  return (
    <>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Portfolio & Asset Allocation
            </h2>
            <Badge
              variant="default"
              className="font-mono text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30"
            >
              India First (₹ INR)
            </Badge>
            <Badge
              variant={isAuthenticated ? 'success' : 'secondary'}
              className="font-mono text-[10px]"
            >
              {isAuthenticated ? 'Database Active' : 'Demo Mode'}
            </Badge>
            {/* Live Indian Market (NSE/BSE) Session Indicator */}
            <Badge
              variant="outline"
              className={`font-mono text-[10px] flex items-center gap-1.5 ${
                marketSession.isOpen
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-secondary/70 text-muted-foreground border-border'
              }`}
              title={`Indian Market Session: ${marketSession.description} (${marketSession.istTimeString})`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  marketSession.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                }`}
              />
              {marketSession.isOpen
                ? 'NSE/BSE: OPEN'
                : `NSE/BSE: CLOSED (${marketSession.istTimeString})`}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Indian multi-asset wealth tracker with Lakh/Crore precision, automated live stock CMP,
            and separated Direct Equities and Mutual Fund portfolios.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Live Auto-Polling Toggle Button */}
          <Button
            variant={isPolling ? 'default' : 'outline'}
            onClick={onTogglePolling}
            className={`gap-1.5 shadow-sm text-xs border ${
              isPolling
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/50'
                : 'border-border/80 text-muted-foreground hover:text-foreground'
            }`}
            title="Automatically poll live stock CMP and AMFI NAVs every 25 seconds"
          >
            <Radio
              className={`w-3.5 h-3.5 ${isPolling ? 'animate-pulse text-white' : 'text-muted-foreground'}`}
            />
            <span>Auto-Poll: {isPolling ? 'ON' : 'OFF'}</span>
          </Button>

          <Button
            variant="secondary"
            onClick={onRefreshNavs}
            disabled={isRefreshingNavs}
            className="gap-2 shadow-sm text-xs border border-border/80"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshingNavs ? 'animate-spin' : ''}`}
            />
            {isRefreshingNavs ? 'Fetching Feeds...' : 'Refresh Quotes (NSE & AMFI)'}
          </Button>
          <Button
            variant="outline"
            onClick={onOpenImportModal}
            disabled={isSupportModeActive}
            title={
              isSupportModeActive ? 'Disabled in Support Impersonation Mode (Read-Only)' : undefined
            }
            className="gap-2 shadow-sm border-primary/20 hover:bg-primary/5 text-foreground text-xs disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            Import CAS
          </Button>
          <Button
            onClick={onOpenAddModal}
            disabled={isSupportModeActive}
            title={
              isSupportModeActive ? 'Disabled in Support Impersonation Mode (Read-Only)' : undefined
            }
            className="gap-2 shadow-sm text-xs disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add Holding
          </Button>
        </div>
      </div>

      {/* Phase 6A: Multi-Entity Family & Demat Filter Bar */}
      <FamilyFilterBar onOpenManageModal={onOpenManageFamily} />

      {/* Phase 6A: Consolidated Family Distribution & HUF Shield */}
      {selectedMemberId === 'all' && <FamilyDistributionWidget />}

      {/* AMFI & NSE Refresh Success Alert */}
      {navRefreshMessage && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3.5 flex items-center justify-between text-xs text-cyan-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{navRefreshMessage}</span>
          </div>
          <span className="font-mono text-[10px] text-cyan-400/80">NSE/BSE & AMFI Feeds</span>
        </div>
      )}

      {/* Mode Alert Banner if not authenticated */}
      {!isAuthenticated && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                India-First Demonstration Portfolio Active
              </p>
              <p className="text-xs text-muted-foreground">
                Sample portfolio featuring Indian Equities (Reliance, TCS), Mutual Funds (Parag
                Parikh, Bandhan), Sovereign Gold Bonds (SGB), PPF, and FDs. Sign in to save and sync
                your real portfolio in PostgreSQL.
              </p>
            </div>
          </div>
          <Link to="/">
            <Button variant="default" size="sm" className="whitespace-nowrap text-xs gap-1.5">
              Sign In to Save
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      )}
    </>
  );
}

