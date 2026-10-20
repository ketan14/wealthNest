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

export const KNOWN_ISIN_TICKERS: Record<string, string> = {
  // Top Equities & Bluechips from Indian Depository statements
  INE002A01018: 'RELIANCE',
  INE467B01029: 'TCS',
  INE040A01034: 'HDFCBANK',
  INE009A01021: 'INFY',
  INE090A01021: 'ICICIBANK',
  INE062A01020: 'SBIN',
  INE018A01030: 'LT',
  INE030A01027: 'HINDUNILVR',
  INE154A01025: 'ITC',
  INE238A01034: 'AXISBANK',
  INE121A01024: 'CHOLAFIN',
  INE860A01027: 'BHARTIARTL',
  INE752E01010: 'POWERGRID',
  INE081A01012: 'TATASTEEL',
  INE101A01026: 'M&M',
  INE585B01010: 'MARUTI',
  INE216A01030: 'SUNPHARMA',
  INE437A01024: 'APOLLOHOSP',
  INE075A01022: 'WIPRO',
  INE117A01022: 'ABB',
  INE848E01016: 'EMBASSY',
  INE043D01016: 'MINDSPACE',

  // CDSL Holdings from Real Statements
  INE864I01014: 'MTARTECH',
  INE1TAE01010: 'TATAMOTORS',
  INE155A01022: 'TATAMOTORS',
  INE010V01017: 'LTTS',
  INE414G01012: 'MUTHOOTFIN',
  INE423A01024: 'ADANIENT',
  INE814H01029: 'ADANIPOWER',
  INE150B01039: 'ALKYL',
  INE885A01032: 'AMARA',
  INE371P01015: 'AMBER',
  INE208A01029: 'ASHOK',
  INE021A01026: 'ASIANPAINT',
  INE949L01017: 'AUBANK',
  INE296A01032: 'BAJFINANCE',
  INE296A01024: 'BAJAJFINSV',
  INE397D01024: 'BHARTIARTL',
  INE482A01020: 'CEAT',
  INE348B01021: 'CENTURYPLY',
  INE596I01020: 'CAMS',
  INE089A01031: 'DRREDDY',
  INE126A01031: 'EIDPARRY',
  INE686Y01026: 'FINEORG',
  INE795G01014: 'HDFCLIFE',
  INE053A01029: 'INDHOTEL',
  INE053F01010: 'IRFC',
  INE663F01032: 'NAUKRI',
  INE646L01027: 'INDIGO',
  INE335Y01020: 'IRCTC',
  INE758E01017: 'JIOFIN',
  INE797F01020: 'JUBLFOOD',
  INE879K01018: 'KMCH',
  INE04I401011: 'KPITTECH',
  INE214T01019: 'LTIM',
  INE429E01023: 'SAFARI',
  INE775A01035: 'MOTHERSON',
  INE670A01012: 'TATAELXSI',
  INE245A01021: 'TATAPOWER',
  INE081A01020: 'TATASTEEL',
  INE280A01028: 'TITAN',
  INE854D01024: 'MCDOWELL-N',
  INE825V01034: 'MANYAVAR',
  INE274F01020: 'WESTLIFE',
  INE584A01023: 'NMDC',
  INE364U01010: 'POLYCAB',
  INE263A01024: 'BEL',

  // Major ETFs
  INF209K01164: 'NIFTYBEES',
  INF179KC1965: 'HDFCNIFTY',
  INF769K01HS7: 'MAHKTECH',
  INF769K01HF4: 'FANG',
  INF204KB15V2: 'ITBEES',
  INF204KB14I2: 'GOLDBEES',
  INF204K01138: 'GOLDBEES',
  INF204KB17I6: 'BANKBEES',
  INF209KB1248: 'JUNIORBEES',
  INF732E01037: 'MON100',
  INF209KA12Z1: 'LIQUIDBEES',

  // Mutual Fund Schemes
  INF740K01PX1: 'DSP-MIDCAP-DIR',
  INF740K01128: 'DSP-MIDCAP',
  INF194K01524: 'BANDHAN-LM',
  INF194K01V89: 'BANDHAN-LM-DIR',
  INF174K01LS2: 'KOTAK-FLEXI-DIR',
  INF174K01LQ6: 'KOTAK-FLEXI-IDCW',
  INF174K01344: 'KOTAK-FLEXI-REG',
  INF204KB19V4: 'NIPPON-MULTI',
  INF879O01027: 'PPFAS-FLEXI',
  INF209K01842: 'NIPPON-SMALL',
  INF109K01Z48: 'ICICI-PRU-BLUE',
  INF179K01WJ1: 'HDFC-TOP100',
  INF200K01TS7: 'SBI-FLEXI',
  INF663L01FQ6: 'KOTAK-EMERGING',
  INF966L01681: 'MIRAE-LARGE',
  INF846K01164: 'AXIS-BLUECHIP',
  INF277K01460: 'TATA-DIGITAL',
  INF767K01235: 'UTI-NIFTY50',

  // Sovereign Gold Bonds
  IN0020180017: 'SGB-2028',
  IN0020180025: 'SGB-2028',
  IN0020190016: 'SGB-2029',
  IN0020200021: 'SGB-2030',
  IN0020210012: 'SGB-2031',
};

const INVALID_TICKER_WORDS = new Set([
  'EQUITY',
  'SHARES',
  'LIMITED',
  'LTD',
  'PVT',
  'PRIVATE',
  'CORP',
  'CORPORATION',
  'INC',
  'HOLDINGS',
  'ENTERPRISES',
  'INDIA',
  'EACH',
  'AFTER',
  'SUB',
  'DIVISION',
  'ARN',
  'DIRECT',
  'FOLIO',
  'RS',
  'REGL',
  'REGULAR',
  'PLAN',
  'GROWTH',
  'DIVIDEND',
  'IDCW',
  'OPTION',
  'BONUS',
  'RIGHTS',
  'SERIES',
]);

/**
 * Infers an appropriate ticker/symbol for an asset given its ISIN and security name:
 * 1. Checks curated ISIN registry
 * 2. Matches Sovereign Gold Bond (SGB) series & maturity year
 * 3. Identifies index ETFs (Nifty, Gold, Bank, IT, Silver BeES)
 * 4. Recognizes prominent Indian enterprise names (Reliance, TCS, HDFC, Infosys, etc.)
 * 5. Synthesizes a clean symbol for equity / mutual fund schemes (never using invalid generic words)
 */
export function inferTickerFromSecurity(isin: string = '', securityName: string = ''): string {
  const upperIsin = isin.trim().toUpperCase();
  const cleanedName = cleanSecurityName(securityName) || securityName.trim();
  const lowerName = cleanedName.toLowerCase();

  // If specific name has strong indicators, prioritize name over generic ISIN
  if (lowerName.includes('dsp flexi')) return 'DSP-FLEXI';
  if (lowerName.includes('dsp mid cap') || lowerName.includes('dsp midcap')) return 'DSP-MIDCAP';
  if (lowerName.includes('parag parikh') || lowerName.includes('ppfas')) return 'PPFAS-FLEXI';
  if (lowerName.includes('bandhan large & mid') || lowerName.includes('bandhan-lm'))
    return 'BANDHAN-LM';

  // 1. Exact match from curated Indian ISIN map
  if (upperIsin && KNOWN_ISIN_TICKERS[upperIsin]) {
    return KNOWN_ISIN_TICKERS[upperIsin]!;
  }

  // 2. Sovereign Gold Bonds (SGB)
  if (lowerName.includes('sgb') || lowerName.includes('sovereign gold')) {
    const yearMatch = cleanedName.match(/\b(20\d{2})\b/);
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
  if (lowerName.includes('tata motors')) return 'TATAMOTORS';
  if (lowerName.includes('mtar')) return 'MTARTECH';
  if (lowerName.includes('l&t technology') || lowerName.includes('ltts')) return 'LTTS';
  if (lowerName.includes('muthoot')) return 'MUTHOOTFIN';
  if (lowerName.includes('adani power')) return 'ADANIPOWER';
  if (lowerName.includes('adani enter')) return 'ADANIENT';
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
    if (lowerName.includes('bandhan') || lowerName.includes('idfc')) return 'BANDHAN-MF';
    if (lowerName.includes('kotak flexi')) return 'KOTAK-FLEXI';
    if (lowerName.includes('nippon india multi asset')) return 'NIPPON-MULTI';

    const cleanTokens = cleanedName
      .replace(/^[\d\w]+\s*-\s*/, '') // Strip leading scheme codes like "782 - "
      .replace(/[-_/\\().]/g, ' ')
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 1 &&
          !/^(fund|plan|growth|direct|regular|dividend|idcw|option|equity)$/i.test(w)
      );
    if (cleanTokens.length >= 2) {
      return `${cleanTokens[0]!.toUpperCase()}-${cleanTokens[1]!.toUpperCase().slice(0, 6)}`;
    }
    if (cleanTokens.length === 1) {
      return cleanTokens[0]!.toUpperCase().slice(0, 8);
    }
    return `MF-${upperIsin.slice(9, 12)}`;
  }

  // 6. Generic Listed Equities: Clean suffix and extract prominent non-blacklisted word
  const words = cleanedName
    .replace(/[-_/\\().#]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim().toUpperCase())
    .filter((w) => w.length > 1 && !INVALID_TICKER_WORDS.has(w));

  if (words.length > 0 && /^[A-Z0-9&]+$/.test(words[0]!)) {
    return words[0]!;
  }

  // 7. Fallback based on ISIN
  if (upperIsin.length === 12) {
    return upperIsin.slice(3, 8);
  }

  return 'ASSET';
}
