import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Users,
  CheckCircle2,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { AdminHeader } from '../../components/admin/AdminHeader';
import { adminAdapter } from '../../lib/supabase/admin.adapter';
import { useAdmin } from '../../lib/admin/admin-context';
import {
  AdminUserSummary,
  PlatformRole,
  canManagePlatformRole,
  validateRoleRevocation,
} from '@wealthnest/domain';

export function AdminRolesPage() {
  const { adminActor, isSuperAdmin } = useAdmin();

  const [staffUsers, setStaffUsers] = useState<AdminUserSummary[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Grant role state
  const [allUsers, setAllUsers] = useState<AdminUserSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [targetRole, setTargetRole] = useState<PlatformRole>('support_admin');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadStaff = useCallback(async () => {
    try {
      const res = await adminAdapter.listUsers({ page: 1, limit: 50 });
      setAllUsers(res.items);
      const staff = res.items.filter((u) => u.platformRole !== undefined);
      setStaffUsers(staff);
      if (res.items.length > 0 && res.items[0] && !selectedUserId) {
        setSelectedUserId(res.items[0].id);
      }
    } catch {
      // Ignored
    }
  }, [selectedUserId]);


  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleGrantRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminActor || !selectedUserId) return;

    if (!canManagePlatformRole(adminActor.role)) {
      setErrorMessage('Access Denied: Only super_admin can grant or revoke platform roles');
      return;
    }

    const targetUser = allUsers.find((u) => u.id === selectedUserId);
    if (!targetUser) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await adminAdapter.managePlatformRole(selectedUserId, targetRole, 'grant');

      await adminAdapter.recordLog({
        actorUserId: adminActor.userId,
        actorName: adminActor.displayName,
        targetUserId: selectedUserId,
        targetName: targetUser.displayName,
        action: 'ROLE_GRANTED',
        outcome: 'success',
        reasonCode: 'PLATFORM_RBAC_ASSIGNMENT',
        safeMetadata: { role: targetRole },
      });

      showToast(`Granted ${targetRole} to ${targetUser.displayName}`);
      loadStaff();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to grant role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeRole = async (user: AdminUserSummary) => {
    if (!adminActor || !user.platformRole) return;

    if (!canManagePlatformRole(adminActor.role)) {
      showToast('Access Denied: Only super_admin can revoke platform roles');
      return;
    }

    const superAdminCount = staffUsers.filter((u) => u.platformRole === 'super_admin').length;
    const validation = validateRoleRevocation(user.platformRole, superAdminCount);

    if (!validation.allowed) {
      alert(validation.reason);
      return;
    }

    if (!confirm(`Revoke ${user.platformRole} privileges from ${user.displayName}?`)) {
      return;
    }

    try {
      await adminAdapter.managePlatformRole(user.id, user.platformRole, 'revoke');

      await adminAdapter.recordLog({
        actorUserId: adminActor.userId,
        actorName: adminActor.displayName,
        targetUserId: user.id,
        targetName: user.displayName,
        action: 'ROLE_REVOKED',
        outcome: 'success',
        reasonCode: 'PLATFORM_RBAC_REVOCATION',
        safeMetadata: { role: user.platformRole },
      });

      showToast(`Revoked ${user.platformRole} from ${user.displayName}`);
      loadStaff();
    } catch (err: any) {
      showToast(err.message || 'Failed to revoke role');
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <AdminHeader
        title="Staff Entitlements &amp; Role-Based Access Control"
        subtitle="Govern administrative authorization levels, privilege separation, and super-admin invariants"
      />

      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs backdrop-blur-md animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="p-8 space-y-8 max-w-7xl w-full mx-auto">
        {/* RBAC Matrix Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 border border-emerald-500/30 rounded-2xl p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                Super Admin
              </span>
              <Lock className="w-4 h-4 text-emerald-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Full Platform Governance</h4>
            <ul className="text-xs text-slate-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">&bull;</span>
                Grant &amp; revoke staff administrative roles
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">&bull;</span>
                Suspend, reactivate, or offboard any account
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">&bull;</span>
                Inspect immutable system-wide audit trail
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">&bull;</span>
                Protected by Last-Admin Invariant
              </li>
            </ul>
          </div>

          <div className="bg-slate-900/60 border border-cyan-500/30 rounded-2xl p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
                Support Admin
              </span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">User Operations &amp; Support</h4>
            <ul className="text-xs text-slate-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">&bull;</span>
                Manage user lifecycle (suspension &amp; recovery)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">&bull;</span>
                Trigger administrative password resets
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">&bull;</span>
                Issue onboarding invitations
              </li>
              <li className="flex items-start gap-2 text-slate-500">
                <span className="font-bold">&times;</span>
                Cannot assign or revoke platform roles
              </li>
            </ul>
          </div>

          <div className="bg-slate-900/60 border border-purple-500/30 rounded-2xl p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/30 font-mono">
                Compliance Auditor
              </span>
              <ShieldCheck className="w-4 h-4 text-purple-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Read-Only Telemetry</h4>
            <ul className="text-xs text-slate-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">&bull;</span>
                Inspect immutable append-only audit trail
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">&bull;</span>
                Verify compliance with isolation boundaries
              </li>
              <li className="flex items-start gap-2 text-slate-500">
                <span className="font-bold">&times;</span>
                Strictly read-only; no modification rights
              </li>
            </ul>
          </div>
        </div>

        {/* Grant Role Form (Super Admin Only) */}
        {isSuperAdmin && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
            <h4 className="text-sm font-semibold text-white mb-2">Grant Platform Entitlement</h4>
            <p className="text-xs text-slate-400 mb-4">
              Select an investor account and assign elevated administrative capabilities.
            </p>

            {errorMessage && (
              <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleGrantRole} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Target Account
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                >
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Platform Role
                </label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as PlatformRole)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                >
                  <option value="support_admin">Support Admin</option>
                  <option value="auditor">Compliance Auditor</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
                >
                  {submitting ? 'Granting...' : 'Assign Entitlement'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Current Platform Staff Table */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">Active Platform Administrative Staff</h4>
            <span className="text-xs text-slate-400 font-mono">{staffUsers.length} active roles</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium">
                  <th className="py-3.5 pl-6">Staff Member</th>
                  <th className="py-3.5">Assigned Platform Role</th>
                  <th className="py-3.5">Status</th>
                  <th className="py-3.5">Member Since</th>
                  <th className="py-3.5 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {staffUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 pl-6">
                      <div className="font-semibold text-white">{u.displayName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                    </td>

                    <td className="py-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider font-mono ${
                          u.platformRole === 'super_admin'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : u.platformRole === 'support_admin'
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                        }`}
                      >
                        {u.platformRole?.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    </td>

                    <td className="py-3.5 text-slate-400 font-mono">
                      {new Date(u.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="py-3.5 pr-6 text-right">
                      {isSuperAdmin && (
                        <button
                          onClick={() => handleRevokeRole(u)}
                          className="px-3 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-medium border border-rose-500/30 transition-all"
                        >
                          Revoke Role
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
