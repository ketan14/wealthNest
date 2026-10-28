import { describe, it, expect, vi } from 'vitest';
import { ok, err } from '@wealthnest/shared';
import { ValidateAndParseBackupUseCase } from '../use-cases/validate-and-parse-backup.js';
import { RestorePortfolioFromBackupUseCase } from '../use-cases/restore-portfolio-from-backup.js';
import { BackupPort, PortfolioBackupData } from '../ports/backup.port.js';

describe('Backup Validation & Atomic Restore Use Cases', () => {
  const validator = new ValidateAndParseBackupUseCase();

  const validSampleBackup: PortfolioBackupData = {
    version: '1.0.0',
    schema: 'wealthnest-portfolio-v1',
    exportedAt: '2026-03-31T12:00:00Z',
    user: {
      id: 'usr-synth-01',
      email: 'investor@wealthnest.in',
      displayName: 'Ketan Vaghela',
      defaultCurrency: 'INR',
    },
    holdings: [
      {
        holdingId: 'h-hdfc',
        assetId: 'asset-hdfc',
        name: 'HDFC Bank Ltd',
        ticker: 'HDFCBANK',
        assetClassId: 'equity',
        assetClassName: 'Equities',
        assetClassColor: '#3b82f6',
        quantity: 50,
        unitCostCents: 150000,
        currentValueCents: 8500000,
        currency: 'INR',
        updatedAt: '2026-03-31T00:00:00Z',
      },
    ],
    transactions: [
      {
        id: 'tx-01',
        userId: 'usr-synth-01',
        assetId: 'asset-hdfc',
        type: 'buy',
        amountCents: 7500000,
        quantity: 50,
        currency: 'INR',
        transactionDate: '2026-01-10T10:00:00Z',
        createdAt: '2026-01-10T10:00:00Z',
      },
    ],
    liabilities: [
      {
        id: 'lib-home',
        userId: 'usr-synth-01',
        name: 'Home Loan SBI',
        loanType: 'home_loan',
        lender: 'SBI',
        originalPrincipalCents: 500000000n,
        currentBalanceCents: 420000000n,
        interestRate: 8.5,
        interestType: 'floating',
        emiAmountCents: 4500000n,
        currency: 'INR',
        status: 'active',
        linkedAssetId: 'asset-hdfc',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ],
    goals: [
      {
        id: 'goal-retire',
        userId: 'usr-synth-01',
        name: 'Early Retirement',
        category: 'retirement',
        targetAmountCents: 1000000000,
        targetDate: '2040-12-31',
        initialSavedCents: 8500000,
        monthlyContributionCents: 5000000,
        expectedReturnRate: 12.0,
        inflationRate: 6.0,
        priority: 'high',
        currency: 'INR',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        linkedHoldings: [],
      },
    ],
    metrics: {
      totalAssetsCents: 8500000,
      totalLiabilitiesCents: 420000000,
      netWorthCents: -411500000,
      totalHoldings: 1,
      totalTransactions: 1,
      totalLiabilities: 1,
      totalGoals: 1,
    },
  };

  const serializeBackup = (data: any): string =>
    JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));

  describe('Deep Validation Scenarios', () => {
    it('approves a well-formed valid backup', () => {
      const result = validator.execute(serializeBackup(validSampleBackup));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.isValid).toBe(true);
        expect(result.value.errors).toHaveLength(0);
        expect(result.value.holdingsCount).toBe(1);
        expect(result.value.transactionsCount).toBe(1);
        expect(result.value.liabilitiesCount).toBe(1);
        expect(result.value.goalsCount).toBe(1);
      }
    });

    it('rejects unsupported backup versions', () => {
      const backup = { ...validSampleBackup, version: '2.0.0' };
      const result = validator.execute(serializeBackup(backup));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.isValid).toBe(false);
        expect(result.value.errors.some((e) => e.includes('Unsupported backup version'))).toBe(true);
      }
    });

    it('rejects duplicate holding IDs', () => {
      const backup = {
        ...validSampleBackup,
        holdings: [
          validSampleBackup.holdings[0],
          { ...validSampleBackup.holdings[0], name: 'Duplicate HDFC Holding' },
        ],
      };
      const result = validator.execute(serializeBackup(backup));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.isValid).toBe(false);
        expect(result.value.errors.some((e) => e.includes('Duplicate holding ID detected'))).toBe(true);
      }
    });

    it('rejects duplicate transaction IDs', () => {
      const backup = {
        ...validSampleBackup,
        transactions: [
          validSampleBackup.transactions[0],
          { ...validSampleBackup.transactions[0], amountCents: 200000 },
        ],
      };
      const result = validator.execute(serializeBackup(backup));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.isValid).toBe(false);
        expect(result.value.errors.some((e) => e.includes('Duplicate transaction ID detected'))).toBe(true);
      }
    });

    it('rejects malformed records with negative numbers or invalid types', () => {
      const backup = {
        ...validSampleBackup,
        holdings: [{ ...validSampleBackup.holdings[0], quantity: -10 }],
        transactions: [{ ...validSampleBackup.transactions[0], type: 'invalid_trade_type' as any }],
        liabilities: [{ ...validSampleBackup.liabilities[0], currentBalanceCents: -500 }],
        goals: [{ ...validSampleBackup.goals[0], targetAmountCents: 0 }],
      };
      const result = validator.execute(serializeBackup(backup));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.isValid).toBe(false);
        expect(result.value.errors.some((e) => e.includes('negative quantity'))).toBe(true);
        expect(result.value.errors.some((e) => e.includes('invalid type'))).toBe(true);
        expect(result.value.errors.some((e) => e.includes('negative current balance'))).toBe(true);
        expect(result.value.errors.some((e) => e.includes('non-positive target amount'))).toBe(true);
      }
    });

    it('rejects transactions referencing unknown asset IDs', () => {
      const backup = {
        ...validSampleBackup,
        transactions: [
          {
            ...validSampleBackup.transactions[0],
            assetId: 'completely-unknown-asset-id',
          },
        ],
      };
      const result = validator.execute(serializeBackup(backup));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.isValid).toBe(false);
        expect(result.value.errors.some((e) => e.includes('references unknown asset ID'))).toBe(true);
      }
    });

    it('rejects liabilities linked to unknown asset IDs', () => {
      const backup = {
        ...validSampleBackup,
        liabilities: [
          {
            ...validSampleBackup.liabilities[0],
            linkedAssetId: 'completely-unlinked-property-id',
          },
        ],
      };
      const result = validator.execute(serializeBackup(backup));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.isValid).toBe(false);
        expect(result.value.errors.some((e) => e.includes('links to unknown asset ID'))).toBe(true);
      }
    });
  });

  describe('RestorePortfolioFromBackupUseCase Scenarios', () => {
    it('successfully restores a validated backup atomically', async () => {
      const mockBackupPort: BackupPort = {
        createFullBackup: vi.fn(),
        restoreFromBackup: vi.fn().mockResolvedValue(
          ok({
            restoredHoldings: 1,
            restoredTransactions: 1,
            restoredLiabilities: 1,
            restoredGoals: 1,
          })
        ),
      };

      const useCase = new RestorePortfolioFromBackupUseCase(mockBackupPort);
      const result = await useCase.execute({
        targetUserId: 'usr-synth-01',
        backupData: validSampleBackup,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.restoredHoldings).toBe(1);
        expect(result.value.restoredTransactions).toBe(1);
        expect(result.value.restoredLiabilities).toBe(1);
        expect(result.value.restoredGoals).toBe(1);
        expect(result.value.durationMs).toBeGreaterThanOrEqual(0);
      }
      expect(mockBackupPort.restoreFromBackup).toHaveBeenCalledWith('usr-synth-01', validSampleBackup);
    });

    it('rejects restore immediately if backup payload fails validation', async () => {
      const mockBackupPort: BackupPort = {
        createFullBackup: vi.fn(),
        restoreFromBackup: vi.fn(),
      };

      const corruptedBackup = {
        ...validSampleBackup,
        version: '99.0.0' as any, // invalid version
      };

      const useCase = new RestorePortfolioFromBackupUseCase(mockBackupPort);
      const result = await useCase.execute({
        targetUserId: 'usr-synth-01',
        backupData: corruptedBackup,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Backup rejected with validation errors');
      }
      expect(mockBackupPort.restoreFromBackup).not.toHaveBeenCalled();
    });

    it('preserves existing data and reports rollback when storage adapter encounters error', async () => {
      const mockBackupPort: BackupPort = {
        createFullBackup: vi.fn(),
        restoreFromBackup: vi.fn().mockResolvedValue(
          err(new Error('Database write constraint violation on portfolio_accounts'))
        ),
      };

      const useCase = new RestorePortfolioFromBackupUseCase(mockBackupPort);
      const result = await useCase.execute({
        targetUserId: 'usr-synth-01',
        backupData: validSampleBackup,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Atomic restore failed and was rolled back');
        expect(result.error.message).toContain('Database write constraint violation');
      }
    });
  });
});
