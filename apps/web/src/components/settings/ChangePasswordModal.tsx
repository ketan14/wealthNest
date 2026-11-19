import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ResponsiveModalShell } from '@/components/ui/ResponsiveModalShell';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase/client';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_HINT,
  type PasswordChangeErrors,
  validatePasswordChange,
} from '@/lib/validation/password';
import { AlertCircle, Check, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, X } from 'lucide-react';

interface ChangePasswordModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSuccess?: () => void;
}

/**
 * Modal for changing the active Supabase account password with show/hide toggles,
 * live complexity checklist, and instant confirmation mismatch feedback.
 */
export function ChangePasswordModal({ isOpen, onClose, onSuccess }: ChangePasswordModalProps) {
  const titleId = useId();
  const passwordInputId = useId();
  const confirmInputId = useId();
  const passwordRef = useRef<HTMLInputElement | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<PasswordChangeErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirm(false);
    setSubmitting(false);
    setErrors({});
    setServerError(null);

    const timer = window.setTimeout(() => {
      passwordRef.current?.focus();
    }, 10);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  const rules = useMemo(
    () => [
      { id: 'len', label: `${PASSWORD_MIN_LENGTH}+ chars`, met: password.length >= PASSWORD_MIN_LENGTH },
      { id: 'upper', label: 'Uppercase', met: /[A-Z]/.test(password) },
      { id: 'lower', label: 'Lowercase', met: /[a-z]/.test(password) },
      { id: 'num', label: 'Number', met: /[0-9]/.test(password) },
      { id: 'sym', label: 'Symbol', met: /[^A-Za-z0-9]/.test(password) },
    ],
    [password]
  );

  const liveMismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const confirmMatches = confirmPassword.length > 0 && confirmPassword === password;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setServerError(null);

    const validationErrors = validatePasswordChange(password, confirmPassword);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setServerError(error.message || 'Unable to update password. Please try again.');
        return;
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : 'Unable to update password. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveModalShell
      portal
      variant="center"
      role="dialog"
      ariaLabelledBy={titleId}
      panelClassName="max-w-md bg-slate-900 border-slate-800"
      onBackdropClick={() => {
        if (!submitting) onClose();
      }}
      onPanelKeyDown={(e) => {
        if (e.key === 'Escape' && !submitting) {
          e.stopPropagation();
          onClose();
        }
      }}
      header={
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-400" />
            <h3 id={titleId} className="text-sm font-semibold text-white">
              Change Password
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close dialog"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      }
      formProps={{
        onSubmit: handleSubmit,
        noValidate: true,
      }}
      bodyClassName="p-4 space-y-3.5"
      footer={
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-800 bg-slate-950/50">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={submitting}
            className="h-8 text-xs text-slate-300 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={submitting}
            className="h-8 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Password'
            )}
          </Button>
        </div>
      }
    >
      {serverError && (
        <div
          role="alert"
          className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{serverError}</span>
        </div>
      )}

      <div>
        <label htmlFor={passwordInputId} className="block text-xs font-medium text-slate-300 mb-1">
          New Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <input
            ref={passwordRef}
            id={passwordInputId}
            name="newPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            disabled={submitting}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            placeholder={PASSWORD_POLICY_HINT}
            className={`w-full h-9 pl-8 pr-9 rounded-lg bg-slate-950 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
              errors.password
                ? 'border-rose-500/80 focus:border-rose-500'
                : 'border-slate-800 focus:border-emerald-500'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide new password' : 'Show new password'}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 hover:text-slate-300"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {errors.password}
          </p>
        )}

        {/* Live Complexity Checklist */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mt-2" aria-label="Password requirements">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-colors ${
                rule.met
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-950/80 border-slate-800 text-slate-500'
              }`}
            >
              <Check className={`w-2.5 h-2.5 shrink-0 ${rule.met ? 'text-emerald-400' : 'text-slate-600'}`} />
              <span className="truncate">{rule.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor={confirmInputId} className="block text-xs font-medium text-slate-300 mb-1">
          Confirm New Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <input
            id={confirmInputId}
            name="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            disabled={submitting}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errors.confirmPassword) {
                setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }
            }}
            placeholder="Re-enter new password"
            className={`w-full h-9 pl-8 pr-9 rounded-lg bg-slate-950 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
              liveMismatch || errors.confirmPassword
                ? 'border-rose-500/80 focus:border-rose-500'
                : confirmMatches
                  ? 'border-emerald-500/60 focus:border-emerald-500'
                  : 'border-slate-800 focus:border-emerald-500'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((prev) => !prev)}
            aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 hover:text-slate-300"
          >
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {(liveMismatch || errors.confirmPassword) && (
          <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {errors.confirmPassword || 'Passwords do not match'}
          </p>
        )}
        {!liveMismatch && !errors.confirmPassword && confirmMatches && (
          <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            Passwords match
          </p>
        )}
      </div>
    </ResponsiveModalShell>
  );
}
