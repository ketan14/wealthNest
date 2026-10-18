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

export const KNOWN_ISIN_TICKERS: Record<string, string> = {
  // Top Equities & Bluechips
  'INE002A01018': 'RELIANCE',
  'INE467B01029': 'TCS',
  'INE040A01034': 'HDFCBANK',
  'INE009A01021': 'INFY',
  'INE090A01021': 'ICICIBANK',
  'INE062A01020': 'SBIN',
  'INE018A01030': 'LT',
  'INE030A01027': 'HINDUNILVR',
  'INE154A01025': 'ITC',
  'INE238A01034': 'AXISBANK',
  'INE121A01024': 'CHOLAFIN',
  'INE860A01027': 'BHARTIARTL',
  'INE752E01010': 'POWERGRID',
  'INE081A01012': 'TATASTEEL',
  'INE101A01026': 'M&M',
  'INE585B01010': 'MARUTI',
  'INE216A01030': 'SUNPHARMA',
  'INE437A01024': 'APOLLOHOSP',
  'INE075A01022': 'WIPRO',
  'INE117A01022': 'ABB',
  'INE848E01016': 'EMBASSY',
  'INE043D01016': 'MINDSPACE',

  // Major ETFs
  'INF209K01164': 'NIFTYBEES',
  'INF204KB14I2': 'GOLDBEES',
  'INF204K01138': 'GOLDBEES',
  'INF204KB17I6': 'BANKBEES',
  'INF209KB1248': 'JUNIORBEES',
  'INF732E01037': 'MON100',
  'INF209KA12Z1': 'LIQUIDBEES',

  // Sovereign Gold Bonds
  'IN0020180017': 'SGB-2028',
  'IN0020180025': 'SGB-2028',
  'IN0020190016': 'SGB-2029',
  'IN0020200021': 'SGB-2030',
  'IN0020210012': 'SGB-2031',
};

/**
 * Infers an appropriate ticker/symbol for an asset given its ISIN and security name:
 * 1. Checks curated ISIN registry
 * 2. Matches Sovereign Gold Bond (SGB) series & maturity year
 * 3. Identifies index ETFs (Nifty, Gold, Bank, IT, Silver BeES)
 * 4. Recognizes prominent Indian enterprise names (Reliance, TCS, HDFC, Infosys, etc.)
 * 5. Synthesizes a clean symbol for equity / mutual fund schemes
 */
export function inferTickerFromSecurity(isin: string = '', securityName: string = ''): string {
  const upperIsin = isin.trim().toUpperCase();
  const rawName = securityName.trim();
  const lowerName = rawName.toLowerCase();

  // 1. Exact match from curated Indian ISIN map
  if (upperIsin && KNOWN_ISIN_TICKERS[upperIsin]) {
    return KNOWN_ISIN_TICKERS[upperIsin]!;
  }

  // 2. Sovereign Gold Bonds (SGB)
  if (lowerName.includes('sgb') || lowerName.includes('sovereign gold')) {
    const yearMatch = rawName.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      return `SGB-${yearMatch[1]}`;
    }
    return 'SGB';
  }

  // 3. ETFs (BeES and Index funds)
  if (lowerName.includes('nifty') && (lowerName.includes('bees') || lowerName.includes('etf'))) {
    return 'NIFTYBEES';
  }
  if (lowerName.includes('gold') && (lowerName.includes('bees') || lowerName.includes('etf'))) {
    return 'GOLDBEES';
  }
  if (lowerName.includes('bank') && (lowerName.includes('bees') || lowerName.includes('etf'))) {
    return 'BANKBEES';
  }
  if (lowerName.includes('it') && (lowerName.includes('bees') || lowerName.includes('etf'))) {
    return 'ITBEES';
  }
  if (lowerName.includes('silver') && (lowerName.includes('bees') || lowerName.includes('etf'))) {
    return 'SILVERBEES';
  }
  if (lowerName.includes('liquid') && (lowerName.includes('bees') || lowerName.includes('etf'))) {
    return 'LIQUIDBEES';
  }

  // 4. Common Indian enterprise names
  if (lowerName.includes('reliance')) return 'RELIANCE';
  if (lowerName.includes('tata consultancy') || lowerName.includes('tcs')) return 'TCS';
  if (lowerName.includes('hdfc bank')) return 'HDFCBANK';
  if (lowerName.includes('icici bank')) return 'ICICIBANK';
  if (lowerName.includes('infosys') || lowerName.includes('infy')) return 'INFY';
  if (lowerName.includes('state bank of india') || lowerName.includes('sbi')) return 'SBIN';
  if (lowerName.includes('larsen') || lowerName.includes('l&t')) return 'LT';
  if (lowerName.includes('bharti airtel') || lowerName.includes('airtel')) return 'BHARTIARTL';
  if (lowerName.includes('hindustan unilever') || lowerName.includes('hul')) return 'HINDUNILVR';
  if (lowerName.includes('wipro')) return 'WIPRO';
  if (lowerName.includes('embassy')) return 'EMBASSY';
  if (lowerName.includes('mindspace')) return 'MINDSPACE';

  // 5. Mutual Funds (ISIN starting with INF)
  if (upperIsin.startsWith('INF')) {
    if (lowerName.includes('parag parikh') || lowerName.includes('ppfas')) return 'PPFAS-FLEXI';
    if (lowerName.includes('dsp mid cap') || lowerName.includes('dsp midcap')) return 'DSP-MIDCAP';
    if (lowerName.includes('bandhan') || lowerName.includes('idfc')) return 'BANDHAN-MF';
    if (lowerName.includes('kotak flexi')) return 'KOTAK-FLEXI';
    if (lowerName.includes('nippon india multi asset')) return 'NIPPON-MULTI';

    const cleanTokens = rawName
      .replace(/^[\d\w]+\s*-\s*/, '') // Strip leading scheme codes like "782 - " or "001ZG - "
      .replace(/[-_/\\().]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !/^(fund|plan|growth|direct|regular|dividend|idcw|option)$/i.test(w));
    if (cleanTokens.length >= 2) {
      return `${cleanTokens[0]!.toUpperCase()}-${cleanTokens[1]!.toUpperCase().slice(0, 6)}`;
    }
    if (cleanTokens.length === 1) {
      return cleanTokens[0]!.toUpperCase().slice(0, 8);
    }
    return `MF-${upperIsin.slice(9, 12)}`;
  }

  // 6. Generic Listed Equities: Clean suffix and extract prominent word
  const cleanedEquity = rawName
    .replace(/\s*-\s*EQ\b/i, '')
    .replace(/\b(limited|ltd|corporation|corp|industries|india|holdings|services|technologies)\b/gi, '')
    .trim();

  const words = cleanedEquity.split(/\s+/).filter((w) => w.length > 1);
  if (words.length > 0 && /^[A-Za-z0-9&]+$/.test(words[0]!)) {
    return words[0]!.toUpperCase();
  }

  // 7. Fallback based on ISIN
  if (upperIsin.length === 12) {
    return upperIsin.slice(3, 8);
  }

  return rawName.slice(0, 8).toUpperCase();
}

