import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  UserPlus,
  Home,
  FileText,
  ArrowRight,
  Lock,
  RefreshCw,
} from 'lucide-react';

import { AdminHeader } from '../../components/admin/AdminHeader';
import { adminAdapter } from '../../lib/supabase/admin.adapter';
import { AdminDashboardStats, AdminAuditLogEntry } from '@wealthnest/domain';

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [recentAudits, setRecentAudits] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, logsData] = await Promise.all([
        adminAdapter.getDashboardStats(),
        adminAdapter.listLogs({ page: 1, limit: 6 }),
      ]);
      setStats(statsData);
      setRecentAudits(logsData.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="flex-1 flex flex-col">
      <AdminHeader
        title="Platform Administration Overview"
        subtitle="Operational metrics, user lifecycle health, and security telemetry"
        action={
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        }
      />

      <div className="p-8 space-y-8 max-w-7xl w-full mx-auto">
        {/* Security & Financial Isolation Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 relative overflow-hidden shadow-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                Tenant Isolation & Confidentiality Boundary Active
              </h3>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                WealthNest enforces strict Row Level Security (RLS). Platform administrators possess elevated
                authorities to manage identity, lifecycle states, and platform access, but are{' '}
                <span className="text-amber-300 font-medium">cryptographically prevented</span> from viewing
                personal financial holdings, net worth valuations, and private family transactions.
              </p>
            </div>
          </div>
        </div>

        {/* Operational Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Total Users</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {stats?.totalUsers ?? '...'}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Registered in platform</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Active Accounts</span>
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">
              {stats?.activeUsers ?? '...'}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Fully operational</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Suspended</span>
              <UserX className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400 tracking-tight">
              {stats?.suspendedUsers ?? '...'}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Access blocked</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Pending Invites</span>
              <UserPlus className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 tracking-tight">
              {stats?.invitedUsers ?? '...'}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Awaiting signup</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Households</span>
              <Home className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-indigo-300 tracking-tight">
              {stats?.totalHouseholds ?? '...'}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Multi-user tenants</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Audit Events</span>
              <FileText className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-300 tracking-tight">
              {stats?.totalAuditEvents ?? '...'}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Append-only log</span>
          </div>
        </div>

        {/* Quick Administration Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/admin/users"
            className="group p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-cyan-500/40 transition-all backdrop-blur-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors flex items-center justify-between">
              Manage Users &amp; Invitations
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h4>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Explore all registered investors, invite new members, suspend compromised accounts, or trigger password resets.
            </p>
          </Link>

          <Link
            to="/admin/roles"
            className="group p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-emerald-500/40 transition-all backdrop-blur-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors flex items-center justify-between">
              Platform Roles &amp; RBAC
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h4>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Oversee platform staff, grant Super Admin or Support Admin entitlements, and enforce RBAC invariants.
            </p>
          </Link>

          <Link
            to="/admin/audit-logs"
            className="group p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-purple-500/40 transition-all backdrop-blur-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-semibold text-white group-hover:text-purple-400 transition-colors flex items-center justify-between">
              Immutable Audit Explorer
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h4>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Inspect tamper-proof audit records for every status change, password reset, and role assignment.
            </p>
          </Link>
        </div>

        {/* Recent Platform Audit Trail */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">Recent Security &amp; Administrative Events</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time append-only stream of platform actions
              </p>
            </div>
            <Link
              to="/admin/audit-logs"
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
            >
              <span>View full log</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="pb-3 pl-2">Timestamp</th>
                  <th className="pb-3">Action</th>
                  <th className="pb-3">Actor</th>
                  <th className="pb-3">Target</th>
                  <th className="pb-3">Outcome</th>
                  <th className="pb-3 pr-2">Reason Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {recentAudits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentAudits.map((event) => (
                    <tr key={event.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pl-2 text-slate-400 font-mono">
                        {new Date(event.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 font-semibold text-white font-mono">
                        {event.action}
                      </td>
                      <td className="py-3 text-slate-300">{event.actorName}</td>
                      <td className="py-3 text-slate-300">{event.targetName}</td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            event.outcome === 'success'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : event.outcome === 'denied'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {event.outcome}
                        </span>
                      </td>
                      <td className="py-3 pr-2 font-mono text-slate-400 text-[11px]">
                        {event.reasonCode || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
