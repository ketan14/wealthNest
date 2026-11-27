import { describe, it, expect } from 'vitest';
import {
  PLAN_ENTITLEMENTS,
  PLAN_TIERS,
  evaluatePlanQuota,
  getPlanDefinition,
  getPlanLimit,
  hasCustomLimitOverrides,
  isPlanExpired,
  normalizePlanTier,
  resolveEffectivePlanLimits,
  resolveEffectivePlanTier,
} from '../plans/plan-entitlements.js';

describe('Domain Plan Entitlements & Quota Evaluation', () => {
  it('defines exact quotas across free, pro, and family tiers', () => {
    expect(PLAN_TIERS).toEqual(['free', 'pro', 'family']);

    expect(PLAN_ENTITLEMENTS.free.limits).toEqual({
      holdings: 5,
      realEstate: 1,
      activeLoans: 1,
      goals: 2,
      familyMembers: 1,
      accounts: 1,
      documents: 3,
    });

    expect(PLAN_ENTITLEMENTS.pro.limits).toEqual({
      holdings: null,
      realEstate: 5,
      activeLoans: 5,
      goals: null,
      familyMembers: 2,
      accounts: 5,
      documents: 50,
    });

    expect(PLAN_ENTITLEMENTS.family.limits).toEqual({
      holdings: null,
      realEstate: null,
      activeLoans: null,
      goals: null,
      familyMembers: null,
      accounts: null,
      documents: null,
    });
  });

  it('normalizes unknown or missing tier strings safely to free', () => {
    expect(normalizePlanTier(undefined)).toBe('free');
    expect(normalizePlanTier(null)).toBe('free');
    expect(normalizePlanTier('')).toBe('free');
    expect(normalizePlanTier('enterprise')).toBe('free');
    expect(normalizePlanTier('PRO')).toBe('pro');
    expect(normalizePlanTier(' family ')).toBe('family');
    expect(getPlanDefinition('invalid' as any).tier).toBe('free');
  });

  it('evaluates Free tier quotas at boundary and over-quota states', () => {
    // 4/5 holdings -> allowed (1 remaining)
    const underLimit = evaluatePlanQuota('free', 'holdings', 4, 1);
    expect(underLimit).toEqual({
      allowed: true,
      isUnlimited: false,
      planTier: 'free',
      resource: 'holdings',
      current: 4,
      limit: 5,
      remaining: 1,
      requestedDelta: 1,
    });

    // 5/5 holdings -> blocked (0 remaining)
    const atLimit = evaluatePlanQuota('free', 'holdings', 5, 1);
    expect(atLimit.allowed).toBe(false);
    expect(atLimit.remaining).toBe(0);

    // Post-downgrade 8/5 holdings -> blocked with remaining clamped at 0
    const overLimit = evaluatePlanQuota('free', 'holdings', 8, 1);
    expect(overLimit.allowed).toBe(false);
    expect(overLimit.remaining).toBe(0);
  });

  it('supports batch delta checks for CAS imports', () => {
    // 3 existing holdings on Free (max 5) -> 2 remaining
    expect(evaluatePlanQuota('free', 'holdings', 3, 2).allowed).toBe(true);
    expect(evaluatePlanQuota('free', 'holdings', 3, 3).allowed).toBe(false);
    expect(evaluatePlanQuota('free', 'holdings', 3, 3).remaining).toBe(2);
  });

  it('evaluates Pro and Family unlimited vs capped resources accurately', () => {
    expect(getPlanLimit('pro', 'holdings')).toBeNull();
    expect(getPlanLimit('pro', 'goals')).toBeNull();
    expect(getPlanLimit('pro', 'realEstate')).toBe(5);
    expect(getPlanLimit('pro', 'activeLoans')).toBe(5);

    expect(evaluatePlanQuota('pro', 'holdings', 500, 25)).toMatchObject({
      allowed: true,
      isUnlimited: true,
      limit: null,
      remaining: null,
    });

    expect(evaluatePlanQuota('pro', 'realEstate', 5, 1).allowed).toBe(false);
    expect(evaluatePlanQuota('family', 'familyMembers', 12, 1)).toMatchObject({
      allowed: true,
      isUnlimited: true,
      limit: null,
      remaining: null,
    });
  });

  it('resolves custom quota overrides, trial expiry, and feature flags for Phase 2', () => {
    expect(PLAN_ENTITLEMENTS.free.features).toEqual({
      autoPollQuotes: false,
      taxHarvestingFull: false,
      multiPanFamilyOffice: false,
    });
    expect(PLAN_ENTITLEMENTS.pro.features.autoPollQuotes).toBe(true);
    expect(PLAN_ENTITLEMENTS.pro.features.taxHarvestingFull).toBe(true);
    expect(PLAN_ENTITLEMENTS.family.features.multiPanFamilyOffice).toBe(true);

    const overrides = { holdings: 12, goals: null };
    expect(hasCustomLimitOverrides(overrides)).toBe(true);
    expect(hasCustomLimitOverrides(null)).toBe(false);

    expect(resolveEffectivePlanLimits('free', overrides)).toMatchObject({
      holdings: 12,
      realEstate: 1,
      goals: null,
    });
    expect(evaluatePlanQuota('free', 'holdings', 9, 1, overrides)).toMatchObject({
      allowed: true,
      limit: 12,
      remaining: 3,
    });
    expect(evaluatePlanQuota('free', 'holdings', 12, 1, overrides).allowed).toBe(false);

    const fixedNow = Date.parse('2026-11-27T12:00:00.000Z');
    expect(isPlanExpired('2026-11-26T12:00:00.000Z', fixedNow)).toBe(true);
    expect(isPlanExpired('2026-12-15T12:00:00.000Z', fixedNow)).toBe(false);
    expect(resolveEffectivePlanTier('pro', '2026-11-26T12:00:00.000Z', fixedNow)).toBe('free');
    expect(resolveEffectivePlanTier('pro', '2026-12-15T12:00:00.000Z', fixedNow)).toBe('pro');
  });
});
