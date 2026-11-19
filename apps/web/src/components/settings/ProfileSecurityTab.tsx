import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { useToast } from '@/components/ui/Toast';
import { connectionManager } from '@/lib/services/connection-manager';
import { EditSettingModal } from '@/components/settings/EditSettingModal';
import { ChangePasswordModal } from '@/components/settings/ChangePasswordModal';
import {
  CheckCircle2,
  Key,
  KeyRound,
  LogOut,
  Pencil,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';

interface ProfileSecurityTabProps {
  readonly displayName: string;
  readonly legalName?: string;
  readonly email: string;
  readonly userEmail?: string | null;
  readonly onUpdateDisplayName: (value: string) => Promise<void> | void;
  readonly onUpdateLegalName?: (value: string) => Promise<void> | void;
  readonly onSignOut: () => void;
}

type ActiveEditField = 'displayName' | 'legalName' | null;

/**
 * Compact Profile & Security tab:
 * - Read-first rows with inline Pencil edit triggers opening focused EditSettingModal.
 * - Unified active email & session identity (no conflicting fallback/auth emails).
 * - Modal-based password updates with live complexity checklist.
 * - Scannable 2-column Account Tier & Vault grid.
 */
export function ProfileSecurityTab({
  displayName,
  legalName = '',
  email,
  userEmail,
  onUpdateDisplayName,
  onUpdateLegalName,
  onSignOut,
}: ProfileSecurityTabProps) {
  const { user } = useAuth();
  const { activeHousehold, householdRole } = useHousehold();
  const { showToast } = useToast();

  const [editField, setEditField] = useState<ActiveEditField>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState<string | null>(null);
  const [serverConfig, setServerConfig] = useState(() => connectionManager.getConfig());

  useEffect(() => {
    return connectionManager.subscribeConfig((cfg) => setServerConfig(cfg));
  }, []);

  const isAuthenticated = Boolean(user);
  const canonicalEmail =
    userEmail ||
    user?.email ||
    (email && email !== 'user@wealthnest.local' ? email : '') ||
    'investor@wealthnest.in';

  const environmentLabel =
    serverConfig.mode === 'lan'
      ? `LAN (${serverConfig.host})`
      : serverConfig.mode === 'remote'
        ? 'Production Cloud'
        : 'Localhost / Docker';

  const triggerSavedNotice = (message: string) => {
    setSavedIndicator(message);
    showToast(message, 'success');
    window.setTimeout(() => {
      setSavedIndicator((prev) => (prev === message ? null : prev));
    }, 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left 2 Columns: Compact Profile & Security Rows */}
      <div className="lg:col-span-2 space-y-4">
        {/* Profile Card */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-400" />
              User Profile Information
            </CardTitle>
            {savedIndicator && (
              <span
                role="status"
                className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium animate-in fade-in"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {savedIndicator}
              </span>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-2 divide-y divide-slate-800/80">
            {/* Display Name Row */}
            <div className="py-2.5 first:pt-1 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider font-medium text-slate-400">
                  Display Name
                </div>
                <div className="text-sm font-medium text-white truncate mt-0.5">
                  {displayName || 'WealthNest Investor'}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditField('displayName')}
                aria-label="Edit Display Name"
                title="Edit Display Name"
                className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Optional Legal / KYC Name Row */}
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider font-medium text-slate-400 flex items-center gap-2 flex-wrap">
                  <span>Legal / KYC Name</span>
                  {!legalName && (
                    <span className="normal-case px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-medium">
                      Needed for CAS / PAN matching
                    </span>
                  )}
                </div>
                {legalName ? (
                  <div className="text-sm font-medium text-white truncate mt-0.5">{legalName}</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditField('legalName')}
                    className="mt-1 text-xs font-medium text-amber-300 hover:text-amber-200 underline underline-offset-2 text-left"
                  >
                    + Add Legal Name to match CDSL / NSDL statements
                  </button>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditField('legalName')}
                aria-label="Edit Legal / KYC Name"
                title="Edit Legal / KYC Name"
                className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Unified Email Identity Row */}
            <div className="py-2.5 last:pb-0 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider font-medium text-slate-400">
                  Primary Email
                </div>
                <div className="text-sm font-medium text-slate-200 truncate mt-0.5">
                  {canonicalEmail}
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  isAuthenticated
                    ? 'text-[11px] text-emerald-400 bg-emerald-500/10 border-emerald-500/25 shrink-0 gap-1'
                    : 'text-[11px] text-slate-300 bg-slate-800/70 border-slate-700 shrink-0'
                }
              >
                {isAuthenticated ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </>
                ) : (
                  'Local Demo'
                )}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Security & Access Credentials Card */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              Security & Access Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 divide-y divide-slate-800/80">
            {/* RLS Policy Row */}
            <div className="py-2.5 first:pt-1 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white flex items-center gap-2">
                  <span>Row-Level Security (RLS)</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                  >
                    Active
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  Household &amp; privacy access rules enforced server-side.
                </p>
              </div>
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>

            {/* Password Action Row */}
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white flex items-center gap-2">
                  <span>Account Password</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isAuthenticated
                    ? 'Protected with 12-character complexity policy.'
                    : 'Password updates apply to authenticated Supabase server/cloud accounts.'}
                </p>
              </div>
              {isAuthenticated && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="h-8 text-xs border-slate-700 hover:bg-slate-800 text-slate-200 gap-1.5 self-start sm:self-auto shrink-0"
                >
                  <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                  Change Password
                </Button>
              )}
            </div>

            {/* Unified Active Session Row */}
            <div className="py-2.5 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">Active Session</div>
                <div className="text-xs text-slate-400 truncate mt-0.5">
                  {isAuthenticated
                    ? `Signed in as ${canonicalEmail}`
                    : `Local Demo Vault (${canonicalEmail})`}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSignOut}
                className="h-8 border-rose-900/40 text-rose-400 hover:bg-rose-950/60 text-xs gap-1.5 self-start sm:self-auto shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Compact Account Tier & Vault Grid */}
      <div>
        <Card className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border-indigo-900/30">
          <CardHeader className="p-4 pb-3">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Account Tier
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-sm shrink-0">
                {(displayName || 'WN').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{displayName}</div>
                <div className="text-[11px] text-indigo-300">Self-Hosted Private Vault</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Household</div>
                <div className="font-medium text-emerald-300 truncate mt-0.5">
                  {activeHousehold?.name || 'Personal Vault'}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Role</div>
                <div className="font-mono text-indigo-300 truncate mt-0.5">
                  {householdRole || activeHousehold?.role || 'primary_owner'}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Environment</div>
                <div className="font-mono text-emerald-400 truncate mt-0.5">{environmentLabel}</div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Encryption</div>
                <div className="font-mono text-slate-200 truncate mt-0.5">AES-256 + TLS 1.3</div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">CAS Parser</div>
                <div className="font-mono text-indigo-300 truncate mt-0.5">CDSL / NSDL</div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Data Isolation
                </div>
                <div className="font-mono text-emerald-400 truncate mt-0.5">100% Client-Side</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Single-Field Edit Modal (Display Name or Legal/KYC Name) */}
      <EditSettingModal
        isOpen={editField === 'displayName'}
        title="Edit Display Name"
        label="Display Name"
        description="Shown across your dashboard, household headers, and reports."
        initialValue={displayName}
        placeholder="e.g. Ketan Vaghela"
        validate={(val) => (!val.trim() ? 'Display name cannot be empty.' : null)}
        onClose={() => setEditField(null)}
        onSave={async (val) => {
          await onUpdateDisplayName(val.trim());
          triggerSavedNotice('Display name updated');
        }}
      />

      <EditSettingModal
        isOpen={editField === 'legalName'}
        title="Edit Legal / KYC Name"
        label="Legal / KYC Name"
        description="Optional full name matching your PAN card and CAS statements."
        initialValue={legalName}
        placeholder="e.g. Ketan Shamalbhai Vaghela"
        onClose={() => setEditField(null)}
        onSave={async (val) => {
          if (onUpdateLegalName) {
            await onUpdateLegalName(val.trim());
            triggerSavedNotice(val.trim() ? 'Legal / KYC name updated' : 'Legal / KYC name cleared');
          }
        }}
      />

      {/* Password Update Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={() => triggerSavedNotice('Your password has been updated.')}
      />
    </div>
  );
}
