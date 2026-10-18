/**
 * Supported currency codes adhering to ISO-4217 standards
 */
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY' | 'INR' | 'CHF';

export interface CurrencyMetadata {
  readonly code: CurrencyCode;
  readonly symbol: string;
  readonly decimalPlaces: number;
  readonly name: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMetadata> = {
  USD: { code: 'USD', symbol: '$', decimalPlaces: 2, name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', decimalPlaces: 2, name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', decimalPlaces: 2, name: 'British Pound' },
  CAD: { code: 'CAD', symbol: 'CA$', decimalPlaces: 2, name: 'Canadian Dollar' },
  AUD: { code: 'AUD', symbol: 'AU$', decimalPlaces: 2, name: 'Australian Dollar' },
  JPY: { code: 'JPY', symbol: '¥', decimalPlaces: 0, name: 'Japanese Yen' },
  INR: { code: 'INR', symbol: '₹', decimalPlaces: 2, name: 'Indian Rupee' },
  CHF: { code: 'CHF', symbol: 'CHF', decimalPlaces: 2, name: 'Swiss Franc' },
};

/**
 * Baseline currency conversion rates relative to INR (1 Unit = X INR).
 * Used for multi-currency portfolio aggregations and cross-border assets.
 */
export const BASE_FX_RATES_TO_INR: Record<CurrencyCode, number> = {
  INR: 1,
  USD: 86.5,
  EUR: 94.0,
  GBP: 110.0,
  CAD: 62.0,
  AUD: 56.0,
  JPY: 0.58,
  CHF: 98.0,
};
