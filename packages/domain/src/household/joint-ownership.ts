/**
 * Pure BigInt paise joint-ownership & liability-share arithmetic.
 *
 * Guarantees zero paise drift (sum of allocated slices strictly equals totalCents)
 * using deterministic largest-remainder distribution scaled at 10,000 units per 1%
 * (matching PostgreSQL numeric(7,4) ownership_share / liability_share).
 */

export interface OwnershipShareSlice {
  readonly familyMemberId: string;
  readonly sharePercentage: number;
  readonly isPrimary?: boolean;
}

export interface AllocatedShare {
  readonly familyMemberId: string;
  readonly sharePercentage: number;
  readonly isPrimary: boolean;
  readonly allocatedCents: bigint;
}

const SHARE_SCALE = 10_000n; // 4 decimal places matching SQL numeric(7,4)
const FULL_PERCENT_SCALED = 100n * SHARE_SCALE; // 1_000_000n

export interface ShareValidationResult {
  readonly valid: boolean;
  readonly totalPercentage: number;
  readonly error?: string;
}

/**
 * Validates that ownership / liability share splits are non-empty, strictly positive,
 * do not duplicate familyMemberId, and sum to 100% within 0.0001 tolerance.
 */
export function validateOwnershipShares(
  shares: readonly OwnershipShareSlice[]
): ShareValidationResult {
  if (!shares || shares.length === 0) {
    return { valid: false, totalPercentage: 0, error: 'At least one owner is required.' };
  }

  const seen = new Set<string>();
  let totalScaled = 0n;

  for (const s of shares) {
    if (!s.familyMemberId || !s.familyMemberId.trim()) {
      return { valid: false, totalPercentage: 0, error: 'Family member ID is required.' };
    }
    if (seen.has(s.familyMemberId)) {
      return {
        valid: false,
        totalPercentage: 0,
        error: `Duplicate owner assignment for member ${s.familyMemberId}.`,
      };
    }
    seen.add(s.familyMemberId);

    if (!Number.isFinite(s.sharePercentage) || s.sharePercentage <= 0 || s.sharePercentage > 100) {
      return {
        valid: false,
        totalPercentage: 0,
        error: 'Each ownership share must be greater than 0% and at most 100%.',
      };
    }

    totalScaled += BigInt(Math.round(s.sharePercentage * Number(SHARE_SCALE)));
  }

  const totalPercentage = Number(totalScaled) / Number(SHARE_SCALE);
  const diff = totalScaled > FULL_PERCENT_SCALED ? totalScaled - FULL_PERCENT_SCALED : FULL_PERCENT_SCALED - totalScaled;

  if (diff > 1n) {
    return {
      valid: false,
      totalPercentage,
      error: `Ownership shares must sum to 100% (currently ${totalPercentage.toFixed(2)}%).`,
    };
  }

  return { valid: true, totalPercentage };
}

/**
 * Splits a BigInt paise amount across multiple owners proportionally by sharePercentage,
 * distributing remainder paise deterministically (largest remainder -> primary -> memberId asc)
 * so the sum of allocatedCents is strictly equal to totalCents.
 */
export function allocateBigIntByShares(
  totalCents: bigint,
  shares: readonly OwnershipShareSlice[]
): AllocatedShare[] {
  if (shares.length === 0) {
    return [];
  }

  if (shares.length === 1) {
    const only = shares[0]!;
    return [
      {
        familyMemberId: only.familyMemberId,
        sharePercentage: only.sharePercentage,
        isPrimary: Boolean(only.isPrimary),
        allocatedCents: totalCents,
      },
    ];
  }

  const sign = totalCents < 0n ? -1n : 1n;
  const absTotal = totalCents < 0n ? -totalCents : totalCents;

  const weighted = shares.map((s, index) => {
    const scaled = BigInt(Math.max(0, Math.round(s.sharePercentage * Number(SHARE_SCALE))));
    return {
      index,
      familyMemberId: s.familyMemberId,
      sharePercentage: s.sharePercentage,
      isPrimary: Boolean(s.isPrimary),
      weight: scaled,
    };
  });

  let totalWeight = 0n;
  for (const w of weighted) {
    totalWeight += w.weight;
  }

  if (totalWeight <= 0n) {
    return weighted.map((w, idx) => ({
      familyMemberId: w.familyMemberId,
      sharePercentage: w.sharePercentage,
      isPrimary: w.isPrimary,
      allocatedCents: idx === 0 ? totalCents : 0n,
    }));
  }

  const buckets = weighted.map((w) => {
    const numerator = absTotal * w.weight;
    const base = numerator / totalWeight;
    const remainder = numerator % totalWeight;
    return {
      ...w,
      allocatedAbs: base,
      remainder,
    };
  });

  let sumBase = 0n;
  for (const b of buckets) {
    sumBase += b.allocatedAbs;
  }
  const leftover = Number(absTotal - sumBase);

  if (leftover > 0) {
    const order = [...buckets].sort((a, b) => {
      if (b.remainder !== a.remainder) {
        return b.remainder > a.remainder ? 1 : -1;
      }
      if (a.isPrimary !== b.isPrimary) {
        return a.isPrimary ? -1 : 1;
      }
      return a.familyMemberId.localeCompare(b.familyMemberId);
    });

    for (let i = 0; i < leftover && i < order.length; i++) {
      const target = order[i]!;
      buckets[target.index]!.allocatedAbs += 1n;
    }
  }

  return buckets.map((b) => ({
    familyMemberId: b.familyMemberId,
    sharePercentage: b.sharePercentage,
    isPrimary: b.isPrimary,
    allocatedCents: b.allocatedAbs * sign,
  }));
}

/**
 * Generates clean equal percentages summing strictly to 100.00% (up to 4 decimal places)
 * for N co-owners / co-borrowers.
 */
export function buildEqualOwnershipShares(memberIds: readonly string[]): number[] {
  if (memberIds.length === 0) return [];
  if (memberIds.length === 1) return [100];

  const base = Math.floor((100 * 100) / memberIds.length) / 100;
  const result = memberIds.map(() => base);
  const currentSum = result.reduce((sum, val) => sum + val, 0);
  const diff = Math.round((100 - currentSum) * 100) / 100;
  result[0] = Math.round((result[0]! + diff) * 100) / 100;
  return result;
}
