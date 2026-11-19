import { describe, it, expect } from 'vitest';
import { formatCompactRupees, formatExactRupees } from './currency';

describe('formatCompactRupees', () => {
  it('formats amounts matching the user standard table exactly', () => {
    expect(formatCompactRupees(650)).toBe('₹650');
    expect(formatCompactRupees(1250)).toBe('₹1.25K');
    expect(formatCompactRupees(22000)).toBe('₹22.00K');
    expect(formatCompactRupees(100000)).toBe('₹1.00L');
    expect(formatCompactRupees(1505000)).toBe('₹15.05L');
    expect(formatCompactRupees(12745820)).toBe('₹1.27Cr');
  });

  it('handles negative values correctly', () => {
    expect(formatCompactRupees(-22000)).toBe('-₹22.00K');
    expect(formatCompactRupees(-1505000)).toBe('-₹15.05L');
  });

  it('supports explicit positive and negative sign when showSign is enabled', () => {
    expect(formatCompactRupees(45000, { showSign: true })).toBe('+₹45.00K');
    expect(formatCompactRupees(-6000, { showSign: true })).toBe('-₹6.00K');
    expect(formatCompactRupees(0, { showSign: true })).toBe('₹0');
  });

  it('respects privacy masking', () => {
    expect(formatCompactRupees(12745820, { masked: true })).toBe('₹ ••••••');
  });

  it('formats non-compact exact numbers with Indian locale', () => {
    expect(formatExactRupees(12745820.5)).toBe('₹1,27,45,820.50');
  });
});
