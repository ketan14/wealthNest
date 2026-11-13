import { Money } from '../money/money.js';
import { ParsedCasHolding, ParsedCasTransaction } from './cas-types.js';
import {
  cleanSecurityName,
  inferTickerFromSecurity,
  extractMutualFundSchemeDetails,
} from './isin.js';

/**
 * Extracts Mutual Fund numbers from Page 12 lines:
 * Pattern: [Folio] [ARN/DIRECT] [Units] [NAV] [Invested] [Valuation] ...
 * Uses mathematical invariant: units * nav ≈ valuation
 */
export function extractMutualFundNumbers(text: string): {
  units: number;
  nav: number;
  invested: number;
  valuation: number;
  folio?: string;
} | null {
  const clean = text.trim();
  if (!clean) return null;

  // Optional folio detection
  let folio: string | undefined = undefined;
  const folioMatch = clean.match(
    /\b([A-Za-z0-9/_-]+(?:\/[A-Za-z0-9_-]+)*)\s+(?:ARN[- ]\S+|DIRECT)\b/i
  );
  if (folioMatch) {
    folio = folioMatch[1];
  }

  // Match all numeric tokens on this line
  const rawTokens = clean.match(/[\d,]+(?:\.\d+)?/g);
  if (!rawTokens || rawTokens.length < 3) return null;

  const numbers = rawTokens
    .map((t) => parseFloat(t.replace(/,/g, '')))
    .filter((n) => !isNaN(n) && n > 0);

  // Look for 4 consecutive numbers (units, nav, invested, valuation)
  for (let idx = 0; idx <= numbers.length - 4; idx++) {
    const units = numbers[idx]!;
    const nav = numbers[idx + 1]!;
    const invested = numbers[idx + 2]!;
    const valuation = numbers[idx + 3]!;

    // Validate invariant: units * nav ≈ valuation (within 5% tolerance)
    const expectedVal = units * nav;
    const diffPct = Math.abs(expectedVal - valuation) / valuation;

    if (diffPct < 0.05) {
      return { units, nav, invested, valuation, folio };
    }
  }

  // Look for 3 numbers (units, nav, valuation) where invested was omitted
  for (let idx = 0; idx <= numbers.length - 3; idx++) {
    const units = numbers[idx]!;
    const nav = numbers[idx + 1]!;
    const valuation = numbers[idx + 2]!;

    const expectedVal = units * nav;
    const diffPct = Math.abs(expectedVal - valuation) / valuation;

    if (diffPct < 0.05) {
      return { units, nav, invested: valuation, valuation, folio };
    }
  }

  return null;
}

/**
 * Extracts historical transactions and closing balance holdings from
 * "MUTUAL FUND UNITS HELD WITH MF/RTA" statement section.
 */
export function parseRtaMutualFundSection(
  pages: readonly string[],
  statementDate: string
): {
  holdings: ParsedCasHolding[];
  transactions: ParsedCasTransaction[];
} {
  const transactions: ParsedCasTransaction[] = [];
  const holdings: ParsedCasHolding[] = [];

  for (let p = 0; p < pages.length; p++) {
    const pageText = pages[p]!;
    if (
      !pageText.includes('MUTUAL FUND UNITS HELD WITH MF/RTA') &&
      !pageText.includes('Closing Balance')
    ) {
      continue;
    }

    const lines = pageText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const isinMatch = line.match(/\b(INF[A-Z0-9]{9})\b/);
      if (!isinMatch) continue;

      const hasUcc = line.includes('UCC :');
      const hasTxHeader =
        (i + 1 < lines.length && lines[i + 1]!.includes('Transaction Description')) ||
        (i + 2 < lines.length && lines[i + 2]!.includes('Transaction Description'));
      if (!hasUcc && !hasTxHeader) continue;

      const isin = isinMatch[1]!;

      // Extract Scheme Name backward
      const schemeParts: string[] = [];
      for (let b = 1; b <= 5 && i - b >= 0; b++) {
        const prevL = lines[i - b]!;
        if (
          prevL.includes('Central Depository') ||
          prevL.includes('MUTUAL FUND UNITS') ||
          prevL.includes('STATEMENT OF TRANSACTIONS') ||
          prevL.includes('Closing Balance') ||
          prevL.includes('ISIN') ||
          prevL.includes('Grand Total') ||
          prevL.includes('Page ') ||
          prevL.includes('Account Details') ||
          prevL.includes('CDSL')
        ) {
          break;
        }
        if (/[\u0900-\u097F]/.test(prevL)) continue;
        if (prevL.endsWith('Mutual Fund')) {
          if (schemeParts.length > 0) break;
          continue;
        }
        schemeParts.unshift(prevL);
      }

      let rawScheme = schemeParts.join(' ').trim();
      rawScheme = rawScheme.replace(/^\(\s*[₹`]\s*\)\s*/, '');
      const schemeName = cleanSecurityName(rawScheme) || `Mutual Fund ${isin}`;
      const ticker = inferTickerFromSecurity(isin, schemeName);

      let closingUnits: number | null = null;
      let latestNav: number | null = null;

      for (let f = 1; f <= 35 && i + f < lines.length; f++) {
        const fLine = lines[i + f]!;
        if (fLine.match(/\b(INF[A-Z0-9]{9})\b/) || fLine.includes('MUTUAL FUND UNITS HELD AS ON')) {
          break;
        }

        const closingMatch = fLine.match(/Closing\s+Balance\s+([\d,]+(?:\.\d+)?)/i);
        if (closingMatch) {
          closingUnits = parseFloat(closingMatch[1]!.replace(/,/g, ''));
        }

        const dateMatch = fLine.match(/^(\d{2}-\d{2}-\d{4})/);
        if (dateMatch) {
          const dateStr = dateMatch[1]!;
          const [d, m, y] = dateStr.split('-');
          const isoDate = `${y}-${m}-${d}`;

          const descParts: string[] = [];
          let numRow: { amount: number; nav: number; price: number; units: number } | null = null;

          for (let k = 1; k <= 8 && i + f + k < lines.length; k++) {
            const nextL = lines[i + f + k]!;
            if (
              nextL.match(/^(\d{2}-\d{2}-\d{4})/) ||
              nextL.includes('Closing Balance') ||
              nextL.includes('ISIN')
            ) {
              break;
            }

            const numMatch = nextL.match(
              /^(-?[\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+(-?[\d,]+(?:\.\d+)?)/
            );
            if (numMatch) {
              const amount = parseFloat(numMatch[1]!.replace(/,/g, ''));
              const nav = parseFloat(numMatch[2]!.replace(/,/g, ''));
              const price = parseFloat(numMatch[3]!.replace(/,/g, ''));
              const units = parseFloat(numMatch[4]!.replace(/,/g, ''));
              numRow = { amount, nav, price, units };
              latestNav = nav;
              break;
            } else if (!nextL.startsWith('STT') && !/[\u0900-\u097F]/.test(nextL)) {
              descParts.push(nextL);
            }
          }

          if (numRow) {
            const desc = descParts
              .join(' ')
              .replace(/^[*]\s*/, '')
              .trim();
            const isRedemption = numRow.amount < 0 || numRow.units < 0 || /redemption/i.test(desc);
            const isDividend = /dividend|idcw/i.test(desc);
            const type: 'buy' | 'sell' | 'dividend' | 'fee' = isRedemption
              ? 'sell'
              : isDividend
                ? 'dividend'
                : 'buy';

            transactions.push({
              isin,
              schemeName,
              ticker,
              date: isoDate,
              description: desc || (isRedemption ? 'Redemption' : 'Purchase'),
              type,
              amount: Money.fromDecimal(Math.abs(numRow.amount), 'INR'),
              units: Math.abs(numRow.units),
              navOrPrice: Money.fromDecimal(numRow.nav, 'INR'),
            });
          }
        }
      }

      let folio: string | undefined = undefined;
      for (let b = 1; b <= 6 && i - b >= 0; b++) {
        const fMatch = lines[i - b]!.match(
          /\b(?:Folio\s*(?:No\.?)?|Folio)\s*[:\s]+([0-9A-Z/_-]+)\b/i
        );
        if (fMatch) {
          folio = fMatch[1];
          break;
        }
      }

      if (closingUnits !== null && closingUnits > 0) {
        const mfDetails = extractMutualFundSchemeDetails(schemeName);
        holdings.push({
          isin,
          name: schemeName,
          ticker,
          folioOrDemat: folio,
          folioNumber: folio,
          amcName: mfDetails.amcName,
          schemePlan:
            mfDetails.plan !== 'Unknown'
              ? `${mfDetails.plan} Plan${mfDetails.option !== 'Unknown' ? ` - ${mfDetails.option}` : ''}`
              : undefined,
          quantity: closingUnits,
          costBasisVerified: false,
          reportedNavOrPrice: latestNav ? Money.fromDecimal(latestNav, 'INR') : undefined,
          reportedMarketValue: latestNav
            ? Money.fromDecimal(closingUnits * latestNav, 'INR')
            : Money.zero('INR'),
          assetClassId: 'mutual_fund',
          assetType: 'mutual_fund',
          instrumentType: 'mutual_fund_scheme',
          statementDate,
          currency: 'INR',
        });
      }
    }
  }

  return { holdings, transactions };
}
