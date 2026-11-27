import { Button } from '@/components/ui/Button';
import { SyncingIndicator } from '@/components/ui/SyncingIndicator';
import { EntitySelectorChips } from '@/components/family/EntitySelectorChips';
import { PlanQuotaBadge } from '@/components/plans/PlanQuotaBadge';
import { useFamily } from '@/lib/family/family-context';
import { Plus, RefreshCw, FileSpreadsheet } from 'lucide-react';

interface PortfolioHeaderProps {
  readonly isAuthenticated: boolean;
  readonly canEditFinancials?: boolean;
  readonly isRefreshingNavs: boolean;
  readonly isSyncing?: boolean;
  readonly onRefreshNavs: () => void;
  readonly isSupportModeActive: boolean;
  readonly onOpenImportModal: () => void;
  readonly onOpenAddModal: () => void;
  readonly onOpenManageFamily: () => void;
  readonly navRefreshMessage: string | null;
  readonly nonRealEstateCount?: number;
  readonly onOpenPlanLimit?: () => void;
}

/**
 * Phase 2 Portfolio Header & Entity Selector:
 * 1. Portfolio page heading + live syncing pill
 * 2. Compact single-row actions (Add Holding primary, Import CAS secondary, Refresh Quotes secondary)
 * 3. Shared horizontally scrollable Entity Selector strip
 */
export function PortfolioHeader({
  isAuthenticated: _isAuthenticated,
  canEditFinancials = true,
  isRefreshingNavs,
  isSyncing = false,
  onRefreshNavs,
  isSupportModeActive,
  onOpenImportModal,
  onOpenAddModal,
  onOpenManageFamily,
  navRefreshMessage,
  nonRealEstateCount = 0,
  onOpenPlanLimit,
}: PortfolioHeaderProps) {
  const { members, selectedMemberId, setSelectedMemberId } = useFamily();

  return (
    <div className="space-y-3">
      {/* 1. Heading & Compact Single-Row Actions */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              Portfolio
            </h1>
            <SyncingIndicator isSyncing={isSyncing} />
            <PlanQuotaBadge
              resource="holdings"
              currentCount={nonRealEstateCount}
              onLimitClick={onOpenPlanLimit}
            />
          </div>
          <p className="hidden sm:block text-xs sm:text-sm text-muted-foreground mt-0.5">
            Track investments and asset allocation across your family
          </p>
        </div>

        {/* Actions: Always single-row on mobile & desktop (no multi-row wrapping) */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefreshNavs}
            disabled={isRefreshingNavs}
            className="h-8 w-8 sm:w-auto sm:px-2.5 p-0 text-xs gap-1.5 text-muted-foreground hover:text-foreground sm:border sm:border-border/80 rounded-lg whitespace-nowrap shrink-0"
            title="Refresh Quotes"
            aria-label="Refresh Quotes"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshingNavs ? 'animate-spin text-primary' : ''}`}
            />
            <span className="hidden sm:inline">Refresh Quotes</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenImportModal}
            disabled={isSupportModeActive || !canEditFinancials}
            className="h-8 px-2.5 text-xs gap-1.5 border-border/80 whitespace-nowrap shrink-0"
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
            aria-label="Add Holding (Add Asset)"
            className="h-8 px-2.5 sm:px-3 text-xs gap-1 sm:gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-sm whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">Add Holding</span>
          </Button>
        </div>
      </div>

      {/* 2. Entity Selector */}
      <EntitySelectorChips
        members={members}
        selectedMemberId={selectedMemberId}
        onSelectMember={setSelectedMemberId}
        onOpenManage={onOpenManageFamily}
      />

      {/* Live NAV / Price Refresh Message */}
      {navRefreshMessage && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-300 flex items-center justify-between gap-2">
          <span className="truncate">{navRefreshMessage}</span>
          <span className="font-mono text-[10px] text-cyan-400/80 shrink-0">NSE &amp; AMFI</span>
        </div>
      )}
    </div>
  );
}
