export type PlanTier = 'free' | 'pro' | 'family';

export const PLAN_TIERS: readonly PlanTier[] = ['free', 'pro', 'family'] as const;

export type PlanQuotaResource =
  | 'holdings'
  | 'realEstate'
  | 'activeLoans'
  | 'goals'
  | 'familyMembers'
  | 'accounts'
  | 'documents';

export const PLAN_QUOTA_RESOURCES: readonly PlanQuotaResource[] = [
  'holdings',
  'realEstate',
  'activeLoans',
  'goals',
  'familyMembers',
  'accounts',
  'documents',
] as const;

export interface PlanLimits {
  readonly holdings: number | null;
  readonly realEstate: number | null;
  readonly activeLoans: number | null;
  readonly goals: number | null;
  readonly familyMembers: number | null;
  readonly accounts: number | null;
  readonly documents: number | null;
}

export type CustomPlanLimits = Partial<PlanLimits>;

export interface PlanFeatures {
  readonly autoPollQuotes: boolean;
  readonly taxHarvestingFull: boolean;
  readonly multiPanFamilyOffice: boolean;
}

export interface PlanUsageCounts {
  readonly holdings: number;
  readonly realEstate: number;
  readonly activeLoans: number;
  readonly goals: number;
  readonly familyMembers: number;
  readonly accounts: number;
  readonly documents: number;
}

export type PlanUpgradeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface PlanUpgradeRequest {
  readonly id: string;
  readonly userId: string;
  readonly householdId: string;
  readonly householdName: string;
  readonly requesterName: string;
  readonly requesterEmail: string;
  readonly currentPlan: PlanTier;
  readonly requestedPlan: Exclude<PlanTier, 'free'>;
  readonly status: PlanUpgradeRequestStatus;
  readonly userNotes?: string;
  readonly adminNotes?: string;
  readonly createdAt: string;
  readonly reviewedAt?: string;
  readonly reviewedByName?: string;
}

export interface PlanDefinition {
  readonly tier: PlanTier;
  readonly name: string;
  readonly shortLabel: string;
  readonly tagline: string;
  readonly badgeTone: 'slate' | 'indigo' | 'amber';
  readonly limits: PlanLimits;
  readonly features: PlanFeatures;
  readonly highlights: readonly string[];
}

export const PLAN_ENTITLEMENTS: Readonly<Record<PlanTier, PlanDefinition>> = {
  free: {
    tier: 'free',
    name: 'Free Starter',
    shortLabel: 'Free',
    tagline: 'Essential wealth tracking for a single portfolio',
    badgeTone: 'slate',
    limits: {
      holdings: 5,
      realEstate: 1,
      activeLoans: 1,
      goals: 2,
      familyMembers: 1,
      accounts: 1,
      documents: 3,
    },
    features: {
      autoPollQuotes: false,
      taxHarvestingFull: false,
      multiPanFamilyOffice: false,
    },
    highlights: [
      'Up to 5 investment holdings (stocks, mutual funds, gold, bonds)',
      '1 real estate property & 1 active loan',
      'Up to 2 financial goals',
      '1 family profile (Self) & 1 broker / demat account',
      'Up to 3 documents in the vault',
    ],
  },
  pro: {
    tier: 'pro',
    name: 'Pro Investor',
    shortLabel: 'Pro',
    tagline: 'Unlimited holdings & CAS imports for serious investors',
    badgeTone: 'indigo',
    limits: {
      holdings: null,
      realEstate: 5,
      activeLoans: 5,
      goals: null,
      familyMembers: 2,
      accounts: 5,
      documents: 50,
    },
    features: {
      autoPollQuotes: true,
      taxHarvestingFull: true,
      multiPanFamilyOffice: false,
    },
    highlights: [
      'Unlimited investment holdings & CAS imports',
      'Live 25s auto-poll quotes & full Sec 112A tax harvesting',
      'Up to 5 real estate properties & 5 active loans',
      'Unlimited financial goals',
      'Up to 2 family profiles, 5 accounts & 50 vault documents',
    ],
  },
  family: {
    tier: 'family',
    name: 'Family Office',
    shortLabel: 'Family',
    tagline: 'Unlimited multi-PAN household & HUF wealth management',
    badgeTone: 'amber',
    limits: {
      holdings: null,
      realEstate: null,
      activeLoans: null,
      goals: null,
      familyMembers: null,
      accounts: null,
      documents: null,
    },
    features: {
      autoPollQuotes: true,
      taxHarvestingFull: true,
      multiPanFamilyOffice: true,
    },
    highlights: [
      'Unlimited holdings, real estate & liabilities',
      'Unlimited family profiles (Individual, HUF, Minor, Joint)',
      'Live auto-poll quotes & multi-PAN HUF tax harvesting',
      'Unlimited broker / demat accounts & CAS imports',
      'Unlimited financial goals & vault documents',
    ],
  },
};

export interface QuotaEvaluation {
  readonly allowed: boolean;
  readonly isUnlimited: boolean;
  readonly planTier: PlanTier;
  readonly resource: PlanQuotaResource;
  readonly current: number;
  readonly limit: number | null;
  readonly remaining: number | null;
  readonly requestedDelta: number;
}

const RESOURCE_LABELS: Readonly<
  Record<PlanQuotaResource, { readonly singular: string; readonly plural: string }>
> = {
  holdings: { singular: 'Investment Holding', plural: 'Investment Holdings' },
  realEstate: { singular: 'Real Estate Property', plural: 'Real Estate Properties' },
  activeLoans: { singular: 'Active Loan', plural: 'Active Loans' },
  goals: { singular: 'Financial Goal', plural: 'Financial Goals' },
  familyMembers: { singular: 'Family Member', plural: 'Family Members' },
  accounts: { singular: 'Broker / Demat Account', plural: 'Broker / Demat Accounts' },
  documents: { singular: 'Vault Document', plural: 'Vault Documents' },
};

export function normalizePlanTier(value: unknown): PlanTier {
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'free' || lower === 'pro' || lower === 'family') {
      return lower;
    }
  }
  return 'free';
}

export function isPlanExpired(
  planExpiresAt?: string | null,
  nowMs: number = Date.now()
): boolean {
  if (!planExpiresAt) return false;
  const parsed = Date.parse(planExpiresAt);
  if (Number.isNaN(parsed)) return false;
  return parsed < nowMs;
}

export function resolveEffectivePlanTier(
  tier: PlanTier | undefined | null,
  planExpiresAt?: string | null,
  nowMs: number = Date.now()
): PlanTier {
  const normalized = normalizePlanTier(tier);
  if (normalized !== 'free' && isPlanExpired(planExpiresAt, nowMs)) {
    return 'free';
  }
  return normalized;
}

export function getPlanDefinition(tier: PlanTier | undefined | null): PlanDefinition {
  return PLAN_ENTITLEMENTS[normalizePlanTier(tier)];
}

export function hasCustomLimitOverrides(customLimits?: CustomPlanLimits | null): boolean {
  if (!customLimits || typeof customLimits !== 'object') return false;
  return PLAN_QUOTA_RESOURCES.some((key) =>
    Object.prototype.hasOwnProperty.call(customLimits, key) && customLimits[key] !== undefined
  );
}

export function resolveEffectivePlanLimits(
  tier: PlanTier | undefined | null,
  customLimits?: CustomPlanLimits | null
): PlanLimits {
  const base = getPlanDefinition(tier).limits;
  if (!customLimits || typeof customLimits !== 'object') {
    return base;
  }

  const pickLimit = (resource: PlanQuotaResource): number | null => {
    if (!Object.prototype.hasOwnProperty.call(customLimits, resource)) {
      return base[resource];
    }
    const override = customLimits[resource];
    if (override === undefined) return base[resource];
    if (override === null) return null;
    if (typeof override === 'number' && Number.isFinite(override)) {
      return Math.max(0, Math.floor(override));
    }
    return base[resource];
  };

  return {
    holdings: pickLimit('holdings'),
    realEstate: pickLimit('realEstate'),
    activeLoans: pickLimit('activeLoans'),
    goals: pickLimit('goals'),
    familyMembers: pickLimit('familyMembers'),
    accounts: pickLimit('accounts'),
    documents: pickLimit('documents'),
  };
}

export function getPlanLimit(
  tier: PlanTier | undefined | null,
  resource: PlanQuotaResource,
  customLimits?: CustomPlanLimits | null
): number | null {
  return resolveEffectivePlanLimits(tier, customLimits)[resource];
}

export function getResourceLabel(resource: PlanQuotaResource): {
  readonly singular: string;
  readonly plural: string;
} {
  return RESOURCE_LABELS[resource];
}

export function evaluatePlanQuota(
  tier: PlanTier | undefined | null,
  resource: PlanQuotaResource,
  currentCount: number,
  requestedDelta = 1,
  customLimits?: CustomPlanLimits | null
): QuotaEvaluation {
  const planTier = normalizePlanTier(tier);
  const limit = getPlanLimit(planTier, resource, customLimits);
  const normalizedCurrent = Math.max(0, Math.floor(currentCount));
  const normalizedDelta = Math.max(0, Math.floor(requestedDelta));

  if (limit === null) {
    return {
      allowed: true,
      isUnlimited: true,
      planTier,
      resource,
      current: normalizedCurrent,
      limit: null,
      remaining: null,
      requestedDelta: normalizedDelta,
    };
  }

  const remaining = Math.max(0, limit - normalizedCurrent);
  const allowed = normalizedCurrent + normalizedDelta <= limit;

  return {
    allowed,
    isUnlimited: false,
    planTier,
    resource,
    current: normalizedCurrent,
    limit,
    remaining,
    requestedDelta: normalizedDelta,
  };
}
