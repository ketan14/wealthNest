import { Brand } from '@wealthnest/shared';

export type ISIN = Brand<string, 'ISIN'>;

/**
 * Validates whether a string matches ISO-6166 International Securities Identification Number structure:
 * Exactly 12 alphanumeric characters: 2 letter country code + 9 alphanumeric characters + 1 check digit.
 * e.g. INE002A01018 (Reliance), INF209K01164 (Mutual Fund), IN0020180017 (SGB).
 */
export function isValidIsin(code: string): code is ISIN {
  if (!code || typeof code !== 'string') return false;
  const trimmed = code.trim().toUpperCase();
  const isinRegex = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
  return isinRegex.test(trimmed);
}

export function isIndianIsin(code: string): boolean {
  return isValidIsin(code) && code.trim().toUpperCase().startsWith('IN');
}

/**
 * Infers appropriate asset class from Indian ISIN conventions:
 * - INF... : Mutual Fund Schemes (CAMS / KFintech)
 * - IN0... / IN9... : Government Securities / Sovereign Gold Bonds (SGB)
 * - INE... : Indian Equities / Listed Securities / Corporate Bonds
 */
export function inferAssetClassFromIsin(
  isin: string,
  securityName: string = ''
): { assetClassId: string; assetType: 'equity' | 'mutual_fund' | 'bond' | 'commodity' | 'reit' | 'other' } {
  const upperIsin = isin.trim().toUpperCase();
  const lowerName = securityName.toLowerCase();

  // 1. Sovereign Gold Bonds or Gold ETFs
  if (
    lowerName.includes('sgb') ||
    lowerName.includes('sovereign gold') ||
    lowerName.includes('gold beest') ||
    lowerName.includes('gold etf')
  ) {
    return { assetClassId: 'commodity', assetType: 'commodity' };
  }

  // 2. Real Estate Investment Trusts (REITs)
  if (lowerName.includes('reit') || lowerName.includes('embassy') || lowerName.includes('mindspace')) {
    return { assetClassId: 'real_estate', assetType: 'reit' };
  }

  // 3. Mutual Funds (ISIN starting with INF)
  if (upperIsin.startsWith('INF')) {
    return { assetClassId: 'equity', assetType: 'mutual_fund' };
  }

  // 4. Government Bonds / Debt (ISIN starting with IN0 or IN9)
  if (upperIsin.startsWith('IN0') || upperIsin.startsWith('IN9') || lowerName.includes('bond') || lowerName.includes('debenture')) {
    return { assetClassId: 'fixed_income', assetType: 'bond' };
  }

  // 5. Default to Equities (standard INE listed shares)
  return { assetClassId: 'equity', assetType: 'equity' };
}
