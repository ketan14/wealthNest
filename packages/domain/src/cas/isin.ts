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
 * Cleans noisy security names extracted from Indian CAS statements:
 * - Strips leading numbering (e.g. "104 - ", "782 - ")
 * - Strips "ISIN:" prefix
 * - Strips boilerplate share noise (e.g. "# EQUITY SHARES ...", "OF RS 1/- EACH AFTER SUB DIVISION")
 * - Strips table boundary dashes ("-- -- --")
 * - Requires at least one alphabetic character (rejects pure numbers, dashes, symbols)
 */
export function cleanSecurityName(rawName: string = ''): string {
  if (!rawName) return '';
  let cleaned = rawName.trim();

  // Strip leading ISIN prefix if present
  cleaned = cleaned.replace(/^ISIN[:\s]*/i, '');

  // Strip table column header leakage and currency symbol noise like "( ₹ )", "( ` )"
  cleaned = cleaned.replace(
    /^(?:.*?(?:Unrealised|Unreal\s*ised|Profit\/\s*Loss|\(in absolute terms.*?\)|(?:ised\s+)?Loss\s+\(%\)\s*Regular\s*Direct|ISIN\s*तभूत.*)\s*)+/gi,
    ''
  );
  cleaned = cleaned.replace(/^\(\s*[₹`]\s*\)\s*/, '');
  cleaned = cleaned.replace(
    /^(?:CDSL\s+DEMAT(?:\s+खाता\s+विवरण)?|ACCOUNT\s+DETAILS|MUTUAL\s+FUND\s+UNITS\s+HELD[^\n]*)\s*/gi,
    ''
  );

  // Strip leading numbering or bullet prefixes like "104 - ", "782 - ", "D201 - ", "001ZG - "
  cleaned = cleaned.replace(/^[A-Z0-9]+(?:\/[A-Z0-9]+)*\s*-\s+/, '');
  cleaned = cleaned.replace(/^[#\-*]\s*/, '');

  // Strip "( Formerly Known as ... )"
  cleaned = cleaned.replace(/\(\s*Formerly Known as[^)]*\)/gi, '');

  // Strip boilerplate share and face value noise
  cleaned = cleaned.replace(/[-#]?\s*(?:NEW\s+)?EQUITY\s+SHARES.*$/i, '');
  cleaned = cleaned.replace(/[-#]?\s*ORDINARY\s+SHARES.*$/i, '');
  cleaned = cleaned.replace(/[-#]?\s*SHARES\s+OF\s+RS\.?.*$/i, '');
  cleaned = cleaned.replace(/[-#]?\s*WITH\s+FACE\s+VALUE\s+RS\.?.*$/i, '');
  cleaned = cleaned.replace(/[-#]?\s*WITH\s+DIFFERENTIAL\s+VOTING\s+RIGHTS.*$/i, '');
  cleaned = cleaned.replace(/[-#]?\s*FV\s+RS\.?.*$/i, '');
  cleaned = cleaned.replace(/[-#]?\s*AFTER\s+SUB\s+DIVISION.*$/i, '');
  cleaned = cleaned.replace(/[-#]?\s*AFTER\s+SUB-DIVISION.*$/i, '');
  cleaned = cleaned.replace(/[-#]?\s*SUB\s+DIVIDED.*$/i, '');
  cleaned = cleaned.replace(/\s+--\s*--\s*--.*$/, '');

  // If there's a '#' separating AMC and fund: replace '#' with ' - '
  cleaned = cleaned.replace(/\s*#\s*/g, ' - ');
  cleaned = cleaned.replace(/[-–—:,#]\s*$/, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  // Reject strings without letters (pure numbers, dashes, punctuation)
  if (!/[a-zA-Z]/.test(cleaned)) {
    return '';
  }

  // Reject uninformative single boilerplate words
  if (/^(?:ISIN|EQUITY|SHARES|LIMITED|LTD|BO\s*ID|STATEMENT|PAGE)$/i.test(cleaned)) {
    return '';
  }

  return cleaned;
}

export type StatementSectionHint = 'demat' | 'mutual_fund_rta' | 'unknown';

export interface InstrumentClassification {
  readonly assetClassId: string;
  readonly assetType: 'equity' | 'mutual_fund' | 'bond' | 'commodity' | 'reit' | 'other';
  readonly instrumentType:
    'equity_share' | 'mutual_fund_scheme' | 'etf' | 'reit' | 'sgb' | 'bond' | 'other';
}

/**
 * Classifies supported instruments using ISIN, statement section, and validated reference patterns.
 * Treats ISIN prefixes strictly as hints, not definitive tax or asset classifications.
 */
export function inferAssetClassFromIsin(
  isin: string,
  securityName: string = '',
  statementSection: StatementSectionHint = 'unknown'
): InstrumentClassification {
  const upperIsin = isin.trim().toUpperCase();
  const lowerName = securityName.toLowerCase();

  // 1. Explicit Statement Section Priority: Mutual Fund RTA folios
  if (statementSection === 'mutual_fund_rta') {
    return {
      assetClassId: 'mutual_fund',
      assetType: 'mutual_fund',
      instrumentType: 'mutual_fund_scheme',
    };
  }

  // 2. Sovereign Gold Bonds (SGB) — Commodities
  if (
    lowerName.includes('sgb') ||
    lowerName.includes('sovereign gold') ||
    (upperIsin.startsWith('IN00') && (lowerName.includes('gold') || lowerName.includes('sgb')))
  ) {
    return {
      assetClassId: 'commodity',
      assetType: 'commodity',
      instrumentType: 'sgb',
    };
  }

  // 3. Precious Metals ETFs (Gold / Silver BeES) — Commodities
  if (
    lowerName.includes('gold bees') ||
    lowerName.includes('gold etf') ||
    lowerName.includes('silver bees') ||
    lowerName.includes('silver etf')
  ) {
    return {
      assetClassId: 'commodity',
      assetType: 'commodity',
      instrumentType: 'etf',
    };
  }

  // 4. Liquid / Overnight Cash ETFs (Liquid BeES) — Cash
  if (
    lowerName.includes('liquid bees') ||
    lowerName.includes('liquid etf') ||
    lowerName.includes('liquid fund')
  ) {
    return {
      assetClassId: 'cash',
      assetType: 'other',
      instrumentType: 'etf',
    };
  }

  // 5. Real Estate Investment Trusts (REITs)
  if (
    lowerName.includes('reit') ||
    lowerName.includes('embassy') ||
    lowerName.includes('mindspace') ||
    lowerName.includes('brookfield')
  ) {
    return {
      assetClassId: 'real_estate',
      assetType: 'reit',
      instrumentType: 'reit',
    };
  }

  // 6. Mutual Fund Schemes vs Exchange Traded Funds (INF... ISIN)
  if (upperIsin.startsWith('INF')) {
    // If traded on stock exchange as an ETF (e.g. Nifty BeES, Bank BeES, CPSE ETF)
    if (
      lowerName.includes('bees') ||
      lowerName.includes('etf') ||
      lowerName.includes('exchange traded fund')
    ) {
      return {
        assetClassId: 'equity',
        assetType: 'equity',
        instrumentType: 'etf',
      };
    }
    return {
      assetClassId: 'mutual_fund',
      assetType: 'mutual_fund',
      instrumentType: 'mutual_fund_scheme',
    };
  }

  // 7. Government Securities / Debt / Corporate Bonds (IN0..., IN9..., Bonds, NCDs)
  if (
    upperIsin.startsWith('IN0') ||
    upperIsin.startsWith('IN9') ||
    lowerName.includes('bond') ||
    lowerName.includes('debenture') ||
    lowerName.includes('ncd')
  ) {
    return {
      assetClassId: 'fixed_income',
      assetType: 'bond',
      instrumentType: 'bond',
    };
  }

  // 8. Default: Listed Equity Shares (standard INE... shares)
  return {
    assetClassId: 'equity',
    assetType: 'equity',
    instrumentType: 'equity_share',
  };
}

export interface MutualFundSchemeDetails {
  readonly amcName: string;
  readonly plan: 'Direct' | 'Regular' | 'Unknown';
  readonly option: 'Growth' | 'IDCW' | 'Dividend' | 'Unknown';
  readonly schemePlan?: string;
  readonly cleanSchemeName: string;
}

export function extractMutualFundSchemeDetails(rawSchemeName: string): MutualFundSchemeDetails {
  const cleaned = cleanSecurityName(rawSchemeName);
  const lower = cleaned.toLowerCase();

  // Detect Plan
  let plan: 'Direct' | 'Regular' | 'Unknown' = 'Unknown';
  if (lower.includes('direct')) {
    plan = 'Direct';
  } else if (lower.includes('regular')) {
    plan = 'Regular';
  }

  // Detect Option
  let option: 'Growth' | 'IDCW' | 'Dividend' | 'Unknown' = 'Unknown';
  if (lower.includes('growth')) {
    option = 'Growth';
  } else if (lower.includes('idcw')) {
    option = 'IDCW';
  } else if (lower.includes('dividend')) {
    option = 'Dividend';
  }

  // Known Indian AMCs pattern recognition
  const amcPatterns: [RegExp, string][] = [
    [/\b(?:Bandhan|IDFC)\b/i, 'Bandhan Mutual Fund'],
    [/\bParag\s*Parikh|PPFAS\b/i, 'PPFAS Mutual Fund'],
    [/\bHDFC\b/i, 'HDFC Mutual Fund'],
    [/\bICICI\s*Pru(?:dential)?\b/i, 'ICICI Prudential Mutual Fund'],
    [/\bSBI\b/i, 'SBI Mutual Fund'],
    [/\bKotak(?:\s*Mahindra)?\b/i, 'Kotak Mahindra Mutual Fund'],
    [/\bNippon(?:\s*India)?\b/i, 'Nippon India Mutual Fund'],
    [/\bAxis\b/i, 'Axis Mutual Fund'],
    [/\bMirae\s*Asset\b/i, 'Mirae Asset Mutual Fund'],
    [/\bUTI\b/i, 'UTI Mutual Fund'],
    [/\bDSP\b/i, 'DSP Mutual Fund'],
    [/\bTata\b/i, 'Tata Mutual Fund'],
    [/\bQuant\b/i, 'Quant Mutual Fund'],
    [/\bMotilal\s*Oswal\b/i, 'Motilal Oswal Mutual Fund'],
    [/\bAditya\s*Birla|ABSL\b/i, 'Aditya Birla Sun Life Mutual Fund'],
    [/\bFranklin(?:\s*Templeton)?\b/i, 'Franklin Templeton Mutual Fund'],
    [/\bEdelweiss\b/i, 'Edelweiss Mutual Fund'],
    [/\bCanara\s*Robeco\b/i, 'Canara Robeco Mutual Fund'],
    [/\bSundaram\b/i, 'Sundaram Mutual Fund'],
    [/\bInvesco\b/i, 'Invesco Mutual Fund'],
    [/\bWhiteOak\b/i, 'WhiteOak Capital Mutual Fund'],
    [/\bHSBC\b/i, 'HSBC Mutual Fund'],
  ];

  let amcName = '';
  for (const [pattern, name] of amcPatterns) {
    if (pattern.test(cleaned)) {
      amcName = name;
      break;
    }
  }

  if (!amcName) {
    const parts = cleaned.split('-');
    if (parts.length > 1 && parts[0]!.trim().length > 3) {
      amcName = parts[0]!.trim();
    }
  }

  const schemePlan =
    plan !== 'Unknown' ? `${plan} Plan${option !== 'Unknown' ? ` - ${option}` : ''}` : undefined;

  return {
    amcName,
    plan,
    option,
    schemePlan,
    cleanSchemeName: cleaned,
  };
}

export { KNOWN_ISIN_TICKERS, inferTickerFromSecurity } from './isin-ticker-lookup.js';
