import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PieChart,
  Landmark,
  ArrowLeftRight,
  Settings,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdmin } from '@/lib/admin/admin-context';
import { GlobalQuickAddModal } from './GlobalQuickAddModal';

export function BottomNavigationBar() {
  const { isAnyAdmin } = useAdmin();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  return (
    <>
      <nav
        data-testid="bottom-nav-bar"
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border shadow-lg"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between h-16 px-2 max-w-md mx-auto relative">
          {/* 1. Overview */}
          <NavLink
            to="/"
            data-testid="bottom-nav-overview"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] py-1 px-1 rounded-lg text-[10px] font-medium transition-all duration-150',
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground active:scale-95'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'p-1 rounded-md transition-all',
                    isActive ? 'bg-primary/15 text-primary scale-110' : ''
                  )}
                >
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <span className="truncate max-w-[56px] leading-tight mt-0.5">Overview</span>
              </>
            )}
          </NavLink>

          {/* 2. Portfolio */}
          <NavLink
            to="/portfolio"
            data-testid="bottom-nav-portfolio"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] py-1 px-1 rounded-lg text-[10px] font-medium transition-all duration-150',
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground active:scale-95'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'p-1 rounded-md transition-all',
                    isActive ? 'bg-primary/15 text-primary scale-110' : ''
                  )}
                >
                  <PieChart className="w-5 h-5" />
                </div>
                <span className="truncate max-w-[56px] leading-tight mt-0.5">Portfolio</span>
              </>
            )}
          </NavLink>

          {/* 3. Center Quick-Add Button (Elevated FAB) */}
          <div className="flex items-center justify-center flex-1 min-w-[50px] -mt-5">
            <button
              type="button"
              onClick={() => setIsQuickAddOpen(true)}
              data-testid="bottom-nav-quick-add"
              aria-label="Quick Action"
              className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 border-2 border-background hover:scale-105 active:scale-95 transition-all duration-150"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>

          {/* 4. Liabilities */}
          <NavLink
            to="/liabilities"
            data-testid="bottom-nav-liabilities"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] py-1 px-1 rounded-lg text-[10px] font-medium transition-all duration-150',
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground active:scale-95'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'p-1 rounded-md transition-all',
                    isActive ? 'bg-primary/15 text-primary scale-110' : ''
                  )}
                >
                  <Landmark className="w-5 h-5" />
                </div>
                <span className="truncate max-w-[56px] leading-tight mt-0.5">Liabilities</span>
              </>
            )}
          </NavLink>

          {/* 5. Cashflow */}
          <NavLink
            to="/transactions"
            data-testid="bottom-nav-cashflow"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] py-1 px-1 rounded-lg text-[10px] font-medium transition-all duration-150',
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground active:scale-95'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'p-1 rounded-md transition-all',
                    isActive ? 'bg-primary/15 text-primary scale-110' : ''
                  )}
                >
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <span className="truncate max-w-[56px] leading-tight mt-0.5">Cashflow</span>
              </>
            )}
          </NavLink>

          {/* 6. Settings */}
          <NavLink
            to="/settings"
            data-testid="bottom-nav-settings"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] py-1 px-1 rounded-lg text-[10px] font-medium transition-all duration-150',
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground active:scale-95'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'p-1 rounded-md transition-all',
                    isActive ? 'bg-primary/15 text-primary scale-110' : ''
                  )}
                >
                  <Settings className="w-5 h-5" />
                </div>
                <span className="truncate max-w-[56px] leading-tight mt-0.5">Settings</span>
              </>
            )}
          </NavLink>

          {/* 7. Admin (if applicable) */}
          {isAnyAdmin && (
            <NavLink
              to="/admin"
              data-testid="bottom-nav-admin"
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] py-1 px-1 rounded-lg text-[10px] font-medium transition-all duration-150',
                  isActive
                    ? 'text-cyan-400 font-semibold'
                    : 'text-cyan-500/80 hover:text-cyan-300 active:scale-95'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={cn(
                      'p-1 rounded-md transition-all',
                      isActive ? 'bg-cyan-500/20 text-cyan-300 scale-110' : ''
                    )}
                  >
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <span className="truncate max-w-[56px] leading-tight mt-0.5">Admin</span>
                </>
              )}
            </NavLink>
          )}
        </div>
      </nav>

      {/* Global Quick Add Action Sheet / Modal */}
      <GlobalQuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
      />
    </>
  );
}
