import { describe, it, expect } from 'vitest';
import { ValidateAndParseBackupUseCase } from '../use-cases/validate-and-parse-backup.js';

describe('ValidateAndParseBackupUseCase', () => {
  const useCase = new ValidateAndParseBackupUseCase();

  it('validates and parses a compliant WealthNest backup JSON', () => {
    const validJson = JSON.stringify({
      version: '1.0.0',
      schema: 'wealthnest-portfolio-v1',
      exportedAt: '2026-01-20T10:00:00Z',
      user: {
        id: 'user-1',
        email: 'test@wealthnest.in',
        displayName: 'Test User',
      },
      holdings: [
        { holdingId: 'h-1', name: 'Nifty 50 ETF', currentValueCents: 5000000 },
        { holdingId: 'h-2', name: 'Gold BeES', currentValueCents: 2000000 },
      ],
      transactions: [{ id: 't-1', amountCents: 100000 }],
      liabilities: [{ id: 'l-1', currentBalanceCents: 3000000 }],
      goals: [{ id: 'g-1', targetAmountCents: 10000000 }],
    });

    const res = useCase.execute(validJson);
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.value.isValid).toBe(true);
    expect(res.value.errors).toHaveLength(0);
    expect(res.value.holdingsCount).toBe(2);
    expect(res.value.transactionsCount).toBe(1);
    expect(res.value.liabilitiesCount).toBe(1);
    expect(res.value.goalsCount).toBe(1);
    expect(res.value.totalAssetsCents).toBe(7000000);
    expect(res.value.totalLiabilitiesCents).toBe(3000000);
    expect(res.value.netWorthCents).toBe(4000000);
    expect(res.value.userEmail).toBe('test@wealthnest.in');
  });

  it('identifies invalid JSON syntax and missing essential fields', () => {
    const invalidSyntax = '{ not valid json';
    const res1 = useCase.execute(invalidSyntax);
    expect(res1.success).toBe(true);
    if (res1.success) {
      expect(res1.value.isValid).toBe(false);
      expect(res1.value.errors).toContain('Invalid JSON syntax: could not parse file');
    }

    const missingFieldsJson = JSON.stringify({
      somethingElse: 123,
    });
    const res2 = useCase.execute(missingFieldsJson);
    expect(res2.success).toBe(true);
    if (res2.success) {
      expect(res2.value.isValid).toBe(false);
      expect(res2.value.errors).toContain('Missing backup schema version');
      expect(res2.value.errors).toContain('Missing or invalid "holdings" array');
    }
  });
});
