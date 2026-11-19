import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { useFamily } from '@/lib/family/family-context';
import {
  Plus,
  RefreshCw,
  FileSpreadsheet,
  ChevronDown,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  return (
    <div className="space-y-3">
      {/* 1. Header Title Row */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">
            Portfolio
          </h1>
          <p className="hidden sm:block text-xs sm:text-sm text-muted-foreground mt-0.5">
            Track investments and asset allocation across your family
          </p>
        </div>

        {/* Mobile Quick Actions: (↻) Refresh + (+) Action Dropdown */}
        <div className="flex sm:hidden items-center gap-1.5 relative" ref={mobileMenuRef}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefreshNavs}
            disabled={isRefreshingNavs}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-lg"
            title="Refresh Live Quotes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingNavs ? 'animate-spin text-primary' : ''}`} />
          </Button>

          <Button
            size="sm"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            disabled={isSupportModeActive || !canEditFinancials}
            className="h-8 px-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-lg shadow-sm flex items-center gap-1"
            title="More Portfolio Actions"
            aria-label="More Actions"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <ChevronDown className={`w-3 h-3 transition-transform ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
          </Button>

          {/* Mobile Popover Menu for Import CAS & Add Holding */}
          {isMobileMenuOpen && (
            <div className="absolute right-0 top-10 w-52 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenAddModal();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-xs text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Add Holding</div>
                  <div className="text-[10px] text-muted-foreground">Manual stock or MF</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenImportModal();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-xs text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <div className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Import CAS</div>
                  <div className="text-[10px] text-muted-foreground">CAMS / KFintech PDF</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Desktop Quick Actions */}
        <div className="hidden sm:flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshNavs}
            disabled={isRefreshingNavs}
            className="text-xs gap-1.5 h-8 border-border/80"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingNavs ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenImportModal}
            disabled={isSupportModeActive || !canEditFinancials}
            className="text-xs gap-1.5 h-8 border-border/80"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
            <span>Import CAS</span>
          </Button>

          <Button
            size="sm"
            onClick={onOpenAddModal}
            disabled={isSupportModeActive || !canEditFinancials}
            className="text-xs gap-1.5 h-8 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Holding</span>
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
