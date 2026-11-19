/**
 * Unified Indian Currency Formatter for WealthNest
 * 
 * Standard:
 * < ₹1,000        -> ₹650
 * ₹1,250          -> ₹1.25K
 * ₹22,000         -> ₹22.00K
 * ₹1,00,000       -> ₹1.00L
 * ₹15,05,000      -> ₹15.05L
 * ₹1,27,45,820    -> ₹1.27Cr
 * 
 * Exact Mode:
 * ₹1,27,45,820.50 (Standard Indian Numbering Format)
 */

export interface FormatRupeesOptions {
  /**
   * If true, always formats to compact representation (K, L, Cr).
   * Default: true.
   */
  compact?: boolean;
  /**
   * If true, prepends '+' for positive values and '-' for negative values.
   */
  showSign?: boolean;
  /**
   * Currency symbol to use. Defaults to '₹'.
   */
  symbol?: string;
  /**
   * If true, masks the amount for privacy (e.g. '₹ ••••••').
   */
  masked?: boolean;
  /**
   * Number of decimal places in compact mode. Defaults to 2.
   */
  compactDecimals?: number;
}

/**
 * Formats a numeric rupee amount (in whole rupees or decimal rupees) into compact Indian notation.
 * Preserves arithmetic precision internally; purely handles presentation.
 */
export function formatCompactRupees(
  amount: number,
  options: FormatRupeesOptions = {}
): string {
  const {
    compact = true,
    showSign = false,
    symbol = '₹',
    masked = false,
    compactDecimals = 2,
  } = options;

  if (masked) {
    return `${symbol} ••••••`;
  }

  if (isNaN(amount) || !isFinite(amount)) {
    return `${symbol}0`;
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  let signPrefix = '';
  if (showSign) {
    if (isNegative) {
      signPrefix = '-';
    } else if (amount > 0) {
      signPrefix = '+';
    }
  } else if (isNegative) {
    signPrefix = '-';
  }

  if (!compact) {
    return `${signPrefix}${symbol}${absAmount.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    })}`;
  }

  // Exact standard matching:
  // >= 1 Crore (1,00,00,000) -> Cr
  if (absAmount >= 10_000_000) {
    const crValue = absAmount / 10_000_000;
    const formatted = crValue.toFixed(compactDecimals);
    return `${signPrefix}${symbol}${formatted}Cr`;
  }

  // >= 1 Lakh (1,00,000) -> L
  if (absAmount >= 100_000) {
    const lValue = absAmount / 100_000;
    const formatted = lValue.toFixed(compactDecimals);
    return `${signPrefix}${symbol}${formatted}L`;
  }

  // >= 1 Thousand (1,000) -> K
  if (absAmount >= 1_000) {
    const kValue = absAmount / 1_000;
    const formatted = kValue.toFixed(compactDecimals);
    return `${signPrefix}${symbol}${formatted}K`;
  }

  // < 1,000 -> full integer/decimal
  const formattedSmall = absAmount.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  });
  return `${signPrefix}${symbol}${formattedSmall}`;
}

/**
 * Returns the exact unabridged formatted currency string for tooltips / tap-to-reveal.
 */
export function formatExactRupees(
  amount: number,
  symbol: string = '₹',
  masked: boolean = false
): string {
  if (masked) return `${symbol} ••••••`;
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const sign = isNegative ? '-' : '';
  return `${sign}${symbol}${absAmount.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}
