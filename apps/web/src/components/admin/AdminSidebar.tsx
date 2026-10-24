import { NavLink, Link } from 'react-router-dom';

import {
  LayoutDashboard,
  Users,
  Home,
  ShieldCheck,
  FileText,
  Sliders,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react';
import { useAdmin } from '../../lib/admin/admin-context';
import { PlatformRole } from '@wealthnest/domain';

export function AdminSidebar() {
  const { currentAdminRole, setSimulatedRole } = useAdmin();

  const navItems = [
    { label: 'Overview', to: '/admin', icon: LayoutDashboard, end: true },
    { label: 'User Directory', to: '/admin/users', icon: Users, end: false },
    { label: 'Households', to: '/admin/households', icon: Home, end: false },
    { label: 'Staff & Roles', to: '/admin/roles', icon: ShieldCheck, end: false },
    { label: 'Audit Trail', to: '/admin/audit-logs', icon: FileText, end: false },
    { label: 'Platform Security', to: '/admin/settings', icon: Sliders, end: false },
  ];

  const roleBadgeColors: Record<PlatformRole, string> = {
    super_admin: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    support_admin: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    auditor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  };

  return (
    <aside className="w-64 bg-slate-950/90 border-r border-slate-800/80 backdrop-blur-xl flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-white text-base tracking-tight leading-none">
              WealthNest
            </h1>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-cyan-400">
              Admin Portal
            </span>
          </div>
        </div>
      </div>

      {/* Active Role Indicator */}
      <div className="px-5 py-3 border-b border-slate-800/50 bg-slate-900/40">
        <div className="text-[11px] font-medium text-slate-400 mb-1">Active Entitlement</div>
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
              currentAdminRole ? roleBadgeColors[currentAdminRole] : 'bg-slate-800 text-slate-400'
            }`}
          >
            {currentAdminRole?.replace('_', ' ') || 'None'}
          </span>
          {/* Quick role simulator for QA/testing */}
          <select
            value={currentAdminRole || ''}
            onChange={(e) => setSimulatedRole((e.target.value as PlatformRole) || null)}
            className="text-[11px] bg-slate-800 text-slate-300 border border-slate-700 rounded px-1.5 py-0.5 outline-none focus:border-cyan-500"
            title="Simulate role for QA testing"
          >
            <option value="super_admin">Super Admin</option>
            <option value="support_admin">Support Admin</option>
            <option value="auditor">Auditor</option>
          </select>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Return to App Shell */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950">
        <Link
          to="/"
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-800 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit to Investor Portal</span>
        </Link>
        <p className="text-[10px] text-slate-500 text-center mt-2.5">
          WealthNest Platform v2.5 &bull; Security Level 3
        </p>
      </div>
    </aside>
  );
}
