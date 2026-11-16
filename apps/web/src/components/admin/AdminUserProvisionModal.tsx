import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Mail,
  X,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { PlatformRole } from '@wealthnest/domain';
import { resolveAppRedirectUrl } from '../../lib/config/app-redirect-url';
import { adminAdapter } from '../../lib/supabase/admin.adapter';
import {
  generateStrongPassword,
  PASSWORD_POLICY_HINT,
  validatePasswordComplexity,
} from '../../lib/validation/password';
import { ResponsiveModalShell } from '@/components/ui/ResponsiveModalShell';

interface AdminUserProvisionModalProps {
  isOpen: boolean;
  initialMode: 'create' | 'invite';
  isSuperAdmin: boolean;
  adminActor: { userId: string; displayName: string } | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function AdminUserProvisionModal({
  isOpen,
  initialMode,
  isSuperAdmin,
  adminActor,
  onClose,
  onSuccess,
}: AdminUserProvisionModalProps) {
  const [modalMode, setModalMode] = useState<'create' | 'invite'>(initialMode);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [inviteRole, setInviteRole] = useState<PlatformRole | ''>('');
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
    displayName: string;
    role?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setModalMode(initialMode);
    setModalError(null);
    setCreatedCredentials(null);
    setUserPassword('');
    setShowPassword(false);
    setCopied(false);
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleGeneratePassword = () => {
    setUserPassword(generateStrongPassword(16));
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = [
      'WealthNest Account Credentials:',
      `Login URL: ${resolveAppRedirectUrl('/login')}`,
      `Email: ${createdCredentials.email}`,
      `Password: ${createdCredentials.password}`,
      createdCredentials.role ? `Role: ${createdCredentials.role}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !adminActor) return;

    setIsSubmitting(true);
    setModalError(null);
    try {
      const displayName = inviteName.trim() || inviteEmail.split('@')[0] || 'Investor';
      await adminAdapter.inviteUser(inviteEmail.trim(), displayName, inviteRole || undefined);

      await adminAdapter.recordLog({
        actorUserId: adminActor.userId,
        actorName: adminActor.displayName,
        targetName: displayName,
        action: 'USER_INVITED',
        outcome: 'success',
        reasonCode: 'ONBOARDING_INVITATION',
        safeMetadata: { email: inviteEmail, role: inviteRole },
      });

      const sentEmail = inviteEmail;
      setInviteEmail('');
      setInviteName('');
      setInviteRole('');
      onSuccess(`Invitation sent to ${sentEmail}`);
      onClose();
    } catch (err: any) {
      setModalError(err.message || 'Failed to invite user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !adminActor) return;
    const passwordError = validatePasswordComplexity(userPassword);
    if (passwordError) {
      setModalError(passwordError);
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      const displayName = inviteName.trim() || inviteEmail.split('@')[0] || 'Investor';
      await adminAdapter.createUserDirectly(
        inviteEmail.trim(),
        userPassword,
        displayName,
        inviteRole || undefined
      );

      await adminAdapter.recordLog({
        actorUserId: adminActor.userId,
        actorName: adminActor.displayName,
        targetName: displayName,
        action: 'USER_CREATED',
        outcome: 'success',
        reasonCode: 'DIRECT_ADMIN_PROVISIONING',
        safeMetadata: { email: inviteEmail.trim(), role: inviteRole },
      });

      setCreatedCredentials({
        email: inviteEmail.trim(),
        password: userPassword,
        displayName,
        role: inviteRole || 'Standard Investor',
      });
      onSuccess(`Account created for ${inviteEmail.trim()}`);
    } catch (err: any) {
      setModalError(err.message || 'Failed to create user account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveModalShell
      role="dialog"
      ariaLabelledBy="admin-provision-title"
      backdropClassName="bg-slate-950/80"
      panelClassName="max-w-lg bg-slate-900 border-slate-800 animate-in fade-in zoom-in-95"
      formProps={
        createdCredentials
          ? undefined
          : { onSubmit: modalMode === 'create' ? handleCreateUser : handleInviteUser }
      }
      header={
        <div className="flex items-center justify-between gap-2 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                modalMode === 'create'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-cyan-500/10 text-cyan-400'
              }`}
            >
              {modalMode === 'create' ? (
                <UserPlus className="w-4 h-4" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <h3 id="admin-provision-title" className="font-semibold text-white text-base">
                {modalMode === 'create' ? 'Create Investor Account' : 'Invite New Investor'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {modalMode === 'create'
                  ? 'Provision account immediately with password credentials'
                  : 'Dispatch an onboarding invitation link via email'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      }
      bodyClassName="p-4 sm:p-6"
      footer={
        createdCredentials ? (
          <div className="px-4 py-3 sm:px-6 border-t border-slate-800 flex flex-wrap items-center justify-end gap-3 bg-slate-900">
            <button
              type="button"
              onClick={handleCopyCredentials}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors min-h-[36px]"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Credentials'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatedCredentials(null);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors min-h-[36px]"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 sm:px-6 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-900">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium min-h-[36px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-md disabled:opacity-50 transition-colors min-h-[36px] ${
                modalMode === 'create'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-cyan-600 hover:bg-cyan-500'
              }`}
            >
              {isSubmitting
                ? modalMode === 'create'
                  ? 'Creating...'
                  : 'Inviting...'
                : modalMode === 'create'
                  ? 'Create Account'
                  : 'Send Invitation'}
            </button>
          </div>
        )
      }
    >
      {/* Success View: Display Created Credentials */}
      {createdCredentials ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Account Provisioned Successfully!</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              The account is active and ready. Copy these credentials to share with the user:
            </p>

            <div className="mt-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-mono space-y-1.5 select-all break-all">
              <div>
                <span className="text-slate-500">Email:</span>{' '}
                <span className="text-white font-medium">{createdCredentials.email}</span>
              </div>
              <div>
                <span className="text-slate-500">Password:</span>{' '}
                <span className="text-emerald-400 font-semibold">
                  {createdCredentials.password}
                </span>
              </div>
              {createdCredentials.role && (
                <div>
                  <span className="text-slate-500">Role:</span>{' '}
                  <span className="text-cyan-400">{createdCredentials.role}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Mode Selector Tabs */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setModalMode('create');
                setModalError(null);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                modalMode === 'create'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span>Direct Create (with Password)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModalMode('invite');
                setModalError(null);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                modalMode === 'invite'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span>Send Invite Link</span>
            </button>
          </div>

          {modalError && (
            <div className="mt-3 p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Email Address <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. krisha.vaghela@wealthnest.local"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                />
              </div>

              {/* Password Field (Only for Direct Create) */}
              {modalMode === 'create' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-400">
                      Account Password <span className="text-emerald-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Generate Password</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder={PASSWORD_POLICY_HINT}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 pr-10 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {isSuperAdmin && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Initial Platform Role (Optional)
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole((e.target.value as PlatformRole) || '')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                  >
                    <option value="">No Platform Role (Standard Investor)</option>
                    <option value="support_admin">Support Admin</option>
                    <option value="auditor">Compliance Auditor</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              )}
          </div>
        </>
      )}
    </ResponsiveModalShell>
  );
}
