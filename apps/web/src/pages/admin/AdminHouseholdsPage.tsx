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
  Crown,
  CheckCircle2,
} from 'lucide-react';
import { AdminHeader } from '../../components/admin/AdminHeader';
import { AdminUserPlanModal, AdminPlanTarget } from '../../components/admin/AdminUserPlanModal';
import { adminAdapter } from '../../lib/supabase/admin.adapter';
import { useAdmin } from '../../lib/admin/admin-context';
import {
  AdminHouseholdSummary,
  PLAN_ENTITLEMENTS,
  hasCustomLimitOverrides,
  normalizePlanTier,
} from '@wealthnest/domain';

export function AdminHouseholdsPage() {
  const { isSuperAdmin, isSupportAdmin } = useAdmin();
  const [households, setHouseholds] = useState<AdminHouseholdSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [planModalTarget, setPlanModalTarget] = useState<AdminPlanTarget | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

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

      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs backdrop-blur-md animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

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
              Platform administration is strictly scoped to tenant metadata (name, primary owner,
              and member counts). In accordance with WealthNest core architecture, consolidated
              family net worth, holdings, and liabilities are accessible strictly to authorized
              household members and remain completely private from platform staff.
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
            households.map((h) => {
              const hhPlan = normalizePlanTier(h.planTier);
              const hhPlanDef = PLAN_ENTITLEMENTS[hhPlan];
              return (
                <div
                  key={h.id}
                  className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between hover:border-cyan-500/30 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4 gap-2">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold shrink-0">
                        <Home className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {hasCustomLimitOverrides(h.customLimits) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            Custom Limits
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${
                            hhPlan === 'family'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : hhPlan === 'pro'
                                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          <Crown className="w-3 h-3" />
                          {hhPlanDef.shortLabel}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <ShieldCheck className="w-3 h-3" />
                          Active
                        </span>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-white tracking-tight">{h.name}</h3>
                    <div className="text-xs text-slate-400 mt-1">
                      Primary Owner:{' '}
                      <span className="text-slate-200 font-medium">{h.createdByName}</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 gap-2">
                    <div className="flex items-center gap-3">
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

                    {(isSuperAdmin || isSupportAdmin) && (
                      <button
                        type="button"
                        onClick={() =>
                          setPlanModalTarget({
                            mode: 'household',
                            id: h.id,
                            name: h.name,
                            subtitle: `Owner: ${h.createdByName}`,
                            currentPlan: hhPlan,
                            currentCustomLimits: h.customLimits ?? null,
                            currentPlanExpiresAt: h.planExpiresAt ?? null,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-medium border border-slate-700 transition-colors shrink-0"
                      >
                        Change Plan
                      </button>
                    )}
                  </div>
                </div>
              );
            })
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

      <AdminUserPlanModal
        target={planModalTarget}
        onClose={() => setPlanModalTarget(null)}
        onSuccess={(message) => {
          showToast(message);
          fetchHouseholds();
        }}
      />
    </div>
  );
}
