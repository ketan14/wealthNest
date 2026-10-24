import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PieChart,
  ArrowLeftRight,
  TrendingUp,
  Target,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Landmark,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdmin } from '@/lib/admin/admin-context';


interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { title: 'System Overview', href: '/', icon: LayoutDashboard },
  { title: 'Portfolio', href: '/portfolio', icon: PieChart },
  { title: 'Loans & Liabilities', href: '/liabilities', icon: Landmark },
  { title: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
  { title: 'Analytics', href: '/analytics', icon: TrendingUp },
  { title: 'Goals & Targets', href: '/goals', icon: Target },
  { title: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const { isAnyAdmin, currentAdminRole } = useAdmin();

  return (
    <aside className="w-64 border-r border-border bg-card/60 backdrop-blur-md flex flex-col justify-between p-4 min-h-screen">
      <div>
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3 px-3 py-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-foreground">
              WealthNest
            </h1>
            <p className="text-xs text-muted-foreground font-mono">v0.1.0-alpha</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary/15 text-primary border border-primary/20 shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              <item.icon className="w-4 h-4" />
              <span>{item.title}</span>
            </NavLink>
          ))}

          {isAnyAdmin && (
            <div className="pt-2 mt-2 border-t border-border/40">
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-150',
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                      : 'text-cyan-400/90 hover:bg-cyan-500/10 hover:text-cyan-300'
                  )
                }
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Admin Portal</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                  {currentAdminRole}
                </span>
              </NavLink>
            </div>
          )}
        </nav>
      </div>

      {/* Monorepo Architecture Badge */}
      <div className="p-3 rounded-lg bg-accent/50 border border-border/60 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Clean Architecture</p>
        <p className="text-[11px] leading-relaxed">
          4 active layers: Web, Application, Pure Domain, and Shared utilities.
        </p>
      </div>
    </aside>
  );
}
