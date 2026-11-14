import type { FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { UpdatePasswordForm } from '@/components/auth/UpdatePasswordForm';
import { useAuth } from '@/lib/supabase/auth-context';
import { User, CheckCircle2, Key, KeyRound, Sparkles } from 'lucide-react';

interface ProfileSecurityTabProps {
  readonly displayName: string;
  readonly email: string;
  readonly userEmail?: string | null;
  readonly nameInput: string;
  readonly onNameInputChange: (value: string) => void;
  readonly isSavingName: boolean;
  readonly nameSavedSuccess: boolean;
  readonly onSaveProfile: (e: FormEvent) => void;
  readonly onSignOut: () => void;
}

/**
 * Renders the Profile & Security tab in Settings: display name editor, RLS & session info, and account tier card.
 */
export function ProfileSecurityTab({
  displayName,
  email,
  userEmail,
  nameInput,
  onNameInputChange,
  isSavingName,
  nameSavedSuccess,
  onSaveProfile,
  onSignOut,
}: ProfileSecurityTabProps) {
  const { user } = useAuth();
  const canChangePassword = Boolean(user);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-400" />
              User Profile Information
            </CardTitle>
            <CardDescription className="text-slate-400">
              Update your identity details. These are stored locally and synced to your Supabase RLS
              vault.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={onSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Display Name
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => onNameInputChange(e.target.value)}
                  placeholder="e.g. Ketan Vaghela"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Primary Email Address
                </label>
                <div className="flex items-center justify-between bg-slate-950 border border-slate-800/80 rounded-lg px-3.5 py-2 text-sm text-slate-400">
                  <span>{email}</span>
                  <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Email authentication is handled via Supabase Auth magic link and password flows.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={isSavingName || !nameInput.trim()}
                  className="text-sm"
                >
                  {isSavingName ? 'Saving...' : 'Save Profile Changes'}
                </Button>
                {nameSavedSuccess && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium animate-fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    Profile updated successfully!
                  </span>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" />
              Security & Access Credentials
            </CardTitle>
            <CardDescription className="text-slate-400">
              Manage cryptographic tokens, sessions, and authentication security.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-white flex items-center gap-2">
                  <span>Row-Level Security (RLS)</span>
                  <Badge
                    variant="outline"
                    className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                  >
                    Active
                  </Badge>
                </div>
                <div className="text-xs text-slate-400">
                  Multi-tenant PostgreSQL policies guarantee that only your user UUID can access
                  holdings and logs.
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-white">Active Session</div>
                <div className="text-xs text-slate-400">
                  {userEmail ? `Authenticated as ${userEmail}` : 'Demo Local Session Mode'}
                </div>
              </div>
              <Button
                variant="outline"
                onClick={onSignOut}
                className="border-rose-900/40 text-rose-400 hover:bg-rose-950 text-xs"
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-400" />
              Change Account Password
            </CardTitle>
            <CardDescription className="text-slate-400">
              Update your Supabase login password. Passwords must meet complexity requirements.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canChangePassword ? (
              <UpdatePasswordForm submitLabel="Update Password" accent="indigo" />
            ) : (
              <p className="text-xs text-slate-400 p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                Password updates apply to authenticated Supabase server/cloud accounts. Sign in to
                update your password.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border-indigo-900/30">
          <CardHeader>
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Account Tier
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-lg">
                {displayName.slice(0, 2).toUpperCase() || 'WN'}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{displayName}</div>
                <div className="text-xs text-indigo-300">Self-Hosted Private Vault</div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Environment</span>
                <span className="font-mono text-emerald-400">Localhost / Docker</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Encryption</span>
                <span className="font-mono text-slate-200">AES-256 + TLS 1.3</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">CAS Parser</span>
                <span className="font-mono text-indigo-300">CDSL / NSDL Enabled</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Data Isolation</span>
                <span className="font-mono text-emerald-400">100% Client-Side</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
