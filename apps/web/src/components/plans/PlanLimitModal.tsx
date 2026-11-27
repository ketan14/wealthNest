import { useState } from 'react';
import {
  PLAN_ENTITLEMENTS,
  PlanQuotaResource,
  PlanTier,
  CustomPlanLimits,
  evaluatePlanQuota,
  getResourceLabel,
} from '@wealthnest/domain';
import { isOk } from '@wealthnest/shared';
import { useHousehold } from '@/lib/supabase/household-context';
import { useRepositories } from '@/lib/persistence/repository-context';
import { useAuth } from '@/lib/supabase/auth-context';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, Crown, Lock, Send, ShieldCheck, Sparkles, X } from 'lucide-react';

interface PlanLimitModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly resource?: PlanQuotaResource;
  readonly currentCount?: number;
  readonly planTier?: PlanTier;
  readonly customLimits?: CustomPlanLimits | null;
  readonly customMessage?: string;
  readonly mode?: 'quota' | 'feature';
  readonly featureTitle?: string;
  readonly featureDescription?: string;
  readonly requiredTier?: 'pro' | 'family';
}

export function PlanLimitModal({
  isOpen,
  onClose,
  resource = 'holdings',
  currentCount = 0,
  planTier: explicitPlanTier,
  customLimits: explicitCustomLimits,
  customMessage,
  mode = 'quota',
  featureTitle,
  featureDescription,
  requiredTier = 'pro',
}: PlanLimitModalProps) {
  const { user } = useAuth();
  const {
    activeHouseholdId,
    planTier: householdPlanTier,
    customLimits: householdCustomLimits,
  } = useHousehold();
  const { householdRepo, mode: repoMode } = useRepositories();

  const [requestedPlan, setRequestedPlan] = useState<'pro' | 'family'>(requiredTier);
  const [requestNote, setRequestNote] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeTier = explicitPlanTier ?? householdPlanTier;
  const activeOverrides =
    explicitPlanTier !== undefined ? explicitCustomLimits : householdCustomLimits;
  const evaluation = evaluatePlanQuota(activeTier, resource, currentCount, 1, activeOverrides);
  const currentPlan = PLAN_ENTITLEMENTS[evaluation.planTier];
  const proPlan = PLAN_ENTITLEMENTS.pro;
  const familyPlan = PLAN_ENTITLEMENTS.family;
  const labels = getResourceLabel(resource);

  const limit = evaluation.limit ?? currentCount;
  const progressPct =
    limit > 0 ? Math.min(100, Math.round((evaluation.current / limit) * 100)) : 100;

  const isFeatureGate = mode === 'feature';
  const isDemoOrOffline =
    repoMode !== 'supabase' || !user?.id || user.id.startsWith('demo-') || !activeHouseholdId;

  const handleSubmitUpgradeRequest = async () => {
    setIsRequesting(true);
    setRequestError(null);
    setRequestSuccess(null);

    try {
      if (isDemoOrOffline || !householdRepo.submitPlanUpgradeRequest) {
        setRequestSuccess(
          `Upgrade request for ${PLAN_ENTITLEMENTS[requestedPlan].name} recorded! Administrators can approve upgrades from the Admin Portal.`
        );
        return;
      }

      const res = await householdRepo.submitPlanUpgradeRequest(
        activeHouseholdId,
        requestedPlan,
        requestNote.trim() || undefined
      );
      if (!isOk(res)) {
        setRequestError(res.error.message);
        return;
      }

      setRequestSuccess(
        `Upgrade request for ${PLAN_ENTITLEMENTS[requestedPlan].name} submitted! Your administrator will review it shortly.`
      );
    } catch (err: any) {
      setRequestError(err?.message || 'Failed to submit upgrade request');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-limit-modal-title"
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
              {isFeatureGate ? <Sparkles className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h2 id="plan-limit-modal-title" className="text-lg font-bold text-foreground">
                {isFeatureGate
                  ? featureTitle || 'Pro Plan Feature'
                  : `${currentPlan.name} Limit Reached`}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isFeatureGate
                  ? `Available on ${PLAN_ENTITLEMENTS[requiredTier].name} and above`
                  : `Maximum ${labels.plural.toLowerCase()} quota used for this household`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close plan limit modal"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted/40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {isFeatureGate ? (
            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-4 space-y-1.5">
              <div className="text-xs font-semibold text-indigo-300">
                Current Tier: {currentPlan.name}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {featureDescription ||
                  `Upgrade to ${PLAN_ENTITLEMENTS[requiredTier].name} to unlock ${featureTitle || 'this capability'}.`}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">{labels.plural}</span>
                <span className="font-mono font-bold text-amber-400">
                  {evaluation.current} / {evaluation.limit ?? 'Unlimited'} used
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {customMessage ||
                  `Your current ${currentPlan.name} plan supports up to ${evaluation.limit} ${labels.plural.toLowerCase()} per household.`}
              </p>
            </div>
          )}

          {/* Existing data reassurance */}
          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <p>
              Your existing records remain fully accessible &mdash; you can view, edit, refresh
              quotes, export backups, or delete old entries anytime to free up slots.
            </p>
          </div>

          {/* Upgrade Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {evaluation.planTier === 'free' && (
              <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    {proPlan.name}
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    Popular
                  </span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                  {proPlan.highlights.slice(0, 4).map((item) => (
                    <li key={item} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div
              className={`rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2 ${
                evaluation.planTier !== 'free' ? 'sm:col-span-2' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5" />
                  {familyPlan.name}
                </span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  Unlimited
                </span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                {familyPlan.highlights.slice(0, 4).map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Self-service Upgrade Request Box */}
          {evaluation.planTier !== 'family' && (
            <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground">
                  Request Plan Upgrade
                </span>
                <div className="flex items-center gap-1.5">
                  {evaluation.planTier === 'free' && (
                    <button
                      type="button"
                      onClick={() => setRequestedPlan('pro')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                        requestedPlan === 'pro'
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-background/60 text-muted-foreground border-border'
                      }`}
                    >
                      Pro Investor
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setRequestedPlan('family')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                      requestedPlan === 'family'
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-background/60 text-muted-foreground border-border'
                    }`}
                  >
                    Family Office
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  placeholder="Optional note for administrator (e.g. importing full CAS)"
                  className="flex-1 h-8 rounded-lg bg-background/70 border border-border px-2.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSubmitUpgradeRequest}
                  disabled={isRequesting || Boolean(requestSuccess)}
                  className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white shrink-0"
                >
                  <Send className="w-3 h-3" />
                  <span>{isRequesting ? 'Sending...' : 'Submit Upgrade Request'}</span>
                </Button>
              </div>

              {requestSuccess && (
                <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{requestSuccess}</span>
                </div>
              )}
              {requestError && (
                <div className="text-[11px] text-rose-400">{requestError}</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/10">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
