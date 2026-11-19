import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home, ChevronDown, Check, Plus } from 'lucide-react';
import { useHousehold } from '@/lib/supabase/household-context';
import { HouseholdRole } from '@wealthnest/domain';

function formatRoleLabel(role: HouseholdRole | undefined): string {
  switch (role) {
    case 'primary_owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'member':
      return 'Member';
    case 'viewer':
      return 'Viewer';
    default:
      return 'Member';
  }
}

export function HouseholdSwitcher() {
  const { households, activeHousehold, activeHouseholdId, householdRole, switchHousehold } =
    useHousehold();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!activeHousehold) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        data-testid="household-switcher-trigger"
        className="flex items-center gap-1.5 sm:gap-2 h-8 px-2 sm:px-3 rounded-lg bg-secondary/70 hover:bg-secondary border border-border/70 text-xs transition-colors max-w-[140px] sm:max-w-[230px]"
        title={`Active Household: ${activeHousehold.name} (${formatRoleLabel(householdRole)})`}
      >
        <Home className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="font-semibold text-foreground truncate">{activeHousehold.name}</span>
        <span className="hidden sm:inline-flex text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium shrink-0">
          {formatRoleLabel(householdRole)}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div
          data-testid="household-switcher-menu"
          className="absolute left-0 mt-1.5 w-64 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl p-1.5 z-50"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Your Households ({households.length})
          </div>
          <div className="space-y-0.5 max-h-60 overflow-y-auto">
            {households.map((hh) => {
              const isSelected = hh.id === activeHouseholdId;
              return (
                <button
                  key={hh.id}
                  type="button"
                  onClick={() => {
                    switchHousehold(hh.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{hh.name}</div>
                    <div className="text-[10px] text-slate-400">
                      Role: {formatRoleLabel(hh.role)}
                      {hh.memberCount ? ` • ${hh.memberCount} logins` : ''}
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-slate-800">
            <Link
              to="/settings?tab=family"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-emerald-400 hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create or Manage Households</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
