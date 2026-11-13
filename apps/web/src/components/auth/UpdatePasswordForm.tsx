import React, { useId, useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import {
  PASSWORD_POLICY_HINT,
  type PasswordChangeErrors,
  validatePasswordChange,
} from '@/lib/validation/password';

interface UpdatePasswordFormProps {
  readonly submitLabel?: string;
  readonly onSuccess?: () => void;
  readonly accent?: 'emerald' | 'indigo';
}

/**
 * Reusable password update form enforcing WealthNest complexity rules via Supabase updateUser().
 */
export function UpdatePasswordForm({
  submitLabel = 'Update Password',
  onSuccess,
  accent = 'emerald',
}: UpdatePasswordFormProps) {
  const passwordInputId = useId();
  const confirmInputId = useId();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<PasswordChangeErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const focusClass =
    accent === 'indigo'
      ? 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
      : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500/20';

  const buttonClass =
    accent === 'indigo'
      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
      : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 border-0';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

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

      setPassword('');
      setConfirmPassword('');
      setSuccessMessage('Your password has been updated.');
      onSuccess?.();
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : 'Unable to update password. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {serverError && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <p className="leading-relaxed">{serverError}</p>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          <p className="leading-relaxed">{successMessage}</p>
        </div>
      )}

      <div>
        <label
          htmlFor={passwordInputId}
          className="block text-xs font-medium text-slate-300 mb-1.5"
        >
          New Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Lock className="w-4 h-4" />
          </div>
          <input
            id={passwordInputId}
            name="newPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            disabled={submitting}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) {
                setErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
            placeholder={PASSWORD_POLICY_HINT}
            className={`w-full h-10 pl-9 pr-10 rounded-lg bg-slate-950/60 border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
              errors.password ? 'border-rose-500/80 focus:ring-rose-500/30' : focusClass
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide new password' : 'Show new password'}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password ? (
          <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {errors.password}
          </p>
        ) : (
          <p className="text-[11px] text-slate-500 mt-1">{PASSWORD_POLICY_HINT}</p>
        )}
      </div>

      <div>
        <label htmlFor={confirmInputId} className="block text-xs font-medium text-slate-300 mb-1.5">
          Confirm New Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Lock className="w-4 h-4" />
          </div>
          <input
            id={confirmInputId}
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            disabled={submitting}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errors.confirmPassword) {
                setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }
            }}
            placeholder="Re-enter your new password"
            className={`w-full h-10 pl-9 pr-3 rounded-lg bg-slate-950/60 border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
              errors.confirmPassword ? 'border-rose-500/80 focus:ring-rose-500/30' : focusClass
            }`}
          />
        </div>
        {errors.confirmPassword && (
          <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {errors.confirmPassword}
          </p>
        )}
      </div>

      <Button type="submit" disabled={submitting} className={`h-10 font-semibold ${buttonClass}`}>
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Updating password...
          </span>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}

