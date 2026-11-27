import { useEffect, useState } from 'react';
import {
  PLAN_ENTITLEMENTS,
  PLAN_QUOTA_RESOURCES,
  PLAN_TIERS,
  PlanTier,
  PlanUpgradeRequest,
  PlanUsageCounts,
  evaluatePlanQuota,
  getResourceLabel,
  hasCustomLimitOverrides,
} from '@wealthnest/domain';
import { isOk } from '@wealthnest/shared';
import { useAuth } from '@/lib/supabase/auth-context';
import { useHousehold } from '@/lib/supabase/household-context';
import { useRepositories } from '@/lib/persistence/repository-context';
import { useFamily } from '@/lib/family/family-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  CheckCircle2,
  Clock,
  Crown,
  Lock,
  Send,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';

const EMPTY_USAGE: PlanUsageCounts = {
  holdings: 0,
  realEstate: 0,
  activeLoans: 0,
  goals: 0,
  familyMembers: 0,
  accounts: 0,
  documents: 0,
};

export function PlanUsageTab() {
  const { user } = useAuth();
  const {
    activeHousehold,
    activeHouseholdId,
    planTier,
    planDefinition,
    planFeatures,
    customLimits,
    planExpiresAt,
  } = useHousehold();
  const { householdRepo, mode } = useRepositories();
  const { members, accounts } = useFamily();

  const isDemoOrUnauth = mode === 'supabase' && (!user?.id || user.id.startsWith('demo-'));

  const [usage, setUsage] = useState<PlanUsageCounts>(() => ({
    holdings: isDemoOrUnauth ? 9 : 0,
    realEstate: isDemoOrUnauth ? 3 : 0,
    activeLoans: isDemoOrUnauth ? 2 : 0,
    goals: isDemoOrUnauth ? 5 : 0,
    familyMembers: members.length || (isDemoOrUnauth ? 5 : 1),
    accounts: accounts.length || (isDemoOrUnauth ? 5 : 1),
    documents: isDemoOrUnauth ? 4 : 0,
  }));
  const [pendingRequest, setPendingRequest] = useState<PlanUpgradeRequest | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<'pro' | 'family'>(
    planTier === 'pro' ? 'family' : 'pro'
  );
  const [userNotes, setUserNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedUpgradePlan(planTier === 'pro' ? 'family' : 'pro');
  }, [planTier]);

  useEffect(() => {
    let cancelled = false;

    async function loadUsage() {
      if (isDemoOrUnauth || !activeHouseholdId || !householdRepo.getPlanUsage) {
        setUsage({
          holdings: isDemoOrUnauth ? 9 : 0,
          realEstate: isDemoOrUnauth ? 3 : 0,
          activeLoans: isDemoOrUnauth ? 2 : 0,
          goals: isDemoOrUnauth ? 5 : 0,
          familyMembers: members.length,
          accounts: accounts.length,
          documents: isDemoOrUnauth ? 4 : 0,
        });
        return;
      }

      setIsLoadingUsage(true);
      try {
        const res = await householdRepo.getPlanUsage(activeHouseholdId);
        if (!cancelled && isOk(res)) {
          setUsage(res.value.usage);
          setPendingRequest(res.value.pendingRequest ?? null);
        }
      } finally {
        if (!cancelled) setIsLoadingUsage(false);
      }
    }

    void loadUsage();
    return () => {
      cancelled = true;
    };
  }, [activeHouseholdId, householdRepo, isDemoOrUnauth, members.length, accounts.length]);

  const handleRequestUpgrade = async (requestedPlan: 'pro' | 'family') => {
    setIsSubmitting(true);
    setSubmitMessage(null);
    setSubmitError(null);

    try {
      if (isDemoOrUnauth || !activeHouseholdId || !householdRepo.submitPlanUpgradeRequest) {
        const mockReq: PlanUpgradeRequest = {
          id: `req-${Date.now()}`,
          userId: user?.id || 'demo-user',
          householdId: activeHouseholdId || 'demo-household',
          householdName: activeHousehold?.name || 'Household',
          requesterName: user?.user_metadata?.display_name || 'Investor',
          requesterEmail: user?.email || 'investor@wealthnest.local',
          currentPlan: planTier,
          requestedPlan,
          status: 'pending',
          userNotes: userNotes.trim() || undefined,
          createdAt: new Date().toISOString(),
        };
        setPendingRequest(mockReq);
        setSubmitMessage(
          `Upgrade request for ${PLAN_ENTITLEMENTS[requestedPlan].name} submitted!`
        );
        return;
      }

      const res = await householdRepo.submitPlanUpgradeRequest(
        activeHouseholdId,
        requestedPlan,
        userNotes.trim() || undefined
      );

      if (!isOk(res)) {
        setSubmitError(res.error.message);
        return;
      }

      setPendingRequest(res.value);
      setSubmitMessage(
        `Upgrade request for ${PLAN_ENTITLEMENTS[requestedPlan].name} submitted to platform administrators.`
      );
      setUserNotes('');
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit upgrade request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasOverrides = hasCustomLimitOverrides(customLimits);
  const TierIcon = planTier === 'family' ? Crown : planTier === 'pro' ? Sparkles : User;

  return (
    <div className="space-y-6">
      {/* Top Row: Active Tier Summary + Feature Entitlements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-slate-900 border-slate-800">
          <CardHeader className="p-4 sm:p-5 pb-3 flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`p-2.5 rounded-xl border shrink-0 ${
                  planTier === 'family'
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    : planTier === 'pro'
                      ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <TierIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base sm:text-lg text-white">
                    {planDefinition.name}
                  </CardTitle>
                  {hasOverrides && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                    >
                      Custom Admin Overrides Active
                    </Badge>
                  )}
                  {planExpiresAt && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-amber-500/40 bg-amber-500/10 text-amber-300 gap-1"
                    >
                      <Clock className="w-3 h-3" />
                      Expires {new Date(planExpiresAt).toLocaleDateString('en-IN')}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Household:{' '}
                  <span className="text-slate-200 font-medium">
                    {activeHousehold?.name || 'Personal Vault'}
                  </span>{' '}
                  &mdash; {planDefinition.tagline}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 pt-2 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[11px]">
                Live Household Quota Usage
              </span>
              {isLoadingUsage && <span className="text-[11px] text-cyan-400">Refreshing...</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLAN_QUOTA_RESOURCES.map((resource) => {
                const label = getResourceLabel(resource);
                const count = (usage || EMPTY_USAGE)[resource] ?? 0;
                const evalResult = evaluatePlanQuota(
                  planTier,
                  resource,
                  count,
                  1,
                  customLimits
                );
                const pct =
                  evalResult.limit && evalResult.limit > 0
                    ? Math.min(100, Math.round((evalResult.current / evalResult.limit) * 100))
                    : 0;

                const barColor = evalResult.isUnlimited
                  ? 'bg-emerald-500'
                  : !evalResult.allowed
                    ? 'bg-rose-500'
                    : evalResult.remaining === 1
                      ? 'bg-amber-500'
                      : 'bg-indigo-500';

                return (
                  <div
                    key={resource}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-200 truncate">{label.plural}</span>
                      <span className="font-mono text-[11px] font-semibold text-white shrink-0">
                        {evalResult.current} / {evalResult.limit ?? 'Unlimited'}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{
                          width: evalResult.isUnlimited ? '100%' : `${pct}%`,
                          opacity: evalResult.isUnlimited ? 0.35 : 1,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Feature Entitlements Card */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="p-4 sm:p-5 pb-3">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Feature Entitlements
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
            {[
              {
                label: 'Live 25s Quote Auto-Poll',
                enabled: planFeatures.autoPollQuotes,
                tierLabel: 'Pro+',
              },
              {
                label: 'Full Sec 112A Tax Harvesting',
                enabled: planFeatures.taxHarvestingFull,
                tierLabel: 'Pro+',
              },
              {
                label: 'Multi-PAN Family Office & HUF',
                enabled: planFeatures.multiPanFamilyOffice,
                tierLabel: 'Family',
              },
            ].map((feat) => (
              <div
                key={feat.label}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
              >
                <span className="text-slate-200 font-medium">{feat.label}</span>
                {feat.enabled ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Enabled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                    <Lock className="w-3 h-3" />
                    {feat.tierLabel}
                  </span>
                )}
              </div>
            ))}

            {pendingRequest && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-amber-300">
                  <Clock className="w-3.5 h-3.5" />
                  Pending Upgrade Request
                </div>
                <p className="text-[11px] text-amber-200/80">
                  Requested{' '}
                  <strong className="text-white">
                    {PLAN_ENTITLEMENTS[pendingRequest.requestedPlan].name}
                  </strong>{' '}
                  on {new Date(pendingRequest.createdAt).toLocaleDateString('en-IN')}.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan Comparison & Request Upgrade */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            Compare WealthNest Plans
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLAN_TIERS.map((tier: PlanTier) => {
              const def = PLAN_ENTITLEMENTS[tier];
              const isCurrent = tier === planTier;
              const isHigher =
                (planTier === 'free' && (tier === 'pro' || tier === 'family')) ||
                (planTier === 'pro' && tier === 'family');

              return (
                <div
                  key={tier}
                  className={`rounded-xl border p-4 flex flex-col justify-between gap-4 ${
                    isCurrent
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-slate-800 bg-slate-950/50'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">{def.name}</span>
                      {isCurrent && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        >
                          Current Plan
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{def.tagline}</p>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {def.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {isHigher && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSubmitting || Boolean(pendingRequest)}
                      onClick={() => {
                        setSelectedUpgradePlan(tier);
                        void handleRequestUpgrade(tier);
                      }}
                      className="w-full h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      <Send className="w-3 h-3" />
                      <span>
                        {pendingRequest?.requestedPlan === tier
                          ? 'Request Pending'
                          : `Request ${def.name}`}
                      </span>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {planTier !== 'family' && !pendingRequest && (
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="text"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="Optional note for your administrator before clicking a Request button above..."
                className="flex-1 h-9 rounded-lg bg-slate-900 border border-slate-800 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <Button
                type="button"
                size="sm"
                disabled={isSubmitting}
                onClick={() => void handleRequestUpgrade(selectedUpgradePlan)}
                className="h-9 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  Request {PLAN_ENTITLEMENTS[selectedUpgradePlan].shortLabel} Upgrade
                </span>
              </Button>
            </div>
          )}

          {submitMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{submitMessage}</span>
            </div>
          )}

          {submitError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {submitError}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
