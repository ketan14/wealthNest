import { describe, it, expect } from 'vitest';
import { Money } from '../money/money.js';
import { bifurcateLoanPayment } from '../models/loan-amortization.js';

describe('Domain: Loan Amortization & EMI Bifurcation', () => {
  it('bifurcates standard monthly EMI into principal and interest', () => {
    // Outstanding balance: ₹50,00,000 (50 Lakhs)
    // Interest rate: 8.5% p.a.
    // Monthly interest = 50,00,000 * 8.5 / 1200 = ₹35,416.67
    // EMI: ₹43,391
    // Principal component = 43,391 - 35,416.67 = ₹7,974.33
    const balance = Money.fromDecimal(5000000, 'INR');
    const emi = Money.fromDecimal(43391, 'INR');

    const result = bifurcateLoanPayment(balance, 8.5, emi);

    expect(result.interestPart.toDecimal()).toBe(35416.67);
    expect(result.principalPart.toDecimal()).toBe(7974.33);
    expect(result.remainingBalance.toDecimal()).toBe(5000000 - 7974.33);
  });

  it('handles extra principal prepayment reducing debt directly', () => {
    const balance = Money.fromDecimal(2000000, 'INR'); // 20 Lakhs
    const emi = Money.fromDecimal(30000, 'INR');
    const prepayment = Money.fromDecimal(100000, 'INR'); // 1 Lakh extra payment

    // Monthly interest = 20,00,000 * 9.0 / 1200 = ₹15,000
    // Regular principal = 30,000 - 15,000 = ₹15,000
    // Total principal reduction = 15,000 + 1,00,000 = ₹1,15,000
    const result = bifurcateLoanPayment(balance, 9.0, emi, prepayment);

    expect(result.interestPart.toDecimal()).toBe(15000);
    expect(result.principalPart.toDecimal()).toBe(15000);
    expect(result.extraPayment.toDecimal()).toBe(100000);
    expect(result.remainingBalance.toDecimal()).toBe(2000000 - 115000);
  });

  it('prevents negative remaining balance when extra payment exceeds debt', () => {
    const balance = Money.fromDecimal(50000, 'INR');
    const emi = Money.fromDecimal(60000, 'INR');

    const result = bifurcateLoanPayment(balance, 10.0, emi);
    expect(result.remainingBalance.toDecimal()).toBe(0);
  });
});
