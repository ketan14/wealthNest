import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crown,
  SlidersHorizontal,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import {
  CustomPlanLimits,
  PLAN_ENTITLEMENTS,
  PLAN_QUOTA_RESOURCES,
  PLAN_TIERS,
  PlanQuotaResource,
  PlanTier,
  getResourceLabel,
  hasCustomLimitOverrides,
  normalizePlanTier,
} from '@wealthnest/domain';
import { adminAdapter } from '../../lib/supabase/admin.adapter';
import { ResponsiveModalShell } from '@/components/ui/ResponsiveModalShell';

export type AdminPlanTarget =
  | {
      readonly mode: 'user';
      readonly id: string;
      readonly name: string;
      readonly subtitle?: string;
      readonly currentPlan?: PlanTier;
      readonly currentCustomLimits?: CustomPlanLimits | null;
      readonly currentPlanExpiresAt?: string | null;
    }
  | {
      readonly mode: 'household';
      readonly id: string;
      readonly name: string;
      readonly subtitle?: string;
      readonly currentPlan?: PlanTier;
      readonly currentCustomLimits?: CustomPlanLimits | null;
      readonly currentPlanExpiresAt?: string | null;
    };

interface AdminUserPlanModalProps {
  readonly target: AdminPlanTarget | null;
  readonly onClose: () => void;
  readonly onSuccess: (message: string) => void;
}

type DraftLimitValues = Record<PlanQuotaResource, string>;

function buildEmptyDraftLimits(): DraftLimitValues {
  return {
    holdings: '',
    realEstate: '',
    activeLoans: '',
    goals: '',
    familyMembers: '',
    accounts: '',
    documents: '',
  };
}

function toDateInputValue(isoOrNull?: string | null): string {
  if (!isoOrNull) return '';
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function AdminUserPlanModal({ target, onClose, onSuccess }: AdminUserPlanModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>('free');
  const [reasonDetails, setReasonDetails] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [planExpiresAtInput, setPlanExpiresAtInput] = useState('');
  const [draftLimits, setDraftLimits] = useState<DraftLimitValues>(buildEmptyDraftLimits);
  const [unlimitedFlags, setUnlimitedFlags] = useState<Record<PlanQuotaResource, boolean>>({
    holdings: false,
    realEstate: false,
    activeLoans: false,
    goals: false,
    familyMembers: false,
    accounts: false,
    documents: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!target) return;
    setSelectedPlan(normalizePlanTier(target.currentPlan));
    setReasonDetails('');
    setError(null);
    setPlanExpiresAtInput(toDateInputValue(target.currentPlanExpiresAt));

    const existingLimits = target.currentCustomLimits;
    const nextDraft = buildEmptyDraftLimits();
    const nextUnlimited: Record<PlanQuotaResource, boolean> = {
      holdings: false,
      realEstate: false,
      activeLoans: false,
      goals: false,
      familyMembers: false,
      accounts: false,
      documents: false,
    };

    if (existingLimits && typeof existingLimits === 'object') {
      for (const res of PLAN_QUOTA_RESOURCES) {
        if (Object.prototype.hasOwnProperty.call(existingLimits, res)) {
          const val = existingLimits[res];
          if (val === null) {
            nextUnlimited[res] = true;
          } else if (typeof val === 'number' && Number.isFinite(val)) {
            nextDraft[res] = String(val);
          }
        }
      }
    }

    setDraftLimits(nextDraft);
    setUnlimitedFlags(nextUnlimited);
    setShowAdvanced(
      Boolean(target.currentPlanExpiresAt) || hasCustomLimitOverrides(existingLimits)
    );
  }, [target]);

  if (!target) return null;

  const currentPlan = normalizePlanTier(target.currentPlan);

  const buildCustomLimitsPayload = (): CustomPlanLimits | null => {
    const out: Record<string, number | null> = {};
    for (const res of PLAN_QUOTA_RESOURCES) {
      if (unlimitedFlags[res]) {
        out[res] = null;
      } else {
        const trimmed = draftLimits[res].trim();
        if (trimmed !== '') {
          const parsed = Number(trimmed);
          if (Number.isFinite(parsed) && parsed >= 0) {
            out[res] = Math.floor(parsed);
          }
        }
      }
    }
    return Object.keys(out).length > 0 ? (out as CustomPlanLimits) : null;
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const customLimitsPayload = buildCustomLimitsPayload();
    const expiresIso = planExpiresAtInput.trim()
      ? `${planExpiresAtInput.trim()}T23:59:59.000Z`
      : null;

    try {
      if (target.mode === 'user') {
        await adminAdapter.setUserPlan(
          target.id,
          selectedPlan,
          reasonDetails.trim() || undefined,
          {
            customLimits: customLimitsPayload,
            planExpiresAt: expiresIso,
          }
        );
      } else {
        await adminAdapter.setHouseholdPlan(
          target.id,
          selectedPlan,
          reasonDetails.trim() || undefined,
          {
            customLimits: customLimitsPayload,
            planExpiresAt: expiresIso,
          }
        );
      }

      const planName = PLAN_ENTITLEMENTS[selectedPlan].name;
      onSuccess(
        `Updated ${target.mode === 'user' ? 'user' : 'household'} "${target.name}" to ${planName}`
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update subscription plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveModalShell
      role="dialog"
      ariaLabelledBy="admin-plan-modal-title"
      backdropClassName="bg-slate-950/80"
      panelClassName="max-w-xl bg-slate-900 border-slate-800 animate-in fade-in zoom-in-95"
      formProps={{ onSubmit: handleConfirm }}
      header={
        <div className="flex items-center justify-between gap-2 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
              <Crown className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 id="admin-plan-modal-title" className="font-semibold text-white text-base">
                {target.mode === 'user' ? 'Change User Plan Tier' : 'Change Household Plan Tier'}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                {target.mode === 'user'
                  ? 'Updates profile entitlement and syncs all primary-owned households'
                  : 'Updates entitlement quotas for this household workspace'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close plan modal"
            className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      }
      bodyClassName="p-4 sm:p-6 space-y-4"
      footer={
        <div className="px-4 py-3 sm:px-6 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium min-h-[36px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md disabled:opacity-50 min-h-[36px]"
          >
            {isSubmitting ? 'Updating Plan...' : 'Save Plan Tier'}
          </button>
        </div>
      }
    >
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold truncate">{target.name}</div>
          {target.subtitle && (
            <div className="text-slate-400 font-mono text-[11px] truncate">{target.subtitle}</div>
          )}
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
          Current: {PLAN_ENTITLEMENTS[currentPlan].shortLabel}
        </span>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-400">
          Select Subscription Tier
        </label>
        <div className="grid grid-cols-1 gap-2.5">
          {PLAN_TIERS.map((tier) => {
            const def = PLAN_ENTITLEMENTS[tier];
            const isSelected = selectedPlan === tier;
            const TierIcon = tier === 'family' ? Crown : tier === 'pro' ? Sparkles : User;

            return (
              <button
                key={tier}
                type="button"
                onClick={() => setSelectedPlan(tier)}
                aria-pressed={isSelected}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-sm'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${
                      tier === 'family'
                        ? 'bg-amber-500/15 text-amber-400'
                        : tier === 'pro'
                          ? 'bg-indigo-500/15 text-indigo-400'
                          : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    <TierIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{def.name}</span>
                      {tier === currentPlan && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{def.tagline}</p>
                    <div className="text-[10px] font-mono text-slate-300 mt-1.5">
                      Holdings: {def.limits.holdings ?? 'Unlimited'} &middot; Real Estate:{' '}
                      {def.limits.realEstate ?? 'Unlimited'} &middot; Loans:{' '}
                      {def.limits.activeLoans ?? 'Unlimited'} &middot; Goals:{' '}
                      {def.limits.goals ?? 'Unlimited'} &middot; Members:{' '}
                      {def.limits.familyMembers ?? 'Unlimited'}
                    </div>
                  </div>
                </div>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapsible Custom Quota Overrides & Trial Expiry */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-900/60 transition-colors"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Custom Quota Overrides &amp; Trial Expiry</span>
          </span>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="p-3.5 pt-2 border-t border-slate-800 space-y-3">
            <div>
              <label
                htmlFor="admin-plan-expires-at"
                className="text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Plan / Trial Expiration Date (Optional — blank means no expiry)</span>
              </label>
              <input
                id="admin-plan-expires-at"
                type="date"
                value={planExpiresAtInput}
                onChange={(e) => setPlanExpiresAtInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white [color-scheme:dark] outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-medium text-slate-400">
                Per-Resource Quota Overrides (leave blank to use {PLAN_ENTITLEMENTS[selectedPlan].shortLabel} tier default)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PLAN_QUOTA_RESOURCES.map((res) => {
                  const resLabel = getResourceLabel(res);
                  const tierDefault = PLAN_ENTITLEMENTS[selectedPlan].limits[res];
                  return (
                    <div
                      key={res}
                      className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-300 truncate">{resLabel.plural}</span>
                        <label className="inline-flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={unlimitedFlags[res]}
                            onChange={(e) =>
                              setUnlimitedFlags((prev) => ({
                                ...prev,
                                [res]: e.target.checked,
                              }))
                            }
                            className="rounded border-slate-700 accent-indigo-500"
                          />
                          <span>Unlimited</span>
                        </label>
                      </div>
                      <input
                        type="number"
                        min={0}
                        disabled={unlimitedFlags[res]}
                        aria-label={`Override ${resLabel.plural}`}
                        value={unlimitedFlags[res] ? '' : draftLimits[res]}
                        onChange={(e) =>
                          setDraftLimits((prev) => ({ ...prev, [res]: e.target.value }))
                        }
                        placeholder={
                          unlimitedFlags[res]
                            ? 'Unlimited'
                            : `Default: ${tierDefault ?? 'Unlimited'}`
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white placeholder-slate-500 disabled:opacity-50"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">
          Reason / Audit Note (Optional)
        </label>
        <input
          type="text"
          value={reasonDetails}
          onChange={(e) => setReasonDetails(e.target.value)}
          placeholder="e.g. Complimentary beta upgrade or support ticket #412"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
        />
        <p className="text-[10px] text-slate-500 mt-1">
          Recorded permanently in the Admin Audit Log as{' '}
          <code className="text-slate-400">PLAN_TIER_CHANGED</code>. Existing user records above a
          lowered quota remain editable/deletable, while new additions respect the updated tier.
        </p>
      </div>
    </ResponsiveModalShell>
  );
}
