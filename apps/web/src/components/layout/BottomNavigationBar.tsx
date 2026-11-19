import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PieChart,
  Landmark,
  ArrowLeftRight,
  Settings,
  ShieldAlert,
  MoreHorizontal,
  Building2,
  TrendingUp,
  Target,
  FolderLock,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdmin } from '@/lib/admin/admin-context';
import { ResponsiveModalShell } from '@/components/ui/ResponsiveModalShell';

export function BottomNavigationBar() {
  const { isAnyAdmin } = useAdmin();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  return (
    <>
      <nav
        data-testid="bottom-nav-bar"
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border shadow-lg select-none"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-around h-16 px-1.5 max-w-lg mx-auto gap-0.5 relative">
          {/* 1. Overview */}
          <NavLink
            to="/"
            data-testid="bottom-nav-overview"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] py-1 px-1 rounded-lg text-[10px] font-medium whitespace-nowrap shrink-0 transition-all duration-150',
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
                    isActive ? 'bg-primary/15 text-primary scale-105' : ''
                  )}
                >
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <span className="leading-tight mt-0.5 whitespace-nowrap">Overview</span>
              </>
            )}
          </NavLink>

          {/* 2. Portfolio */}
          <NavLink
            to="/portfolio"
            data-testid="bottom-nav-portfolio"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] py-1 px-1 rounded-lg text-[10px] font-medium whitespace-nowrap shrink-0 transition-all duration-150',
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
                    isActive ? 'bg-primary/15 text-primary scale-105' : ''
                  )}
                >
                  <PieChart className="w-5 h-5" />
                </div>
                <span className="leading-tight mt-0.5 whitespace-nowrap">Portfolio</span>
              </>
            )}
          </NavLink>

          {/* 3. Liabilities */}
          <NavLink
            to="/liabilities"
            data-testid="bottom-nav-liabilities"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] py-1 px-1 rounded-lg text-[10px] font-medium whitespace-nowrap shrink-0 transition-all duration-150',
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
                    isActive ? 'bg-primary/15 text-primary scale-105' : ''
                  )}
                >
                  <Landmark className="w-5 h-5" />
                </div>
                <span className="leading-tight mt-0.5 whitespace-nowrap">Liabilities</span>
              </>
            )}
          </NavLink>

          {/* 4. Cashflow */}
          <NavLink
            to="/transactions"
            data-testid="bottom-nav-cashflow"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] py-1 px-1 rounded-lg text-[10px] font-medium whitespace-nowrap shrink-0 transition-all duration-150',
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
                    isActive ? 'bg-primary/15 text-primary scale-105' : ''
                  )}
                >
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <span className="leading-tight mt-0.5 whitespace-nowrap">Cashflow</span>
              </>
            )}
          </NavLink>

          {/* 5. Settings */}
          <NavLink
            to="/settings"
            data-testid="bottom-nav-settings"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] py-1 px-1 rounded-lg text-[10px] font-medium whitespace-nowrap shrink-0 transition-all duration-150',
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
                    isActive ? 'bg-primary/15 text-primary scale-105' : ''
                  )}
                >
                  <Settings className="w-5 h-5" />
                </div>
                <span className="leading-tight mt-0.5 whitespace-nowrap">Settings</span>
              </>
            )}
          </NavLink>

          {/* 6. Admin (if applicable) */}
          {isAnyAdmin && (
            <NavLink
              to="/admin"
              data-testid="bottom-nav-admin"
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] py-1 px-1 rounded-lg text-[10px] font-medium whitespace-nowrap shrink-0 transition-all duration-150',
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
                      isActive ? 'bg-cyan-500/20 text-cyan-300 scale-105' : ''
                    )}
                  >
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <span className="leading-tight mt-0.5 whitespace-nowrap">Admin</span>
                </>
              )}
            </NavLink>
          )}

          {/* 7. More Modules Sheet Trigger */}
          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            data-testid="bottom-nav-more"
            aria-label="More modules"
            className="flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] py-1 px-1 rounded-lg text-[10px] font-medium whitespace-nowrap shrink-0 text-muted-foreground hover:text-foreground active:scale-95 transition-all duration-150"
          >
            <div className="p-1 rounded-md">
              <MoreHorizontal className="w-5 h-5" />
            </div>
            <span className="leading-tight mt-0.5 whitespace-nowrap">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More Modules" Slide-up Sheet */}
      {isMoreOpen && (
        <ResponsiveModalShell
          variant="sheet"
          role="dialog"
          ariaLabel="All Modules"
          backdropClassName="md:hidden bg-background/80"
          panelClassName="max-w-none bg-card border-x-0 border-b-0 border-t border-border p-5 space-y-4 max-h-[85dvh] sm:max-w-none"
          onBackdropClick={() => setIsMoreOpen(false)}
          header={
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">All Modules</h3>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                aria-label="Close menu"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          }
          bodyClassName="pr-0.5"
        >
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { to: '/real-estate', label: 'Real Estate', icon: Building2 },
              { to: '/analytics', label: 'Analytics', icon: TrendingUp },
              { to: '/goals', label: 'Goals & Targets', icon: Target },
              { to: '/documents', label: 'Documents Vault', icon: FolderLock },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 p-3 rounded-xl border text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-primary/15 border-primary/30 text-primary'
                      : 'bg-secondary/40 border-border/60 text-foreground hover:bg-accent'
                  )
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </ResponsiveModalShell>
      )}
    </>
  );
}
