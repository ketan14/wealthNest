import React, { useState, useEffect } from 'react';
import { KeyRound, X, CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { resolveAppRedirectUrl } from '@/lib/config/app-redirect-url';
import { Button } from '@/components/ui/Button';
import { ResponsiveModalShell } from '@/components/ui/ResponsiveModalShell';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  initialEmail: string;
  onClose: () => void;
}

export function ForgotPasswordModal({ isOpen, initialEmail, onClose }: ForgotPasswordModalProps) {
  const [forgotEmail, setForgotEmail] = useState(initialEmail);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setForgotEmail(initialEmail);
    setForgotMessage(null);
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMessage(null);

    if (!forgotEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      setForgotMessage({ text: 'Please enter a valid email address', type: 'error' });
      return;
    }

    setForgotSubmitting(true);
    try {
      const redirectTo = resolveAppRedirectUrl('/reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo,
      });
      if (error) throw error;

      setForgotMessage({
        text: 'Password reset link sent! Please check your email inbox.',
        type: 'success',
      });
    } catch (err: unknown) {
      setForgotMessage({
        text: err instanceof Error ? err.message : 'Unable to send password reset link.',
        type: 'error',
      });
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <ResponsiveModalShell
      role="dialog"
      ariaLabelledBy="forgot-password-title"
      backdropClassName="bg-slate-950/80"
      panelClassName="max-w-md bg-slate-900 border-slate-800 animate-in fade-in zoom-in-95"
      formProps={{ onSubmit: handleForgotPassword }}
      header={
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <KeyRound className="w-5 h-5 text-emerald-400 shrink-0" />
            <h3 id="forgot-password-title" className="font-bold text-white text-base">
              Password Recovery
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      }
      bodyClassName="p-4 sm:p-6 space-y-4"
      footer={
        <div className="flex items-center justify-end gap-2 px-4 py-3 sm:px-6 border-t border-slate-800 bg-slate-900">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-slate-700 text-slate-300"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={forgotSubmitting}
            className="bg-primary hover:bg-emerald-400 text-slate-950 font-bold"
          >
            {forgotSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Sending...
              </span>
            ) : (
              'Send Reset Link'
            )}
          </Button>
        </div>
      }
    >
      <p className="text-xs text-slate-400 leading-relaxed">
        Enter your registered email address and we will dispatch a password recovery link.
      </p>

      {forgotMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
            forgotMessage.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-destructive/15 text-destructive border border-destructive/30'
          }`}
        >
          {forgotMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 shrink-0" />
          )}
          <span>{forgotMessage.text}</span>
        </div>
      )}

      <div>
        <label htmlFor="recoveryEmail" className="block text-xs font-medium text-slate-300 mb-1.5">
          Recovery Email Address
        </label>
        <input
          id="recoveryEmail"
          name="recoveryEmail"
          type="email"
          required
          value={forgotEmail}
          onChange={(e) => setForgotEmail(e.target.value)}
          placeholder="recovery@wealthnest.local"
          className="w-full h-10 px-3 rounded-lg bg-slate-950/60 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
        />
      </div>
    </ResponsiveModalShell>
  );
}
