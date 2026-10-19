import { ICasStatementParser } from './cas-parser.interface.js';
import { ParsedCasStatement, ParsedCasHolding, StatementProvider } from './cas-types.js';
import { Money } from '../money/money.js';
import {
  cleanSecurityName,
  inferAssetClassFromIsin,
  inferTickerFromSecurity,
  isValidIsin,
} from './isin.js';

export class CdslCasParser implements ICasStatementParser {
  readonly provider: StatementProvider = 'CDSL';

  canParse(rawText: string): boolean {
    const textUpper = rawText.toUpperCase();
    const hasCdslIdentifier =
      textUpper.includes('CENTRAL DEPOSITORY SERVICES') ||
      textUpper.includes('CDSL') ||
      textUpper.includes('BO ID') ||
      textUpper.includes('CDSL CAS');

    // Make sure it is not NSDL
    const isNsdl = textUpper.includes('NATIONAL SECURITIES DEPOSITORY') || textUpper.includes('NSDL CAS');
    return hasCdslIdentifier && !isNsdl;
  }

  parse(pages: readonly string[]): ParsedCasStatement {
    const fullText = pages.join('\n');
    const statementDate = this.extractStatementDate(fullText);
    const rawWarnings: string[] = [];
    const holdings: ParsedCasHolding[] = [];

    // Pre-process lines
    const lines = fullText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const isinRegex = /\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b/;

    // Locate all valid ISIN occurrences with their line index
    const occurrences: { index: number; line: string; isin: string }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const isinMatch = line.match(isinRegex);
      if (isinMatch && isValidIsin(isinMatch[1]!)) {
        occurrences.push({ index: i, line, isin: isinMatch[1]! });
      }
    }

    for (let oIdx = 0; oIdx < occurrences.length; oIdx++) {
      const { index: i, line, isin } = occurrences[oIdx]!;
      const nextIsinIndex = oIdx + 1 < occurrences.length ? occurrences[oIdx + 1]!.index : lines.length;

      // Skip intermediate transaction log and TER disclosure tables
      if (
        line.includes('UCC :') ||
        (i + 1 < lines.length && lines[i + 1]!.includes('Transaction Description')) ||
        (i + 1 < lines.length && lines[i + 1]!.includes('Average Total Expense Ratio'))
      ) {
        continue;
      }

      let securityName = '';
      let quantity = 0;
      let price = 0;
      let marketValue = 0;
      let folio: string | undefined = undefined;
      let unitCost: Money | undefined = undefined;

      // Scan up to 8 candidate lines forward (capped at next ISIN)
      const scanEnd = Math.min(nextIsinIndex, i + 8);
      let dematRes: { quantity: number; price: number; marketValue: number } | null = null;
      let mfRes: { units: number; nav: number; invested: number; valuation: number; folio?: string } | null = null;

      for (let j = i; j < scanEnd; j++) {
        const text = j === i ? line.substring(line.indexOf(isin) + isin.length).trim() : lines[j]!;
        if (!text) continue;

        // 1. Demat depository dash balance row (e.g. "16.000 -- -- -- 16.000 2900.2500 46,404.00")
        if (text.includes('--') || text.includes('- -')) {
          const d = this.extractDematNumericRow(text);
          if (d && (d.quantity > 0 || d.marketValue > 0)) {
            dematRes = d;
            break;
          }
        }

        // 2. Mutual Fund folio balance row (e.g. "DIRECT 625.535 165.517 60,708.71 1,03,536.68")
        if (/\b(?:ARN|DIRECT)\b/i.test(text) || isin.startsWith('INF')) {
          const m = this.extractMutualFundNumbers(text);
          if (m && (m.units > 0 || m.valuation > 0)) {
            mfRes = m;
            break;
          }
        }

        // 3. Fallback generic Demat row
        const d = this.extractDematNumericRow(text);
        if (d && (d.quantity > 0 || d.marketValue > 0)) {
          dematRes = d;
          break;
        }
      }

      if (dematRes) {
        // ==========================================
        // SECTION A: CDSL Demat Holdings (Equities, ETFs, Bonds, SGBs)
        // ==========================================
        const textBeforeIsin = line.substring(0, line.indexOf(isin)).trim();
        const textAfterIsin = line.substring(line.indexOf(isin) + isin.length).trim();
        const cleanAfterIsin = textAfterIsin.replace(/(\s+[\d,]+(?:\.\d+)?)+\s*$/, '').trim();

        let candName = '';

        // 1. If textAfterIsin directly contains the company name without numbers
        if (cleanAfterIsin && cleanAfterIsin.length >= 3) {
          const directClean = cleanSecurityName(cleanAfterIsin);
          if (directClean && directClean.length >= 3) {
            candName = directClean;
          }
        }

        // 2. Collect lines following ISIN up to the numeric balance row
        if (!candName || candName.length < 3) {
          const nameParts: string[] = [];
          if (cleanAfterIsin) nameParts.push(cleanAfterIsin);
          for (let j = i + 1; j < scanEnd; j++) {
            if (lines[j]!.includes('--') || lines[j]!.includes('- -') || this.extractDematNumericRow(lines[j]!)) {
              break;
            }
            nameParts.push(lines[j]!);
          }
          if (nameParts.length > 0) {
            const joined = cleanSecurityName(nameParts.join(' '));
            if (joined && joined.length >= 3) {
              candName = joined;
            }
          }
        }

        // 3. If name was preceding ISIN on the same line
        if (!candName || candName.length < 3) {
          const beforeClean = cleanSecurityName(textBeforeIsin);
          if (beforeClean && beforeClean.length >= 3) {
            candName = beforeClean;
          }
        }

        // 4. If still empty, look backward up to 2 lines
        if (!candName || candName.length < 3) {
          for (let b = 1; b <= 2 && i - b >= 0; b++) {
            const prev = lines[i - b]!;
            if (prev.match(isinRegex) || this.isBoilerplateHeader(prev)) break;
            const cleaned = cleanSecurityName(prev);
            if (cleaned && cleaned.length >= 3) {
              candName = cleaned;
              break;
            }
          }
        }

        securityName = candName;
        quantity = dematRes.quantity;
        price = dematRes.price;
        marketValue = dematRes.marketValue;
      } else if (mfRes) {
        // ==========================================
        // SECTION B: CDSL Mutual Fund Folios
        // ==========================================
        const textBeforeIsin = line.substring(0, line.indexOf(isin)).trim();
        const cleanBefore = cleanSecurityName(textBeforeIsin);

        let schemeName = '';
        if (cleanBefore && cleanBefore.length >= 3) {
          schemeName = cleanBefore;
        } else {
          const schemeParts: string[] = [];
          const prevOccurIndex = oIdx > 0 ? occurrences[oIdx - 1]!.index : 0;

          // Look backward up to 8 lines (stopping at previous holding's numbers line or table header)
          for (let b = 1; b <= 8 && i - b >= 0 && i - b > prevOccurIndex; b++) {
            const prevL = lines[i - b]!;
            if (
              this.extractMutualFundNumbers(prevL) ||
              this.isBoilerplateHeader(prevL) ||
              prevL.includes('Grand Total') ||
              prevL.includes('Page ')
            ) {
              break;
            }
            if (
              prevL.includes('Unrealised') ||
              prevL.includes('Unreal') ||
              prevL.includes('Profit/') ||
              prevL.includes('(in absolute')
            ) {
              continue;
            }
            schemeParts.unshift(prevL);
          }

          if (textBeforeIsin) schemeParts.push(textBeforeIsin);
          schemeName = cleanSecurityName(schemeParts.join(' '));
        }

        securityName = schemeName;
        quantity = mfRes.units;
        price = mfRes.nav;
        marketValue = mfRes.valuation;
        folio = mfRes.folio;

        if (mfRes.invested > 0 && mfRes.units > 0) {
          unitCost = Money.fromDecimal(mfRes.invested / mfRes.units, 'INR');
        }
      } else {
        // Fallback generic 2/3 column line parser
        for (let offset = 0; offset <= 2 && i + offset < lines.length; offset++) {
          const cand = lines[i + offset]!;
          const extracted = this.extractGenericNumericRow(cand.replace(isin, ''));
          if (extracted && (extracted.quantity > 0 || extracted.marketValue > 0)) {
            quantity = extracted.quantity;
            price = extracted.price;
            marketValue = extracted.marketValue;
            if (!securityName || securityName.length < 3) {
              securityName = cleanSecurityName(extracted.securityName || '') || securityName;
            }
            break;
          }
        }
      }

      // Record Holding or Warning
      if (quantity > 0 && marketValue > 0) {
        if (marketValue < price && quantity > 0) {
          marketValue = quantity * price;
        }

        securityName = cleanSecurityName(securityName);
        if (!securityName || securityName.length < 2) {
          securityName = `Security ${isin}`;
        }

        const { assetClassId, assetType } = inferAssetClassFromIsin(isin, securityName);
        const ticker = inferTickerFromSecurity(isin, securityName);

        holdings.push({
          isin,
          name: securityName,
          ticker,
          folioOrDemat: folio,
          assetType,
          assetClassId,
          quantity,
          unitCost: unitCost || (price > 0 ? Money.fromDecimal(price, 'INR') : undefined),
          reportedNavOrPrice: Money.fromDecimal(price, 'INR'),
          reportedMarketValue: Money.fromDecimal(marketValue, 'INR'),
          statementDate,
          currency: 'INR',
        });
      } else {
        const isExplicitZero =
          Boolean(line.match(/(?:balance|units|bal)[^\d:]*[:\s]+0(?:\.0+)?\b/i)) ||
          Boolean(i + 1 < lines.length && lines[i + 1]!.match(/(?:balance|units|bal)[^\d:]*[:\s]+0(?:\.0+)?\b/i));

        if (isExplicitZero) {
          rawWarnings.push(`ISIN ${isin} reported 0 units (closed/zero-balance position).`);
        } else {
          rawWarnings.push(`Could not reliably extract units and value for ISIN ${isin}.`);
        }
      }
    }

    // Deduplicate holdings by ISIN within statement (preserving record with highest value)
    const dedupedMap = new Map<string, ParsedCasHolding>();
    for (const h of holdings) {
      if (dedupedMap.has(h.isin)) {
        const existing = dedupedMap.get(h.isin)!;
        if (h.reportedMarketValue.cents > existing.reportedMarketValue.cents) {
          dedupedMap.set(h.isin, h);
        }
      } else {
        dedupedMap.set(h.isin, h);
      }
    }

    const uniqueHoldings = Array.from(dedupedMap.values());
    let totalValue = Money.zero('INR');
    for (const h of uniqueHoldings) {
      totalValue = totalValue.add(h.reportedMarketValue);
    }

    // Filter out warnings for ISINs that were successfully extracted elsewhere in statement
    const finalWarnings = rawWarnings.filter((w) => {
      const match = w.match(/\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b/);
      if (!match) return true;
      return !dedupedMap.has(match[1]!);
    });

    return {
      provider: 'CDSL',
      statementDate,
      holdings: uniqueHoldings,
      totalReportedValue: totalValue,
      warnings: finalWarnings,
    };
  }

  /**
   * Identifies CDSL Table Headers, Page numbering, and statement meta lines
   */
  private isBoilerplateHeader(text: string): boolean {
    const upper = text.toUpperCase();
    return (
      upper.includes('PAGE ') ||
      upper.includes('STATEMENT AS ON') ||
      upper.includes('CONSOLIDATED ACCOUNT STATEMENT') ||
      upper.includes('CENTRAL DEPOSITORY SERVICES') ||
      upper.includes('BO ID') ||
      upper.includes('EQUITY SHARES / LISTED SECURITIES') ||
      upper.includes('MUTUAL FUND UNITS HELD') ||
      upper.includes('CURRENT BALANCE') ||
      upper.includes('MARKET VALUE') ||
      upper.includes('UNREALISED')
    );
  }

  /**
   * Extracts Mutual Fund numbers from Page 12 lines:
   * Pattern: [Folio] [ARN/DIRECT] [Units] [NAV] [Invested] [Valuation] ...
   * Uses mathematical invariant: units * nav ≈ valuation
   */
  private extractMutualFundNumbers(text: string): {
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
    const folioMatch = clean.match(/\b([A-Za-z0-9/_-]+(?:\/[A-Za-z0-9_-]+)*)\s+(?:ARN[- ]\S+|DIRECT)\b/i);
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
   * Extracts Demat equity balance line:
   * Pattern: [Quantity] ... [-- -- --] ... [Quantity] [Price] [Market Value]
   * Mathematical invariant: quantity * price ≈ marketValue
   */
  private extractDematNumericRow(text: string): {
    quantity: number;
    price: number;
    marketValue: number;
  } | null {
    const clean = text.trim();
    if (!clean) return null;

    const rawTokens = clean.match(/[\d,]+(?:\.\d+)?/g);
    if (!rawTokens || rawTokens.length < 2) return null;

    const numbers = rawTokens
      .map((t) => parseFloat(t.replace(/,/g, '')))
      .filter((n) => !isNaN(n) && n > 0);

    if (numbers.length < 2) return null;

    // In CDSL Demat lines, the last two numbers are Market Price and Market Value:
    // e.g. "17.000 -- -- -- 17.000 7765.4500 1,32,012.65"
    const marketValue = numbers[numbers.length - 1]!;
    const price = numbers[numbers.length - 2]!;

    // Find quantity: either a preceding number matching marketValue / price, or marketValue / price
    const expectedQty = price > 0 ? marketValue / price : 0;
    let quantity = 0;

    for (let k = 0; k < numbers.length - 2; k++) {
      const candQty = numbers[k]!;
      if (Math.abs(candQty - expectedQty) < 0.05 || Math.abs(candQty * price - marketValue) < 2) {
        quantity = candQty;
        break;
      }
    }

    // In Demat statements, if quantity was not among preceding tokens, require depository dashes
    if (quantity === 0 && (clean.includes('--') || clean.includes('- -'))) {
      quantity =
        Math.abs(expectedQty - Math.round(expectedQty)) < 0.01
          ? Math.round(expectedQty)
          : Math.round(expectedQty * 1000) / 1000;
    }

    if (quantity > 0 && marketValue > 0) {
      return { quantity, price, marketValue };
    }

    return null;
  }

  /**
   * Fallback for standard 3-column / 2-column or keyword rows
   */
  private extractGenericNumericRow(text: string): {
    quantity: number;
    price: number;
    marketValue: number;
    securityName?: string;
  } | null {
    const cleanText = text.trim();
    if (!cleanText) return null;

    // Trailing 3 columns: [Security Name, Quantity/Balance, Market Price/NAV, Market Value]
    const threeColMatch = cleanText.match(
      /^(.*?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)$/
    );
    if (threeColMatch && /[a-zA-Z]/.test(threeColMatch[1]!)) {
      return {
        securityName: threeColMatch[1]?.trim(),
        quantity: parseFloat(threeColMatch[2]!.replace(/,/g, '')),
        price: parseFloat(threeColMatch[3]!.replace(/,/g, '')),
        marketValue: parseFloat(threeColMatch[4]!.replace(/,/g, '')),
      };
    }

    // Trailing 2 columns: [Security Name, Quantity/Balance, Market Value]
    const twoColMatch = cleanText.match(/^(.*?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)$/);
    if (twoColMatch && /[a-zA-Z]/.test(twoColMatch[1]!)) {
      const q = parseFloat(twoColMatch[2]!.replace(/,/g, ''));
      const v = parseFloat(twoColMatch[3]!.replace(/,/g, ''));
      return {
        securityName: twoColMatch[1]?.trim(),
        quantity: q,
        price: q > 0 ? v / q : 0,
        marketValue: v,
      };
    }

    return null;
  }

  private extractStatementDate(text: string): string {
    const match =
      text.match(/(?:Statement\s+as\s+on\s*:?|Statement\s+Date\s*:?|As\s+on\s*:?)\s*(\d{1,2})[-/ ]([A-Za-z]{3}|\d{1,2})[-/ ](\d{4})/i) ||
      text.match(/(\d{1,2})[-/ ]([A-Za-z]{3}|\d{1,2})[-/ ](\d{4})/);

    if (match) {
      const day = match[1]!.padStart(2, '0');
      const monthRaw = match[2]!;
      const year = match[3]!;
      let month = '01';

      if (isNaN(Number(monthRaw))) {
        const monthNames: Record<string, string> = {
          JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
          JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
        };
        month = monthNames[monthRaw.toUpperCase().slice(0, 3)] || '01';
      } else {
        month = monthRaw.padStart(2, '0');
      }

      return `${year}-${month}-${day}`;
    }

    return new Date().toISOString().split('T')[0]!;
  }
}
