import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  UserX,
  UserCheck,
  Home,
  Clock,
  Lock,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  Eye,
} from 'lucide-react';
import { AdminHeader } from '../../components/admin/AdminHeader';
import { ViewAsUserModal } from '../../components/admin/ViewAsUserModal';
import { adminAdapter } from '../../lib/supabase/admin.adapter';
import { useAdmin } from '../../lib/admin/admin-context';
import {
  AdminUserDetail,
  UserAccessStatus,
  PlatformRole,
  validateStatusChange,
} from '@wealthnest/domain';

export function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { adminActor, isSuperAdmin, isSupportAdmin } = useAdmin();


  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Status modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showViewAsUserModal, setShowViewAsUserModal] = useState(false);
  const [newStatus, setNewStatus] = useState<UserAccessStatus>('suspended');
  const [reasonCode, setReasonCode] = useState('SECURITY_INCIDENT');
  const [reasonDetails, setReasonDetails] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Role management state
  const [selectedRole, setSelectedRole] = useState<PlatformRole>('support_admin');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadUser = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await adminAdapter.getUserDetail(userId);
      setUserDetail(data);
      setNewStatus(data.status === 'suspended' ? 'active' : 'suspended');
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDetail || !adminActor) return;

    const validation = validateStatusChange(
      adminActor.userId,
      userDetail.id,
      newStatus,
      reasonCode
    );

    if (!validation.allowed) {
      setModalError(validation.reason || 'Status change prohibited');
      return;
    }

    setSubmitting(true);
    setModalError(null);
    try {
      await adminAdapter.setUserStatus(
        userDetail.id,
        newStatus,
        reasonCode,
        reasonDetails.trim() || undefined
      );

      await adminAdapter.recordLog({
        actorUserId: adminActor.userId,
        actorName: adminActor.displayName,
        targetUserId: userDetail.id,
        targetName: userDetail.displayName,
        action: 'USER_STATUS_CHANGE',
        outcome: 'success',
        reasonCode,
        safeMetadata: { newStatus, reasonDetails },
      });

      showToast(`User status updated to ${newStatus}`);
      setShowStatusModal(false);
      loadUser();
    } catch (err: any) {
      setModalError(err.message || 'Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!userDetail) return;
    if (!confirm(`Trigger an administrative password reset email for ${userDetail.displayName}?`)) {
      return;
    }

    try {
      await adminAdapter.requestPasswordReset(userDetail.id);
      if (adminActor) {
        await adminAdapter.recordLog({
          actorUserId: adminActor.userId,
          actorName: adminActor.displayName,
          targetUserId: userDetail.id,
          targetName: userDetail.displayName,
          action: 'PASSWORD_RESET_REQUESTED',
          outcome: 'success',
          reasonCode: 'ADMIN_MANUAL_TRIGGER',
          safeMetadata: { email: userDetail.email },
        });
      }
      showToast(`Password recovery instructions triggered for ${userDetail.email}`);

    } catch {
      showToast('Error requesting password reset');
    }
  };

  const handleRoleToggle = async (action: 'grant' | 'revoke') => {
    if (!userDetail || !adminActor) return;

    const roleToApply = action === 'grant' ? selectedRole : userDetail.platformRole;
    if (!roleToApply) return;

    if (
      !confirm(
        `${action === 'grant' ? 'Grant' : 'Revoke'} ${roleToApply} entitlement for ${
          userDetail.displayName
        }?`
      )
    ) {
      return;
    }

    try {
      await adminAdapter.managePlatformRole(userDetail.id, roleToApply, action);
      await adminAdapter.recordLog({
        actorUserId: adminActor.userId,
        actorName: adminActor.displayName,
        targetUserId: userDetail.id,
        targetName: userDetail.displayName,
        action: action === 'grant' ? 'ROLE_GRANTED' : 'ROLE_REVOKED',
        outcome: 'success',
        reasonCode: 'PLATFORM_RBAC_MANAGEMENT',
        safeMetadata: { role: roleToApply, action },
      });
      showToast(`Role ${roleToApply} successfully ${action}ed`);
      loadUser();
    } catch (err: any) {
      showToast(err.message || `Failed to ${action} role`);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        <Clock className="w-6 h-6 animate-spin mr-3 text-cyan-400" />
        <span>Loading user record...</span>
      </div>
    );
  }

  if (!userDetail) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>User record could not be found.</p>
        <Link to="/admin/users" className="text-cyan-400 underline mt-2 inline-block">
          Return to user directory
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <AdminHeader
        title={`User: ${userDetail.displayName}`}
        subtitle={`Account ID: ${userDetail.id}`}
        action={
          <Link
            to="/admin/users"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Users</span>
          </Link>
        }
      />

      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs backdrop-blur-md animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="p-8 space-y-8 max-w-6xl w-full mx-auto">
        {/* User Profile Header Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center font-bold text-white text-2xl shadow-xl">
                {userDetail.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {userDetail.displayName}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                      userDetail.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : userDetail.status === 'suspended'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : userDetail.status === 'invited'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        userDetail.status === 'active'
                          ? 'bg-emerald-400'
                          : userDetail.status === 'suspended'
                          ? 'bg-rose-400'
                          : 'bg-amber-400'
                      }`}
                    />
                    {userDetail.status}
                  </span>
                  {userDetail.platformRole && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                      {userDetail.platformRole.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 font-mono mt-1">{userDetail.email}</div>
                {userDetail.reasonCode && (
                  <div className="text-[11px] text-rose-400 font-mono mt-1.5">
                    Reason: {userDetail.reasonCode}{' '}
                    {userDetail.reasonDetails ? `(${userDetail.reasonDetails})` : ''}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {(isSuperAdmin || isSupportAdmin) && (
                <>
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-slate-700 transition-all"
                  >
                    {userDetail.status === 'suspended' ? (
                      <>
                        <UserCheck className="w-4 h-4 text-emerald-400" />
                        <span>Reactivate Account</span>
                      </>
                    ) : (
                      <>
                        <UserX className="w-4 h-4 text-rose-400" />
                        <span>Suspend Access</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handlePasswordReset}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold border border-slate-700 transition-all"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Trigger Password Reset</span>
                  </button>

                  {adminActor?.userId !== userDetail.id && (
                    <button
                      onClick={() => setShowViewAsUserModal(true)}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30 transition-all shadow-sm"
                    >
                      <Eye className="w-4 h-4 text-amber-400" />
                      <span>View Application as User</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/60 text-xs">
            <div>
              <div className="text-slate-500 text-[11px]">Registered Date</div>
              <div className="text-slate-300 font-mono mt-0.5">
                {new Date(userDetail.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px]">Last Sign-in</div>
              <div className="text-slate-300 font-mono mt-0.5">
                {userDetail.lastSignInAt
                  ? new Date(userDetail.lastSignInAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Never'}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px]">Default Currency</div>
              <div className="text-slate-300 font-mono mt-0.5">{userDetail.defaultCurrency}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px]">User UUID</div>
              <div className="text-slate-400 font-mono text-[10px] truncate" title={userDetail.id}>
                {userDetail.id}
              </div>
            </div>
          </div>
        </div>

        {/* Financial Isolation Security Notice */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white tracking-wide uppercase">
              Financial Data Confidentiality Boundary
            </h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              In strict accordance with WealthNest security architecture, private financial records
              (stock holdings, mutual funds, gold weights, bank deposits, loan liabilities, and goal
              allocations) are cryptographically isolated via PostgreSQL Row Level Security. Platform
              administrators cannot view, inspect, or query financial assets for this or any other user.
            </p>
          </div>
        </div>

        {/* Household Tenancy */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <Home className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-semibold text-white">Multi-User Household Tenancy</h4>
          </div>

          <div className="space-y-3">
            {userDetail.households.length === 0 ? (
              <p className="text-xs text-slate-500">Not currently assigned to any household tenant.</p>
            ) : (
              userDetail.households.map((h) => (
                <div
                  key={h.id}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">{h.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Household ID: <span className="font-mono text-slate-500">{h.id}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                      {h.householdRole.replace('_', ' ')}
                    </span>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {h.totalMembers} total members
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Platform RBAC Management (Super Admins Only) */}
        {isSuperAdmin && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-semibold text-white">Platform Staff Role Management</h4>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Super Admin Authorized
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Super Administrators can delegate administrative privileges to trusted staff accounts.
              Platform roles are independent of household memberships.
            </p>

            <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Assign Platform Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as PlatformRole)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg px-3 py-1.5 text-white outline-none focus:border-cyan-500"
                >
                  <option value="support_admin">Support Admin (User Lifecycle &amp; Resets)</option>
                  <option value="auditor">Compliance Auditor (Read-only Audit Log)</option>
                  <option value="super_admin">Super Admin (Full RBAC &amp; Platform Governance)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 mt-4 sm:mt-0">
                <button
                  onClick={() => handleRoleToggle('grant')}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-all shadow-md"
                >
                  Grant Role
                </button>
                {userDetail.platformRole && (
                  <button
                    onClick={() => handleRoleToggle('revoke')}
                    className="px-4 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white text-xs font-semibold border border-rose-500/30 transition-all"
                  >
                    Revoke Role
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Audit History for this Target User */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-purple-400" />
            <h4 className="text-sm font-semibold text-white">Target User Administrative Audit Trail</h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="pb-3 pl-2">Timestamp</th>
                  <th className="pb-3">Action</th>
                  <th className="pb-3">Actor</th>
                  <th className="pb-3">Outcome</th>
                  <th className="pb-3 pr-2">Reason Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {userDetail.recentAudits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No administrative actions logged targeting this account yet.
                    </td>
                  </tr>
                ) : (
                  userDetail.recentAudits.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pl-2 text-slate-400 font-mono">
                        {new Date(a.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 font-semibold text-white font-mono">{a.action}</td>
                      <td className="py-3 text-slate-300">{a.actorName}</td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            a.outcome === 'success'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {a.outcome}
                        </span>
                      </td>
                      <td className="py-3 pr-2 font-mono text-slate-400">{a.reasonCode || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-white text-base">
                  Update Account Status for {userDetail.displayName}
                </h3>
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStatusChange} className="mt-5 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  New Status
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
                  Supporting Details (Optional)
                </label>
                <textarea
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                  rows={3}
                  placeholder="Context recorded into immutable audit log..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Confirm Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View as User Support Modal */}
      <ViewAsUserModal
        isOpen={showViewAsUserModal}
        onClose={() => setShowViewAsUserModal(false)}
        targetUser={userDetail}
      />
    </div>
  );
}
