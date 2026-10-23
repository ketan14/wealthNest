import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PieChart,
  ArrowLeftRight,
  TrendingUp,
  Target,
  Settings,
  ShieldCheck,
  Landmark,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
