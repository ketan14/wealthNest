import { describe, it, expect } from 'vitest';
import { formatInr } from './formatInr';

describe('formatInr standardized utility', () => {
  it('returns ₹0 for zero, NaN, and Infinity', () => {
    expect(formatInr(0)).toBe('₹0');
    expect(formatInr(-0)).toBe('₹0');
    expect(formatInr(Number.NaN)).toBe('₹0');
    expect(formatInr(Number.POSITIVE_INFINITY)).toBe('₹0');
    expect(formatInr(0, { compact: false })).toBe('₹0');
  });

  it('formats Crores, Lakhs, and sub-Lakh values in compact mode', () => {
    expect(formatInr(24_500_000, { compact: true })).toBe('₹2.45Cr');
    expect(formatInr(24_500_000, { compact: true, compactDecimals: 1 })).toBe('₹2.5Cr');
    expect(formatInr(350_000, { compact: true })).toBe('₹3.50L');
    expect(formatInr(350_000, { compact: true, compactDecimals: 1 })).toBe('₹3.5L');
    expect(formatInr(42_500, { compact: true })).toBe('₹42,500');
  });

  it('preserves leading minus sign for negative numbers and optional plus sign', () => {
    expect(formatInr(-1_250_000, { compact: true })).toBe('-₹12.50L');
    expect(formatInr(-50_000, { compact: false })).toBe('-₹50,000');
    expect(formatInr(250_000, { compact: true, showSign: true })).toBe('+₹2.50L');
  });

  it('formats full en-IN rounded numbers when compact is false', () => {
    expect(formatInr(12_745_820.6, { compact: false })).toBe('₹1,27,45,821');
    expect(formatInr(850, { compact: false })).toBe('₹850');
  });
});
