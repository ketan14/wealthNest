import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  UserPlus,
  KeyRound,
  UserCheck,
  UserX,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Mail,
  Crown,
  XCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { AdminHeader } from '../../components/admin/AdminHeader';
import { AdminUserStatusModal } from '../../components/admin/AdminUserStatusModal';
import { AdminUserProvisionModal } from '../../components/admin/AdminUserProvisionModal';
import { AdminUserPlanModal, AdminPlanTarget } from '../../components/admin/AdminUserPlanModal';
import { adminAdapter } from '../../lib/supabase/admin.adapter';
import { useAdmin } from '../../lib/admin/admin-context';
import {
  AdminUserSummary,
  UserAccessStatus,
  PlatformRole,
  PLAN_ENTITLEMENTS,
  PlanTier,
  PlanUpgradeRequest,
  normalizePlanTier,
} from '@wealthnest/domain';

export function AdminUsersPage() {
  const { adminActor, isSuperAdmin, isSupportAdmin } = useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get('view') === 'requests' ? 'requests' : 'directory';
  const [activeView, setActiveView] = useState<'directory' | 'requests'>(initialView);

  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [upgradeRequests, setUpgradeRequests] = useState<PlanUpgradeRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [planFilter, setPlanFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [statusModalUser, setStatusModalUser] = useState<AdminUserSummary | null>(null);
  const [planModalTarget, setPlanModalTarget] = useState<AdminPlanTarget | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'invite'>('create');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAdapter.listUsers({
        page,
        limit,
        search: search.trim() || undefined,
        status: (statusFilter as UserAccessStatus) || undefined,
        role: (roleFilter as PlatformRole) || undefined,
      });
      setUsers(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, roleFilter]);

  const fetchUpgradeRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const list = await adminAdapter.listUpgradeRequests();
      setUpgradeRequests(list);
    } catch {
      setUpgradeRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchUpgradeRequests();
  }, [fetchUpgradeRequests]);

  const handleReviewUpgradeRequest = async (
    req: PlanUpgradeRequest,
    decision: 'approved' | 'rejected'
  ) => {
    setReviewingRequestId(req.id);
    try {
      await adminAdapter.reviewUpgradeRequest(req.id, decision);
      const targetPlanName = PLAN_ENTITLEMENTS[req.requestedPlan].name;
      showToast(
        decision === 'approved'
          ? `Approved upgrade for "${req.requesterName}" to ${targetPlanName}`
          : `Declined upgrade request for "${req.requesterName}"`
      );
      await Promise.all([fetchUpgradeRequests(), fetchUsers()]);
    } catch (err: any) {
      showToast(err?.message || 'Failed to process upgrade request');
    } finally {
      setReviewingRequestId(null);
    }
  };

  const handleOpenStatusModal = (user: AdminUserSummary) => {
    setStatusModalUser(user);
  };

  const handlePasswordReset = async (user: AdminUserSummary) => {
    if (
      !confirm(
        `Trigger an administrative password reset email for ${user.displayName} (${user.email})?`
      )
    ) {
      return;
    }

    try {
      await adminAdapter.requestPasswordReset(user.id);
      if (adminActor) {
        await adminAdapter.recordLog({
          actorUserId: adminActor.userId,
          actorName: adminActor.displayName,
          targetUserId: user.id,
          targetName: user.displayName,
          action: 'PASSWORD_RESET_REQUESTED',
          outcome: 'success',
          reasonCode: 'ADMIN_MANUAL_TRIGGER',
          safeMetadata: { email: user.email },
        });
      }
      showToast(`Password recovery instructions triggered for ${user.email}`);
    } catch {
      showToast(`Error triggering reset for ${user.email}`);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="flex-1 flex flex-col">
      <AdminHeader
        title="User Management &amp; Entitlements"
        subtitle="Manage user lifecycles, account suspensions, invitations, and password security"
        action={
          (isSuperAdmin || isSupportAdmin) && (
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  setModalMode('create');
                  setShowInviteModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create User</span>
              </button>
              <button
                onClick={() => {
                  setModalMode('invite');
                  setShowInviteModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-medium transition-all"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Invite Investor</span>
              </button>
            </div>
          )
        }
      />

      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs backdrop-blur-md animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Directory / Upgrade Requests View Switcher */}
        {(() => {
          const pendingCount = upgradeRequests.filter((r) => r.status === 'pending').length;
          return (
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <button
                type="button"
                onClick={() => {
                  setActiveView('directory');
                  setSearchParams({}, { replace: true });
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  activeView === 'directory'
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                User Directory ({total})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveView('requests');
                  setSearchParams({ view: 'requests' }, { replace: true });
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-2 ${
                  activeView === 'requests'
                    ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>Upgrade Requests</span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono">
                    {pendingCount}
                  </span>
                )}
              </button>
            </div>
          );
        })()}

        {activeView === 'requests' ? (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Plan Upgrade Request Queue</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Review user-submitted plan upgrades and approve or decline with audit tracking.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void fetchUpgradeRequests()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700"
              >
                Refresh
              </button>
            </div>

            <div className="divide-y divide-slate-800/70">
              {loadingRequests ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Loading upgrade requests...
                </div>
              ) : upgradeRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No plan upgrade requests found.
                </div>
              ) : (
                upgradeRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/20 transition-colors"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {req.requesterName}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {req.requesterEmail}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${
                            req.status === 'approved'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : req.status === 'rejected'
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {req.status === 'pending' && <Clock className="w-3 h-3" />}
                          {req.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2">
                        <span>Household: {req.householdName}</span>
                        <span>&middot;</span>
                        <span className="inline-flex items-center gap-1 font-medium text-indigo-300">
                          {PLAN_ENTITLEMENTS[req.currentPlan].name}
                          <ArrowRight className="w-3 h-3" />
                          <strong className="text-amber-300">
                            {PLAN_ENTITLEMENTS[req.requestedPlan].name}
                          </strong>
                        </span>
                      </div>
                      {req.userNotes && (
                        <p className="text-xs text-slate-400 italic">
                          &ldquo;{req.userNotes}&rdquo;
                        </p>
                      )}
                    </div>

                    {req.status === 'pending' && (isSuperAdmin || isSupportAdmin) && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={reviewingRequestId === req.id}
                          onClick={() => void handleReviewUpgradeRequest(req, 'approved')}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve &amp; Upgrade</span>
                        </button>
                        <button
                          type="button"
                          disabled={reviewingRequestId === req.id}
                          onClick={() => void handleReviewUpgradeRequest(req, 'rejected')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
        {/* Filters and Search Toolbar */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, email, or identifier..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 outline-none focus:border-cyan-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="invited">Invited</option>
              <option value="deactivated">Deactivated</option>
            </select>

            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 outline-none focus:border-cyan-500"
            >
              <option value="">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="support_admin">Support Admin</option>
              <option value="auditor">Auditor</option>
            </select>

            <select
              aria-label="Filter by plan"
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 outline-none focus:border-cyan-500"
            >
              <option value="">All Plans</option>
              <option value="free">Free Starter</option>
              <option value="pro">Pro Investor</option>
              <option value="family">Family Office</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium">
                  <th className="py-3.5 pl-6">Investor / User</th>
                  <th className="py-3.5">Status</th>
                  <th className="py-3.5">Plan</th>
                  <th className="py-3.5">Platform Role</th>
                  <th className="py-3.5">Households</th>
                  <th className="py-3.5">Registered</th>
                  <th className="py-3.5">Last Sign-in</th>
                  <th className="py-3.5 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      Loading user records...
                    </td>
                  </tr>
                ) : (planFilter
                    ? users.filter((u) => normalizePlanTier(u.planTier) === planFilter)
                    : users
                  ).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No users match the active search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  (planFilter
                    ? users.filter((u) => normalizePlanTier(u.planTier) === planFilter)
                    : users
                  ).map((u) => {
                    const userPlan: PlanTier = normalizePlanTier(u.planTier);
                    const planDef = PLAN_ENTITLEMENTS[userPlan];
                    return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-[11px] shrink-0">
                            {u.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white hover:text-cyan-400 transition-colors">
                              <Link to={`/admin/users/${u.id}`}>{u.displayName}</Link>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            u.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : u.status === 'suspended'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : u.status === 'invited'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.status === 'active'
                                ? 'bg-emerald-400'
                                : u.status === 'suspended'
                                  ? 'bg-rose-400'
                                  : u.status === 'invited'
                                    ? 'bg-amber-400'
                                    : 'bg-slate-500'
                            }`}
                          />
                          {u.status}
                        </span>
                      </td>

                      <td className="py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                            userPlan === 'family'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : userPlan === 'pro'
                                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                : 'bg-slate-800/80 text-slate-300 border-slate-700'
                          }`}
                        >
                          {planDef.shortLabel}
                        </span>
                      </td>

                      <td className="py-3.5">
                        {u.platformRole ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                            {u.platformRole.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3.5 text-slate-300">
                        {u.householdCount > 0 ? (
                          <span className="text-xs">{u.householdCount} household</span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">None</span>
                        )}
                      </td>

                      <td className="py-3.5 text-slate-400 font-mono">
                        {new Date(u.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="py-3.5 text-slate-400 font-mono">
                        {u.lastSignInAt
                          ? new Date(u.lastSignInAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Never'}
                      </td>

                      <td className="py-3.5 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/admin/users/${u.id}`}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                            title="Inspect User Details"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>

                          {(isSuperAdmin || isSupportAdmin) && (
                            <>
                              <button
                                onClick={() =>
                                  setPlanModalTarget({
                                    mode: 'user',
                                    id: u.id,
                                    name: u.displayName,
                                    subtitle: u.email,
                                    currentPlan: userPlan,
                                    currentPlanExpiresAt: u.planExpiresAt ?? null,
                                  })
                                }
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 transition-all"
                                title="Change Plan"
                                aria-label={`Change Plan for ${u.displayName}`}
                              >
                                <Crown className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleOpenStatusModal(u)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 transition-all"
                                title="Change Status / Suspend"
                              >
                                {u.status === 'suspended' ? (
                                  <UserCheck className="w-3.5 h-3.5" />
                                ) : (
                                  <UserX className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                onClick={() => handlePasswordReset(u)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 transition-all"
                                title="Send Password Reset"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing {users.length} of {total} registered users
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
                Previous
              </button>
              <span className="px-2 text-slate-500 font-mono">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
              </button>
            </div>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Status Change Modal */}
      <AdminUserStatusModal
        user={statusModalUser}
        adminActor={adminActor}
        onClose={() => setStatusModalUser(null)}
        onSuccess={(message) => {
          showToast(message);
          fetchUsers();
        }}
      />

      {/* Plan Change Modal */}
      <AdminUserPlanModal
        target={planModalTarget}
        onClose={() => setPlanModalTarget(null)}
        onSuccess={(message) => {
          showToast(message);
          fetchUsers();
        }}
      />

      {/* User Provisioning Modal (Direct Create or Send Invite) */}
      <AdminUserProvisionModal
        isOpen={showInviteModal}
        initialMode={modalMode}
        isSuperAdmin={isSuperAdmin}
        adminActor={adminActor}
        onClose={() => setShowInviteModal(false)}
        onSuccess={(message) => {
          showToast(message);
          fetchUsers();
        }}
      />
    </div>
  );
}
