import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  UserPlus,
  KeyRound,
  ShieldAlert,
  UserCheck,
  UserX,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
  CheckCircle2,
} from 'lucide-react';
import { AdminHeader } from '../../components/admin/AdminHeader';
import { adminAdapter } from '../../lib/supabase/admin.adapter';
import { useAdmin } from '../../lib/admin/admin-context';
import {
  AdminUserSummary,
  UserAccessStatus,
  PlatformRole,
  validateStatusChange,
} from '@wealthnest/domain';

export function AdminUsersPage() {
  const { adminActor, isSuperAdmin, isSupportAdmin } = useAdmin();

  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [statusModalUser, setStatusModalUser] = useState<AdminUserSummary | null>(null);
  const [newStatus, setNewStatus] = useState<UserAccessStatus>('suspended');
  const [reasonCode, setReasonCode] = useState('SECURITY_INCIDENT');
  const [reasonDetails, setReasonDetails] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<PlatformRole | ''>('');

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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenStatusModal = (user: AdminUserSummary) => {
    setStatusModalUser(user);
    setNewStatus(user.status === 'suspended' ? 'active' : 'suspended');
    setReasonCode(user.status === 'suspended' ? 'REMEDIAL_ACTION_COMPLETE' : 'SUSPICIOUS_LOGIN_ATTEMPTS');
    setReasonDetails('');
    setModalError(null);
  };

  const handleApplyStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalUser || !adminActor) return;

    // Validate using domain invariants
    const validation = validateStatusChange(
      adminActor.userId,
      statusModalUser.id,
      newStatus,
      reasonCode
    );

    if (!validation.allowed) {
      setModalError(validation.reason || 'Status change disallowed');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      await adminAdapter.setUserStatus(
        statusModalUser.id,
        newStatus,
        reasonCode,
        reasonDetails.trim() || undefined
      );

      await adminAdapter.recordLog({
        actorUserId: adminActor.userId,
        actorName: adminActor.displayName,
        targetUserId: statusModalUser.id,
        targetName: statusModalUser.displayName,
        action: 'USER_STATUS_CHANGE',
        outcome: 'success',
        reasonCode,
        safeMetadata: { newStatus, reasonDetails },
      });

      showToast(`User ${statusModalUser.displayName} marked as ${newStatus}`);
      setStatusModalUser(null);
      fetchUsers();
    } catch (err: any) {
      setModalError(err.message || 'Failed to update user status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !adminActor) return;

    setIsSubmitting(true);
    try {
      const displayName = inviteName.trim() || inviteEmail.split('@')[0] || 'Investor';
      await adminAdapter.inviteUser(
        inviteEmail.trim(),
        displayName,
        inviteRole || undefined
      );

      await adminAdapter.recordLog({
        actorUserId: adminActor.userId,
        actorName: adminActor.displayName,
        targetName: displayName,
        action: 'USER_INVITED',
        outcome: 'success',
        reasonCode: 'ONBOARDING_INVITATION',
        safeMetadata: { email: inviteEmail, role: inviteRole },
      });


      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('');
      showToast(`Invitation sent to ${inviteEmail}`);
      fetchUsers();
    } catch (err: any) {
      setModalError(err.message || 'Failed to invite user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async (user: AdminUserSummary) => {
    if (!confirm(`Trigger an administrative password reset email for ${user.displayName} (${user.email})?`)) {
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
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/20 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite Investor</span>
            </button>
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
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      Loading user records...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No users match the active search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
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
                  ))
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
      </div>

      {/* Status Change Modal */}
      {statusModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-white text-base">
                  Change Account Lifecycle Status
                </h3>
              </div>
              <button
                onClick={() => setStatusModalUser(null)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyStatusChange} className="mt-5 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Target Account
                </label>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white flex items-center justify-between">
                  <span className="font-semibold">{statusModalUser.displayName}</span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {statusModalUser.email}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  New Lifecycle Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as UserAccessStatus)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                >
                  <option value="active">Active (Full Access)</option>
                  <option value="suspended">Suspended (Access Temporarily Blocked)</option>
                  <option value="deactivated">Deactivated (Permanent Offboarding)</option>
                </select>
              </div>

              {(newStatus === 'suspended' || newStatus === 'deactivated') && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Mandatory Reason Code <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                  >
                    <option value="SUSPICIOUS_LOGIN_ATTEMPTS">Suspicious Login Attempts / MFA Failures</option>
                    <option value="POLICY_VIOLATION">Terms of Service / Policy Violation</option>
                    <option value="FRAUD_PREVENTION">Fraud Prevention / AML Review</option>
                    <option value="USER_REQUEST">Voluntary User Request</option>
                    <option value="PAYMENT_FAILURE">Billing or Subscription Delinquency</option>
                    <option value="SECURITY_INCIDENT">Active Security Incident Investigation</option>
                    <option value="OTHER">Other Administrative Reason</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Reason Notes (Optional / Appended to Audit Log)
                </label>
                <textarea
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                  rows={3}
                  placeholder="Provide supporting context for compliance and audit trail..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setStatusModalUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Confirm Status Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-white text-base">Invite New Investor</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteUser} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Email Address <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. krisha.vaghela@wealthnest.local"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Display / Investor Name
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Krisha Vaghela"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
                />
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Initial Platform Role (Optional)
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole((e.target.value as PlatformRole) || '')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                  >
                    <option value="">No Platform Role (Standard Investor)</option>
                    <option value="support_admin">Support Admin</option>
                    <option value="auditor">Compliance Auditor</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Inviting...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
