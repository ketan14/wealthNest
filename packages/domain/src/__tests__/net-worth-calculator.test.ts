import { describe, it, expect } from 'vitest';
import { Money } from '../money/money.js';
import {
  calculateTotalAssets,
  calculateTotalLiabilities,
  calculateNetWorth,
  calculatePropertyEquity,
  calculateLtvRatio,
  calculateDebtToAssetsRatio,
  calculateTotalMonthlyEmi,
  calculateHistoricalNetWorth,
  applyLoanPayment,
  ResolvedAssetValuation,
  ResolvedLiabilityBalance,
  HistoricalNetWorthParams,
} from '../liabilities/net-worth-calculator.js';

describe('Loans & Liabilities Domain Engine — Net Worth & Calculations', () => {
  it('calculates total assets across currencies', () => {
    const assets: ResolvedAssetValuation[] = [
      {
        assetId: 'a-1',
        assetName: 'Samyak Apartment Vejalpur',
        assetClassId: 'real_estate',
        valuation: Money.fromDecimal(8500000, 'INR'), // 85 Lakhs
        asOfDate: '2026-10-01',
      },
      {
        assetId: 'a-2',
        assetName: 'Liquid Savings',
        assetClassId: 'cash',
        valuation: Money.fromDecimal(500000, 'INR'), // 5 Lakhs
        asOfDate: '2026-10-01',
      },
    ];

    const total = calculateTotalAssets(assets, 'INR');
    expect(total.toDecimal()).toBe(9000000); // 90 Lakhs
  });

  it('calculates total liabilities ensuring deduplication and ignoring closed loans', () => {
    const liabilities: ResolvedLiabilityBalance[] = [
      {
        liabilityId: 'l-1',
        name: 'HDFC Home Loan',
        loanType: 'home_loan',
        lender: 'HDFC Bank',
        status: 'active',
        emiAmount: Money.fromDecimal(45000, 'INR'),
        originalPrincipal: Money.fromDecimal(5000000, 'INR'),
        outstandingBalance: Money.fromDecimal(3800000, 'INR'), // 38 Lakhs
        asOfDate: '2026-10-01',
        linkedAssetId: 'a-1',
      },
      // Duplicate entry of l-1 (e.g. from an asset join)
      {
        liabilityId: 'l-1',
        name: 'HDFC Home Loan (Duplicate)',
        loanType: 'home_loan',
        lender: 'HDFC Bank',
        status: 'active',
        emiAmount: Money.fromDecimal(45000, 'INR'),
        originalPrincipal: Money.fromDecimal(5000000, 'INR'),
        outstandingBalance: Money.fromDecimal(3800000, 'INR'),
        asOfDate: '2026-10-01',
        linkedAssetId: 'a-1',
      },
      {
        liabilityId: 'l-2',
        name: 'Car Loan',
        loanType: 'vehicle_loan',
        lender: 'SBI',
        status: 'active',
        emiAmount: Money.fromDecimal(15000, 'INR'),
        originalPrincipal: Money.fromDecimal(800000, 'INR'),
        outstandingBalance: Money.fromDecimal(400000, 'INR'), // 4 Lakhs
        asOfDate: '2026-10-01',
      },
      {
        liabilityId: 'l-3',
        name: 'Old Personal Loan (Closed)',
        loanType: 'personal_loan',
        lender: 'ICICI Bank',
        status: 'closed',
        emiAmount: Money.fromDecimal(10000, 'INR'),
        originalPrincipal: Money.fromDecimal(300000, 'INR'),
        outstandingBalance: Money.zero('INR'),
        asOfDate: '2026-10-01',
      },
    ];

    const total = calculateTotalLiabilities(liabilities, 'INR');
    // 38 Lakhs + 4 Lakhs = 42 Lakhs (deduped l-1 and omitted closed l-3)
    expect(total.toDecimal()).toBe(4200000);
  });

  it('calculates Net Worth = Assets - Liabilities (Solvent State)', () => {
    const assets = Money.fromDecimal(9000000, 'INR'); // 90 Lakhs
    const liabilities = Money.fromDecimal(4200000, 'INR'); // 42 Lakhs

    const res = calculateNetWorth(assets, liabilities);
    expect(res.isSolvent).toBe(true);
    expect(res.netWorth.toDecimal()).toBe(4800000); // 48 Lakhs
    expect(res.netDifferencePaise).toBe(480000000n);
  });

  it('calculates Net Worth when liabilities exceed assets (Insolvent State)', () => {
    const assets = Money.fromDecimal(2000000, 'INR'); // 20 Lakhs
    const liabilities = Money.fromDecimal(3500000, 'INR'); // 35 Lakhs

    const res = calculateNetWorth(assets, liabilities);
    expect(res.isSolvent).toBe(false);
    expect(res.netWorth.toDecimal()).toBe(1500000); // 15 Lakhs deficit
    expect(res.netDifferencePaise).toBe(-150000000n);
  });

  it('handles multiple loans linked to a single property and calculates LTV and property equity', () => {
    const propertyValue = Money.fromDecimal(10000000, 'INR'); // 1 Crore (100 Lakhs)
    const primaryHomeLoan = Money.fromDecimal(5000000, 'INR'); // 50 Lakhs
    const topUpLoan = Money.fromDecimal(1500000, 'INR'); // 15 Lakhs

    const equityRes = calculatePropertyEquity(propertyValue, [primaryHomeLoan, topUpLoan]);
    expect(equityRes.isNegativeEquity).toBe(false);
    expect(equityRes.totalDebt.toDecimal()).toBe(6500000); // 65 Lakhs
    expect(equityRes.equity.toDecimal()).toBe(3500000); // 35 Lakhs equity

    const ltv = calculateLtvRatio(equityRes.totalDebt, propertyValue);
    expect(ltv).toBe(65); // 65% LTV
  });

  it('detects negative equity when property value drops below outstanding debt', () => {
    const propertyValue = Money.fromDecimal(4000000, 'INR'); // 40 Lakhs
    const loanBalance = Money.fromDecimal(5000000, 'INR'); // 50 Lakhs

    const equityRes = calculatePropertyEquity(propertyValue, [loanBalance]);
    expect(equityRes.isNegativeEquity).toBe(true);
    expect(equityRes.equity.toDecimal()).toBe(1000000); // ₹10 Lakhs underwater
    expect(equityRes.equityDifferencePaise).toBe(-100000000n);

    const ltv = calculateLtvRatio(equityRes.totalDebt, propertyValue);
    expect(ltv).toBe(125); // 125% LTV
  });

  it('handles zero property value gracefully without division by zero', () => {
    const propertyValue = Money.zero('INR');
    const loanDebt = Money.fromDecimal(500000, 'INR');

    const ltvWithDebt = calculateLtvRatio(loanDebt, propertyValue);
    expect(ltvWithDebt).toBe(100);

    const ltvZeroDebt = calculateLtvRatio(Money.zero('INR'), propertyValue);
    expect(ltvZeroDebt).toBe(0);
  });

  it('calculates debt-to-assets ratio safely', () => {
    const debt = Money.fromDecimal(4000000, 'INR');
    const assets = Money.fromDecimal(10000000, 'INR');

    const ratio = calculateDebtToAssetsRatio(debt, assets);
    expect(ratio).toBe(0.4); // 40%

    // Edge case: zero assets
    expect(calculateDebtToAssetsRatio(debt, Money.zero('INR'))).toBe(1);
    expect(calculateDebtToAssetsRatio(Money.zero('INR'), Money.zero('INR'))).toBe(0);
  });

  it('calculates total active monthly EMI commitment', () => {
    const loans = [
      { emiAmount: Money.fromDecimal(35000, 'INR'), status: 'active' as const },
      { emiAmount: Money.fromDecimal(12000, 'INR'), status: 'active' as const },
      { emiAmount: Money.fromDecimal(8000, 'INR'), status: 'closed' as const },
    ];

    const totalEmi = calculateTotalMonthlyEmi(loans, 'INR');
    expect(totalEmi.toDecimal()).toBe(47000); // 35k + 12k
  });

  it('calculates historical net worth as of a specific date ignoring future records', () => {
    const params: HistoricalNetWorthParams = {
      asOfDate: '2024-06-30',
      assets: [
        {
          assetId: 'prop-1',
          name: 'Apartment',
          assetClassId: 'real_estate',
          valuations: [
            { asOfDate: '2023-01-01', value: Money.fromDecimal(6000000, 'INR') },
            { asOfDate: '2024-06-01', value: Money.fromDecimal(7000000, 'INR') }, // Valid on 2024-06-30
            { asOfDate: '2025-01-01', value: Money.fromDecimal(8500000, 'INR') }, // Future record (MUST BE IGNORED)
          ],
        },
      ],
      liabilities: [
        {
          liabilityId: 'loan-1',
          name: 'Home Loan',
          loanType: 'home_loan',
          lender: 'SBI',
          status: 'active',
          emiAmount: Money.fromDecimal(50000, 'INR'),
          originalPrincipal: Money.fromDecimal(5000000, 'INR'),
          startDate: '2023-01-01',
          balances: [
            { asOfDate: '2023-01-01', balance: Money.fromDecimal(5000000, 'INR') },
            { asOfDate: '2024-05-31', balance: Money.fromDecimal(4500000, 'INR') }, // Valid on 2024-06-30
            { asOfDate: '2025-05-31', balance: Money.fromDecimal(4000000, 'INR') }, // Future record (MUST BE IGNORED)
          ],
          linkedAssetId: 'prop-1',
        },
      ],
    };

    const summary = calculateHistoricalNetWorth(params);
    expect(summary.asOfDate).toBe('2024-06-30');
    // Must use 70 Lakhs (from 2024-06-01), NOT 85 Lakhs (from 2025)
    expect(summary.totalAssets.toDecimal()).toBe(7000000);
    // Must use 45 Lakhs (from 2024-05-31), NOT 40 Lakhs (from 2025)
    expect(summary.totalLiabilities.toDecimal()).toBe(4500000);
    // Net worth = 70L - 45L = 25 Lakhs
    expect(summary.netWorth.toDecimal()).toBe(2500000);
    expect(summary.isSolvent).toBe(true);

    // Property Equity = 70L - 45L = 25 Lakhs, LTV = 45L / 70L ≈ 64.28%
    expect(summary.propertyEquities).toHaveLength(1);
    expect(summary.propertyEquities[0]!.equity.toDecimal()).toBe(2500000);
    expect(summary.propertyEquities[0]!.ltvRatioPercentage).toBe(64.28);
  });

  it('reports missing asset valuations and missing balances without silently treating them as zero', () => {
    const params: HistoricalNetWorthParams = {
      asOfDate: '2020-01-01',
      assets: [
        {
          assetId: 'prop-2',
          name: 'Future Land',
          assetClassId: 'real_estate',
          // Has no valuation on or before 2020-01-01
          valuations: [{ asOfDate: '2022-01-01', value: Money.fromDecimal(5000000, 'INR') }],
        },
      ],
      liabilities: [
        {
          liabilityId: 'loan-2',
          name: 'Unrecorded Loan',
          loanType: 'personal_loan',
          lender: 'HDFC',
          status: 'active',
          emiAmount: Money.fromDecimal(10000, 'INR'),
          originalPrincipal: Money.fromDecimal(500000, 'INR'),
          // No start date or balance on or before 2020-01-01
          balances: [{ asOfDate: '2023-01-01', balance: Money.fromDecimal(400000, 'INR') }],
        },
      ],
    };

    const summary = calculateHistoricalNetWorth(params);
    expect(summary.missingAssetValuations).toContain('Future Land');
    expect(summary.missingLiabilityBalances).toContain('Unrecorded Loan');
  });

  it('applies accounting rules to loan payments: principal reduces liability, interest is expense', () => {
    const currentBalance = Money.fromDecimal(4000000, 'INR'); // 40 Lakhs

    const payment = {
      currentBalance,
      principalPaid: Money.fromDecimal(20000, 'INR'), // 20k principal
      interestPaid: Money.fromDecimal(30000, 'INR'), // 30k interest
      extraPrincipalPaid: Money.fromDecimal(50000, 'INR'), // 50k extra prepay
    };

    const result = applyLoanPayment(payment);
    // Total principal reduction = 20k + 50k = 70k
    expect(result.totalPrincipalReduction.toDecimal()).toBe(70000);
    // New loan balance = 40,00,000 - 70,000 = 39,30,000
    expect(result.newBalance.toDecimal()).toBe(3930000);
    // Interest expense is exactly 30k and does NOT reduce loan balance
    expect(result.interestExpense.toDecimal()).toBe(30000);
  });

  it('reproduces date-correct historical net worth across a multi-year progression', () => {
    const historicalTimelineParams = {
      assets: [
        {
          assetId: 'prop-vaghela-residence',
          name: 'Ahmedabad Residential Apartment',
          assetClassId: 'real_estate',
          valuations: [
            { asOfDate: '2024-01-01', value: Money.fromDecimal(5000000, 'INR') }, // ₹50 L
            { asOfDate: '2025-01-01', value: Money.fromDecimal(6000000, 'INR') }, // ₹60 L
            { asOfDate: '2026-01-01', value: Money.fromDecimal(7500000, 'INR') }, // ₹75 L
          ],
        },
      ],
      liabilities: [
        {
          liabilityId: 'loan-sbi-home',
          name: 'SBI Home Loan',
          loanType: 'home_loan' as const,
          lender: 'SBI',
          status: 'active' as const,
          emiAmount: Money.fromDecimal(45000, 'INR'),
          originalPrincipal: Money.fromDecimal(4500000, 'INR'),
          startDate: '2023-12-01',
          balances: [
            { asOfDate: '2024-01-01', balance: Money.fromDecimal(4000000, 'INR') }, // ₹40 L
            { asOfDate: '2025-01-01', balance: Money.fromDecimal(3500000, 'INR') }, // ₹35 L
            { asOfDate: '2026-01-01', balance: Money.fromDecimal(2800000, 'INR') }, // ₹28 L
          ],
        },
      ],
    };

    // 1. As of 2024-01-01: 50L - 40L = 10 Lakhs
    const nw2024 = calculateHistoricalNetWorth({
      ...historicalTimelineParams,
      asOfDate: '2024-01-01',
    });
    expect(nw2024.totalAssets.toDecimal()).toBe(5000000);
    expect(nw2024.totalLiabilities.toDecimal()).toBe(4000000);
    expect(nw2024.netWorth.toDecimal()).toBe(1000000);

    // 2. As of mid-year 2024 (2024-08-15): Strictly picks prior 2024-01-01 valuations
    const nwMid2024 = calculateHistoricalNetWorth({
      ...historicalTimelineParams,
      asOfDate: '2024-08-15',
    });
    expect(nwMid2024.netWorth.toDecimal()).toBe(1000000);

    // 3. As of 2025-01-01: 60L - 35L = 25 Lakhs
    const nw2025 = calculateHistoricalNetWorth({
      ...historicalTimelineParams,
      asOfDate: '2025-01-01',
    });
    expect(nw2025.totalAssets.toDecimal()).toBe(6000000);
    expect(nw2025.totalLiabilities.toDecimal()).toBe(3500000);
    expect(nw2025.netWorth.toDecimal()).toBe(2500000);

    // 4. As of 2026-01-01: 75L - 28L = 47 Lakhs
    const nw2026 = calculateHistoricalNetWorth({
      ...historicalTimelineParams,
      asOfDate: '2026-01-01',
    });
    expect(nw2026.totalAssets.toDecimal()).toBe(7500000);
    expect(nw2026.totalLiabilities.toDecimal()).toBe(2800000);
    expect(nw2026.netWorth.toDecimal()).toBe(4700000);
  });
});
