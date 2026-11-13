import { describe, it, expect } from 'vitest';
import { Money } from '../money/money.js';
import {
  evaluateEmergencyRunway,
  generateHouseholdAttentionAlerts,
} from '../alerts/emergency-runway.js';

describe('Emergency Runway & Alert Engine (FIN-ALERT-01)', () => {
  it('identifies adequate emergency runway when liquid reserves exceed target months', () => {
    // ₹6,00,000 liquid, ₹80,000 monthly burn -> 7.5 months runway
    const liquid = Money.fromCents(60000000n, 'INR');
    const expenses = Money.fromCents(8000000n, 'INR');

    const result = evaluateEmergencyRunway({
      liquidCorpus: liquid,
      monthlyExpenses: expenses,
      targetMonths: 6,
    });

    expect(result.runwayMonths).toBeCloseTo(7.5, 1);
    expect(result.status).toBe('adequate');
    expect(result.shortfall.cents).toBe(0n);
    expect(result.alert).toBeUndefined();
  });

  it('triggers a warning alert when runway is between 3 and 6 months', () => {
    // ₹3,00,000 liquid, ₹75,000 monthly burn -> 4.0 months runway
    const liquid = Money.fromCents(30000000n, 'INR');
    const expenses = Money.fromCents(7500000n, 'INR');

    const result = evaluateEmergencyRunway({
      liquidCorpus: liquid,
      monthlyExpenses: expenses,
      targetMonths: 6,
    });

    expect(result.runwayMonths).toBe(4.0);
    expect(result.status).toBe('warning');
    expect(result.targetCorpus.toDecimal()).toBe(450000); // 6 * 75,000
    expect(result.shortfall.toDecimal()).toBe(150000); // Shortfall of ₹1.5L
    expect(result.alert).toBeDefined();
    expect(result.alert?.severity).toBe('warning');
    expect(result.alert?.type).toBe('emergency_runway_warning');
    expect(result.alert?.title).toBe('Emergency Runway Below Recommended');
  });

  it('triggers a critical alert when runway drops below 3 months', () => {
    // ₹1,00,000 liquid, ₹60,000 monthly burn -> 1.66 months runway
    const liquid = Money.fromCents(10000000n, 'INR');
    const expenses = Money.fromCents(6000000n, 'INR');

    const result = evaluateEmergencyRunway({
      liquidCorpus: liquid,
      monthlyExpenses: expenses,
      targetMonths: 6,
    });

    expect(result.runwayMonths).toBeCloseTo(1.66, 1);
    expect(result.status).toBe('critical');
    expect(result.alert).toBeDefined();
    expect(result.alert?.severity).toBe('critical');
    expect(result.alert?.type).toBe('emergency_runway_critical');
  });

  it('generates multi-factor household alerts combining emergency runway, EMIs, and stale appraisals', () => {
    const liquid = Money.fromCents(15000000n, 'INR'); // ₹1.5L
    const expenses = Money.fromCents(7500000n, 'INR'); // ₹75k -> 2.0 months (Critical)
    const emi = Money.fromCents(3500000n, 'INR'); // ₹35k EMI

    const runwayAssessment = evaluateEmergencyRunway({
      liquidCorpus: liquid,
      monthlyExpenses: expenses,
      targetMonths: 6,
    });

    const alerts = generateHouseholdAttentionAlerts({
      emergencyRunway: runwayAssessment,
      totalMonthlyEmi: emi,
      hasStaleValuations: true,
      staleAssetNames: ['Paldi Apartment', 'Tanishq Gold Bar'],
      section112aEligible: true,
    });

    expect(alerts).toHaveLength(4);
    expect(alerts[0]!.type).toBe('emergency_runway_critical');
    expect(alerts[1]!.type).toBe('emi_obligation');
    expect(alerts[2]!.type).toBe('valuation_stale');
    expect(alerts[3]!.type).toBe('tax_harvesting_opportunity');
  });
});
