import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { HouseholdInvitationPreview } from '@wealthnest/domain';
import { isOk } from '@wealthnest/shared';
import { useAuth } from '@/lib/supabase/auth-context';
import { useRepositories } from '@/lib/persistence/repository-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { useFamily } from '@/lib/family/family-context';
import { AuthBrandingPanel } from '@/components/auth/AuthBrandingPanel';
import { Button } from '@/components/ui/Button';
import {
  AlertCircle,
  CheckCircle2,
  Home,
  Loader2,
  LogIn,
  LogOut,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';

export function InviteAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const { householdRepo } = useRepositories();
  const { refreshHouseholds } = useHousehold();
  const { refreshFamilyData } = useFamily();

  const token = (searchParams.get('token') || searchParams.get('household_invite') || '').trim();
  const [preview, setPreview] = useState<HouseholdInvitationPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [acceptedHouseholdName, setAcceptedHouseholdName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!token) {
      setLoadingPreview(false);
      setErrorMsg('No invitation token was found in this link.');
      return;
    }

    setLoadingPreview(true);
    setErrorMsg(null);
    householdRepo.previewInvitation(token).then((res) => {
      if (!active) return;
      setLoadingPreview(false);
      if (!isOk(res)) {
        setErrorMsg(res.error.message);
        return;
      }
      setPreview(res.value);
      if (!res.value.valid) {
        setErrorMsg(
          res.value.reason === 'EXPIRED'
            ? 'This household invitation has expired. Ask the household owner for a new invite.'
            : res.value.reason === 'REVOKED'
              ? 'This household invitation has been revoked.'
              : res.value.reason === 'ALREADY_ACCEPTED'
                ? 'This household invitation has already been accepted.'
                : 'This household invitation link is invalid or could not be found.'
        );
      }
    });

    return () => {
      active = false;
    };
  }, [householdRepo, token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setErrorMsg(null);
    const res = await householdRepo.acceptInvitation(token);
    if (!isOk(res)) {
      setAccepting(false);
      setErrorMsg(res.error.message);
      return;
    }

    await refreshHouseholds(res.value.householdId);
    await refreshFamilyData();
    setAcceptedHouseholdName(preview?.householdName || 'Household');
    setAccepting(false);
    setTimeout(() => {
      navigate('/', { replace: true });
    }, 1000);
  };

  const encodedToken = encodeURIComponent(token);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      <AuthBrandingPanel />

      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="max-w-md w-full bg-slate-900/70 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Home className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Household Invitation</h1>
              <p className="text-xs text-slate-400">
                Explicit verification &amp; privacy-preserving access link
              </p>
            </div>
          </div>

          {loadingPreview || authLoading ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-xs text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span>Verifying household invitation...</span>
            </div>
          ) : acceptedHouseholdName ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="text-sm font-semibold text-white">
                Joined {acceptedHouseholdName}
              </div>
              <div className="text-xs text-slate-300">
                Redirecting you to the household workspace...
              </div>
            </div>
          ) : (
            <>
              {preview?.valid && (
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Household Workspace</span>
                    <span className="font-semibold text-white">{preview.householdName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Assigned Role</span>
                    <span className="font-mono uppercase text-emerald-300">
                      {preview.householdRole}
                    </span>
                  </div>
                  {preview.familyMemberName && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Linked Financial Profile</span>
                      <span className="font-semibold text-indigo-300">
                        {preview.familyMemberName}
                      </span>
                    </div>
                  )}
                  {preview.invitedEmail && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Invited Email</span>
                      <span className="font-mono text-slate-300">{preview.invitedEmail}</span>
                    </div>
                  )}
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-destructive/15 border border-destructive/30 text-rose-200 text-xs flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-rose-300">Invitation Notice</p>
                    <p>{errorMsg}</p>
                  </div>
                </div>
              )}

              {preview?.valid && !user && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    To protect family financial records, you must verify and sign in with the exact
                    invited email address before joining this household.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link to={`/signup?invite=${encodedToken}`}>
                      <Button className="w-full gap-1.5 bg-primary hover:bg-emerald-400 text-slate-950 font-semibold">
                        <UserPlus className="w-4 h-4" />
                        <span>Create Account</span>
                      </Button>
                    </Link>
                    <Link to={`/login?invite=${encodedToken}`}>
                      <Button variant="outline" className="w-full gap-1.5 border-slate-700">
                        <LogIn className="w-4 h-4" />
                        <span>Sign In</span>
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {preview?.valid && user && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-slate-400">Signed in as</div>
                      <div className="font-mono text-white truncate">{user.email}</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={signOut}
                      className="text-xs text-slate-400 hover:text-white gap-1 shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Switch</span>
                    </Button>
                  </div>

                  <Button
                    type="button"
                    disabled={accepting}
                    onClick={handleAccept}
                    className="w-full h-11 bg-primary hover:bg-emerald-400 text-slate-950 font-bold gap-2"
                  >
                    {accepting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Accepting Invitation...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Accept &amp; Join Household</span>
                      </>
                    )}
                  </Button>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 text-center">
                <Link to="/" className="text-xs text-slate-400 hover:text-white transition-colors">
                  Return to WealthNest
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
