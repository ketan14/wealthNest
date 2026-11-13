import { describe, it, expect } from 'vitest';
import { Money } from '../money/money.js';
import { evaluateEmergencyRunway } from '../alerts/emergency-runway.js';
import {
  detectStaleAssetValuations,
  detectFloatingRateResetAlerts,
  detectDocumentRenewalAlerts,
  evaluateAutomatedHouseholdAlerts,
} from '../alerts/household-alert-triggers.js';
import { DocumentVaultSummary } from '../vault/document-vault.js';

describe('household-alert-triggers', () => {
  const refDate = new Date('2026-11-13T00:00:00Z');

  it('detects stale physical/illiquid asset appraisals (>180 days) while ignoring liquid equities', () => {
    const result = detectStaleAssetValuations(
      [
        {
          id: 'h-1',
          name: '3BHK Whitefield Flat',
          assetClassId: 'real_estate',
          updatedAt: '2026-01-10T00:00:00Z', // ~307 days old
        },
        {
          id: 'h-2',
          name: 'Reliance Industries',
          assetClassId: 'equity',
          updatedAt: '2025-01-01T00:00:00Z', // liquid equity ignored
        },
        {
          id: 'h-3',
          name: 'Sovereign Gold Coins',
          assetClassId: 'gold',
          updatedAt: '2026-10-01T00:00:00Z', // 43 days old -> fresh
        },
      ],
      refDate,
      180
    );

    expect(result.hasStaleValuations).toBe(true);
    expect(result.staleAssets).toHaveLength(1);
    expect(result.staleAssets[0]?.name).toBe('3BHK Whitefield Flat');
    expect(result.staleAssets[0]?.daysSinceUpdate).toBeGreaterThanOrEqual(300);
  });

  it('detects active floating-rate loans above threshold or overdue for review', () => {
    const alerts = detectFloatingRateResetAlerts(
      [
        {
          id: 'loan-1',
          name: 'SBI Home Loan',
          lender: 'SBI',
          interestRate: 9.15,
          interestType: 'floating',
          status: 'active',
          updatedAt: '2026-11-01T00:00:00Z',
        },
        {
          id: 'loan-2',
          name: 'HDFC Car Loan',
          lender: 'HDFC',
          interestRate: 9.5,
          interestType: 'fixed',
          status: 'active',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ],
      refDate,
      9.0
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe('loan_rate_reset');
    expect(alerts[0]?.severity).toBe('warning');
    expect(alerts[0]?.message).toContain('SBI Home Loan');
  });

  it('generates critical and warning alerts for expired and expiring-soon vault documents', () => {
    const vaultSummary: DocumentVaultSummary = {
      totalDocuments: 5,
      totalSizeBytes: 102400,
      countsByCategory: {
        identity_pan: 1,
        property_deed: 1,
        cas_statement: 1,
        insurance_policy: 1,
        huf_deed: 1,
        tax_itr: 0,
        loan_agreement: 0,
        other: 0,
      },
      expiringSoonCount: 2,
      expiredCount: 1,
    };

    const alerts = detectDocumentRenewalAlerts(vaultSummary);
    expect(alerts).toHaveLength(2);
    expect(alerts[0]?.type).toBe('document_expired');
    expect(alerts[0]?.severity).toBe('critical');
    expect(alerts[1]?.type).toBe('document_expiring');
    expect(alerts[1]?.severity).toBe('warning');
  });

  it('aggregates and sorts all automated household alerts by severity (critical -> warning -> info)', () => {
    const runway = evaluateEmergencyRunway({
      liquidCorpus: Money.fromDecimal(1200000, 'INR'),
      monthlyExpenses: Money.fromDecimal(100000, 'INR'),
      targetMonths: 6,
    });

    const alerts = evaluateAutomatedHouseholdAlerts({
      emergencyRunway: runway,
      totalMonthlyEmi: Money.fromDecimal(45000, 'INR'),
      holdings: [
        {
          id: 'h-1',
          name: '3BHK Whitefield Flat',
          assetClassId: 'real_estate',
          updatedAt: '2026-01-10T00:00:00Z',
        },
      ],
      liabilities: [
        {
          id: 'loan-1',
          name: 'SBI Home Loan',
          lender: 'SBI',
          interestRate: 9.25,
          interestType: 'floating',
          status: 'active',
          updatedAt: '2026-11-01T00:00:00Z',
        },
      ],
      vaultSummary: {
        totalDocuments: 3,
        totalSizeBytes: 50000,
        countsByCategory: {
          identity_pan: 1,
          property_deed: 0,
          cas_statement: 0,
          insurance_policy: 2,
          huf_deed: 0,
          tax_itr: 0,
          loan_agreement: 0,
          other: 0,
        },
        expiringSoonCount: 1,
        expiredCount: 1,
      },
      section112aEligible: true,
      referenceDate: refDate,
    });

    const types = alerts.map((a) => a.type);
    expect(types).toEqual([
      'document_expired',
      'valuation_stale',
      'document_expiring',
      'loan_rate_reset',
      'emi_obligation',
      'tax_harvesting_opportunity',
    ]);
  });
});

