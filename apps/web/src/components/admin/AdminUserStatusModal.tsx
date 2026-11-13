import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertCircle, X } from 'lucide-react';
import {
  AdminUserSummary,
  UserAccessStatus,
  validateStatusChange,
} from '@wealthnest/domain';
import { adminAdapter } from '../../lib/supabase/admin.adapter';

interface AdminUserStatusModalProps {
  user: AdminUserSummary | null;
  adminActor: { userId: string; displayName: string } | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function AdminUserStatusModal({
  user,
  adminActor,
  onClose,
  onSuccess,
}: AdminUserStatusModalProps) {
  const [newStatus, setNewStatus] = useState<UserAccessStatus>('suspended');
  const [reasonCode, setReasonCode] = useState('SECURITY_INCIDENT');
  const [reasonDetails, setReasonDetails] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setNewStatus(user.status === 'suspended' ? 'active' : 'suspended');
    setReasonCode(
      user.status === 'suspended' ? 'REMEDIAL_ACTION_COMPLETE' : 'SUSPICIOUS_LOGIN_ATTEMPTS'
    );
    setReasonDetails('');
    setModalError(null);
  }, [user]);

  if (!user) return null;

  const handleApplyStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminActor) return;

    const validation = validateStatusChange(adminActor.userId, user.id, newStatus, reasonCode);
    if (!validation.allowed) {
      setModalError(validation.reason || 'Status change disallowed');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      await adminAdapter.setUserStatus(
        user.id,
        newStatus,
        reasonCode,
        reasonDetails.trim() || undefined
      );

      await adminAdapter.recordLog({
        actorUserId: adminActor.userId,
        actorName: adminActor.displayName,
        targetUserId: user.id,
        targetName: user.displayName,
        action: 'USER_STATUS_CHANGE',
        outcome: 'success',
        reasonCode,
        safeMetadata: { newStatus, reasonDetails },
      });

      onSuccess(`User ${user.displayName} marked as ${newStatus}`);
      onClose();
    } catch (err: any) {
      setModalError(err.message || 'Failed to update user status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
          <button onClick={onClose} className="text-slate-500 hover:text-white">
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
            <label className="block text-xs font-medium text-slate-400 mb-1">Target Account</label>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white flex items-center justify-between">
              <span className="font-semibold">{user.displayName}</span>
              <span className="text-slate-400 font-mono text-[11px]">{user.email}</span>
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
                <option value="SUSPICIOUS_LOGIN_ATTEMPTS">
                  Suspicious Login Attempts / MFA Failures
                </option>
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
              onClick={onClose}
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
  );
}

