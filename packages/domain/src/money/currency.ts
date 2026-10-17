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
