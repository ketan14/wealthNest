import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PieChart,
  Landmark,
  ArrowLeftRight,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdmin } from '@/lib/admin/admin-context';

interface BottomNavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
}

const navItems: BottomNavItem[] = [
  { title: 'Overview', href: '/', icon: LayoutDashboard, testId: 'bottom-nav-overview' },
  { title: 'Portfolio', href: '/portfolio', icon: PieChart, testId: 'bottom-nav-portfolio' },
  { title: 'Liabilities', href: '/liabilities', icon: Landmark, testId: 'bottom-nav-liabilities' },
  { title: 'Cashflow', href: '/transactions', icon: ArrowLeftRight, testId: 'bottom-nav-cashflow' },
  { title: 'Settings', href: '/settings', icon: Settings, testId: 'bottom-nav-settings' },
];

export function BottomNavigationBar() {
  const { isAnyAdmin } = useAdmin();

  return (
    <nav
      data-testid="bottom-nav-bar"
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border shadow-lg"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-center justify-around h-16 px-1 max-w-md mx-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            data-testid={item.testId}
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
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="truncate max-w-[56px] leading-tight mt-0.5">{item.title}</span>
              </>
            )}
          </NavLink>
        ))}

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
  );
}
