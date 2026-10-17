import { describe, it, expect } from 'vitest';
import { Money } from '../money/money.js';

describe('Money Domain Value Object (India First)', () => {
  it('defaults to INR currency and converts decimals to paise accurately', () => {
    const money = Money.fromDecimal(125.5);
    expect(money.cents).toBe(12550n);
    expect(money.toDecimal()).toBe(125.5);
    expect(money.currency).toBe('INR');
  });

  it('adds two Money instances with same currency', () => {
    const m1 = Money.fromDecimal(50.25, 'INR');
    const m2 = Money.fromDecimal(49.75, 'INR');
    const sum = m1.add(m2);
    expect(sum.toDecimal()).toBe(100.0);
    expect(sum.cents).toBe(10000n);
  });

  it('subtracts two Money instances', () => {
    const m1 = Money.fromDecimal(100.0, 'INR');
    const m2 = Money.fromDecimal(25.5, 'INR');
    const diff = m1.subtract(m2);
    expect(diff.toDecimal()).toBe(74.5);
  });

  it('throws error when operating on mismatched currencies', () => {
    const m1 = Money.fromDecimal(100, 'INR');
    const m2 = Money.fromDecimal(100, 'USD');
    expect(() => m1.add(m2)).toThrow(/Currency mismatch/);
  });

  it('formats correctly using en-IN grouping (e.g. 15 Lakhs)', () => {
    const money = Money.fromDecimal(1500000, 'INR');
    const formatted = money.format('en-IN');
    // In en-IN locale, 1500000 formats with Indian comma grouping 15,00,000
    expect(formatted).toContain('15,00,000');
    expect(formatted).toContain('₹');
  });

  it('formats compact Indian denominations (Crores, Lakhs, Thousands)', () => {
    const crore = Money.fromDecimal(15000000, 'INR'); // 1.5 Cr
    expect(crore.formatIndianCompact()).toBe('₹1.50 Cr');

    const lakh = Money.fromDecimal(2540000, 'INR'); // 25.4 L
    expect(lakh.formatIndianCompact()).toBe('₹25.40 L');

    const thousand = Money.fromDecimal(45000, 'INR'); // 45 K
    expect(thousand.formatIndianCompact()).toBe('₹45.00 K');
  });
});
