export interface FormatInrOptions {
  readonly compact?: boolean;
  readonly compactDecimals?: number;
  readonly showSign?: boolean;
}

/**
 * Standardized INR currency formatter for Analytics KPI cards, charts, Y-axis ticks, and tooltips.
 * - Zero, NaN, or non-finite values always return '₹0'.
 * - Preserves a leading '-' sign for negative values.
 * - Compact mode formats Crores (>= 1Cr), Lakhs (>= 1L), and en-IN integers below ₹1,00,000.
 */
export function formatInr(amount: number, options: FormatInrOptions = {}): string {
  const { compact = true, compactDecimals = 2, showSign = false } = options;

  if (!Number.isFinite(amount) || Math.abs(amount) === 0) {
    return '₹0';
  }

  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const sign = isNegative ? '-' : showSign ? '+' : '';

  if (compact) {
    if (abs >= 10_000_000) {
      return `${sign}₹${(abs / 10_000_000).toFixed(compactDecimals)}Cr`;
    }
    if (abs >= 100_000) {
      return `${sign}₹${(abs / 100_000).toFixed(compactDecimals)}L`;
    }
    return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
  }

  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}
