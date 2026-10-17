import { describe, it, expect } from 'vitest';
import { Money } from '../money/money.js';

describe('Money Domain Value Object', () => {
  it('creates Money from decimal and converts correctly', () => {
    const money = Money.fromDecimal(125.5, 'USD');
    expect(money.cents).toBe(12550n);
    expect(money.toDecimal()).toBe(125.5);
    expect(money.currency).toBe('USD');
  });

  it('adds two Money instances with same currency', () => {
    const m1 = Money.fromDecimal(50.25, 'USD');
    const m2 = Money.fromDecimal(49.75, 'USD');
    const sum = m1.add(m2);
    expect(sum.toDecimal()).toBe(100.0);
    expect(sum.cents).toBe(10000n);
  });

  it('subtracts two Money instances', () => {
    const m1 = Money.fromDecimal(100.0, 'EUR');
    const m2 = Money.fromDecimal(25.5, 'EUR');
    const diff = m1.subtract(m2);
    expect(diff.toDecimal()).toBe(74.5);
  });

  it('throws error when operating on mismatched currencies', () => {
    const m1 = Money.fromDecimal(100, 'USD');
    const m2 = Money.fromDecimal(100, 'EUR');
    expect(() => m1.add(m2)).toThrow(/Currency mismatch/);
  });

  it('formats correctly using Intl', () => {
    const money = Money.fromDecimal(1234.56, 'USD');
    const formatted = money.format('en-US');
    expect(formatted).toContain('1,234.56');
  });
});
