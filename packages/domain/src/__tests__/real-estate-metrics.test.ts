import { describe, it, expect } from 'vitest';
import {
  computeRealEstatePropertyMetrics,
  summarizeRealEstatePortfolio,
  RealEstatePropertyInput,
} from '../real-estate/real-estate-metrics.js';

describe('Domain: Real Estate Equity, LTV & Rental Yield (UX-04)', () => {
  const flatInput: RealEstatePropertyInput = {
    id: 're-1',
    name: '3BHK Flat — Prahlad Nagar, Ahmedabad',
    propertyType: 'residential',
    location: 'Ahmedabad',
    memberId: 'mem-self',
    purchaseDate: '2020-01-01',
    purchasePricePaise: 60_00_000_00n, // ₹60 Lakhs
    currentValuePaise: 90_00_000_00n, // ₹90 Lakhs
    monthlyRentPaise: 30_000_00n, // ₹30,000/mo -> ₹3.6L/yr (4.00% gross)
    annualMaintenancePaise: 42_000_00n, // ₹42,000/yr
    propertyTaxPaise: 12_000_00n, // ₹12,000/yr -> Net Rent = ₹3.06L/yr (3.40% net)
    linkedLoanBalancePaise: 40_50_000_00n, // ₹40.5 Lakhs -> 45.00% LTV
    linkedMonthlyEmiPaise: 38_000_00n, // ₹38,000/mo
    linkedLoanName: 'HDFC Home Loan',
  };

  it('computes net equity, LTV, gross/net rental yield, appreciation, and monthly net cashflow in BigInt paise', () => {
    const metrics = computeRealEstatePropertyMetrics(flatInput, new Date('2026-01-01T00:00:00Z'));

    expect(metrics.netPropertyEquityPaise).toBe(49_50_000_00n); // ₹49.5L
    expect(metrics.isNegativeEquity).toBe(false);
    expect(metrics.ltvRatioPct).toBe(45);
    expect(metrics.ltvHealthBand).toBe('healthy');
    expect(metrics.grossAnnualRentPaise).toBe(3_60_000_00n);
    expect(metrics.netAnnualRentPaise).toBe(3_06_000_00n);
    expect(metrics.grossRentalYieldPct).toBe(4);
    expect(metrics.netRentalYieldPct).toBe(3.4);
    expect(metrics.totalAppreciationPaise).toBe(30_00_000_00n);
    expect(metrics.appreciationPct).toBe(50);
    expect(metrics.appreciationCagrPct).toBeGreaterThan(6.9);
    expect(metrics.appreciationCagrPct).toBeLessThan(7.1);
    // Monthly expenses = (42,000 + 12,000)/12 = 4,500 -> 30,000 - 4,500 - 38,000 = -12,500/mo
    expect(metrics.monthlyNetCashflowPaise).toBe(-12_500_00n);
  });

  it('flags negative equity and high leverage when loan exceeds property valuation', () => {
    const underwater: RealEstatePropertyInput = {
      ...flatInput,
      id: 're-underwater',
      currentValuePaise: 50_00_000_00n,
      linkedLoanBalancePaise: 55_00_000_00n,
    };

    const metrics = computeRealEstatePropertyMetrics(underwater);
    expect(metrics.netPropertyEquityPaise).toBe(-5_00_000_00n);
    expect(metrics.isNegativeEquity).toBe(true);
    expect(metrics.ltvRatioPct).toBe(110);
    expect(metrics.ltvHealthBand).toBe('high_leverage');
  });

  it('summarizes portfolio-level weighted LTV and average yields across multiple properties', () => {
    const commercialInput: RealEstatePropertyInput = {
      id: 're-2',
      name: 'Commercial Shop — Satellite Road',
      propertyType: 'commercial',
      memberId: 'mem-huf',
      purchasePricePaise: 40_00_000_00n,
      currentValuePaise: 60_00_000_00n,
      monthlyRentPaise: 40_000_00n, // ₹4.8L/yr -> 8.00% gross
      annualMaintenancePaise: 24_000_00n,
      propertyTaxPaise: 12_000_00n,
      linkedLoanBalancePaise: 0n,
      linkedMonthlyEmiPaise: 0n,
    };

    const summary = summarizeRealEstatePortfolio([flatInput, commercialInput]);
    expect(summary.propertyCount).toBe(2);
    expect(summary.totalPropertyValuePaise).toBe(1_50_00_000_00n); // ₹1.50 Cr
    expect(summary.totalLinkedDebtPaise).toBe(40_50_000_00n); // ₹40.5L
    expect(summary.totalNetEquityPaise).toBe(1_09_50_000_00n); // ₹1.095 Cr
    // Weighted LTV = 40.5 / 150 = 27.00%
    expect(summary.weightedLtvPct).toBe(27);
    // Gross annual rent = 3.6L + 4.8L = 8.4L / 150L = 5.60%
    expect(summary.averageGrossYieldPct).toBe(5.6);
  });
});

