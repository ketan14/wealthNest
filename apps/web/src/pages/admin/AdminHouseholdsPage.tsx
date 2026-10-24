import { useState, useEffect, useCallback } from 'react';
import {
  Home,
  Search,
  Users,
  ShieldCheck,
  Calendar,
  Lock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AdminHeader } from '../../components/admin/AdminHeader';
import { adminAdapter } from '../../lib/supabase/admin.adapter';
import { AdminHouseholdSummary } from '@wealthnest/domain';

export function AdminHouseholdsPage() {
  const [households, setHouseholds] = useState<AdminHouseholdSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchHouseholds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAdapter.listHouseholds({
        page,
        limit: 10,
        search: search.trim() || undefined,
      });
      setHouseholds(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchHouseholds();
  }, [fetchHouseholds]);

  return (
    <div className="flex-1 flex flex-col">
      <AdminHeader
        title="Multi-User Household Tenants"
        subtitle="Oversight of family collectives, primary owners, and seat membership quotas"
      />

      <div className="p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Financial Confidentiality Callout */}
        <div className="p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white tracking-wide uppercase">
              Tenant Data Isolation Principle
            </h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Platform administration is strictly scoped to tenant metadata (name, primary owner, and member counts).
              In accordance with WealthNest core architecture, consolidated family net worth, holdings, and liabilities
              are accessible strictly to authorized household members and remain completely private from platform staff.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search households by family or tenant name..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Households Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-12 text-center text-slate-500 text-xs">
              Loading household tenant records...
            </div>
          ) : households.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 text-xs">
              No households found matching query.
            </div>
          ) : (
            households.map((h) => (
              <div
                key={h.id}
                className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between hover:border-cyan-500/30 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold">
                      <Home className="w-5 h-5" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck className="w-3 h-3" />
                      Active Tenant
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white tracking-tight">{h.name}</h3>
                  <div className="text-xs text-slate-400 mt-1">
                    Primary Owner: <span className="text-slate-200 font-medium">{h.createdByName}</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>{h.memberCount} members</span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {new Date(h.createdAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Households Pagination Footer */}
        {total > 10 && (
          <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex items-center justify-between text-xs text-slate-400">
            <div>Total Households: {total}</div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
                Previous
              </button>
              <button
                disabled={page * 10 >= total}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

