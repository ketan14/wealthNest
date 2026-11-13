import React, { useState, useEffect } from 'react';
import { KeyRound, X, CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

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
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/login`,
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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-base">Password Recovery</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">

        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Enter your registered email address and we will dispatch a password recovery link.
        </p>

        {forgotMessage && (
          <div
            className={`mb-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
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

        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div>
            <label
              htmlFor="recoveryEmail"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
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

          <div className="flex items-center justify-end gap-2 pt-2">
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
        </form>
        </div>
      </div>
    </div>
  );
}
