import {
  PLAN_ENTITLEMENTS,
  PlanQuotaResource,
  PlanTier,
  CustomPlanLimits,
  evaluatePlanQuota,
  getResourceLabel,
} from '@wealthnest/domain';
import { useHousehold } from '@/lib/supabase/household-context';
import { Crown, Lock, Sparkles } from 'lucide-react';

interface PlanQuotaBadgeProps {
  readonly resource: PlanQuotaResource;
  readonly currentCount: number;
  readonly planTier?: PlanTier;
  readonly customLimits?: CustomPlanLimits | null;
  readonly onLimitClick?: () => void;
  readonly className?: string;
}

export function PlanQuotaBadge({
  resource,
  currentCount,
  planTier: explicitPlanTier,
  customLimits: explicitCustomLimits,
  onLimitClick,
  className = '',
}: PlanQuotaBadgeProps) {
  const { planTier: householdPlanTier, customLimits: householdCustomLimits } = useHousehold();
  const activeTier = explicitPlanTier ?? householdPlanTier;
  const activeOverrides =
    explicitPlanTier !== undefined ? explicitCustomLimits : householdCustomLimits;
  const evaluation = evaluatePlanQuota(activeTier, resource, currentCount, 1, activeOverrides);

  if (evaluation.isUnlimited || evaluation.limit === null) {
    return null;
  }

  const plan = PLAN_ENTITLEMENTS[evaluation.planTier];
  const resourceLabel = getResourceLabel(resource);
  const atLimit = !evaluation.allowed;
  const nearLimit = evaluation.remaining === 1;

  const toneClasses = atLimit
    ? 'border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
    : nearLimit
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
      : 'border-border/80 bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/70';

  const Icon = atLimit ? Lock : evaluation.planTier === 'pro' ? Sparkles : Crown;

  const content = (
    <>
      <Icon className="w-3 h-3 shrink-0" />
      <span>
        {plan.shortLabel} &middot; {evaluation.current}/{evaluation.limit} {resourceLabel.plural}
      </span>
    </>
  );

  if (onLimitClick) {
    return (
      <button
        type="button"
        onClick={onLimitClick}
        title={
          atLimit
            ? `${plan.name} quota reached — click for plan details`
            : `${evaluation.remaining} remaining on ${plan.name}`
        }
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${toneClasses} ${className}`}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${toneClasses} ${className}`}
    >
      {content}
    </span>
  );
}
