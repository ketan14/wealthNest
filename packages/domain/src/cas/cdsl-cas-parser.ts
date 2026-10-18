import { ICasStatementParser } from './cas-parser.interface.js';
import { ParsedCasStatement, ParsedCasHolding, StatementProvider } from './cas-types.js';
import { Money } from '../money/money.js';
import { inferAssetClassFromIsin, inferTickerFromSecurity, isValidIsin } from './isin.js';

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
    const warnings: string[] = [];
    const holdings: ParsedCasHolding[] = [];

    // Scan line by line across all pages
    const lines = fullText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const isinRegex = /\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const isinMatch = line.match(isinRegex);

      if (!isinMatch) continue;

      const isin = isinMatch[1]!;
      if (!isValidIsin(isin)) continue;

      // Extract numbers from the line or adjacent lines
      // In CDSL CAS, a line often looks like:
      // "INE002A01018 RELIANCE INDUSTRIES LTD. - EQ 80.000 2950.00 236000.00"
      let securityName = '';
      let quantity = 0;
      let price = 0;
      let marketValue = 0;
      let folio: string | undefined = undefined;
      let unitCost: Money | undefined = undefined;

      // 0. Check for CDSL Mutual Fund Folios table row (e.g. Page 12):
      // Pattern: [Scheme Name] [ISIN] [Folio No] [ARN Code] [Units] [NAV] [Cumulative Invested] [Valuation] ...
      const isinIndex = line.indexOf(isin);
      const textBeforeIsin = line.substring(0, isinIndex).trim();
      const textAfterIsin = line.substring(isinIndex + isin.length).trim();

      const mfTableRowMatch = textAfterIsin.match(
        /^(?:(?:folio\s*(?:no\.?)?\s*:?\s*)?(\S+))?\s*(?:ARN[- ]\S+|DIRECT)?\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)/i
      );

      if (mfTableRowMatch && textBeforeIsin.length > 2) {
        folio = mfTableRowMatch[1];
        const unitsVal = parseFloat(mfTableRowMatch[2]!.replace(/,/g, ''));
        const navVal = parseFloat(mfTableRowMatch[3]!.replace(/,/g, ''));
        const investedVal = parseFloat(mfTableRowMatch[4]!.replace(/,/g, ''));
        const valuationVal = parseFloat(mfTableRowMatch[5]!.replace(/,/g, ''));

        if (unitsVal > 0 || valuationVal > 0) {
          quantity = unitsVal;
          price = navVal;
          marketValue = valuationVal;
          securityName = textBeforeIsin;
          if (investedVal > 0 && unitsVal > 0) {
            unitCost = Money.fromDecimal(investedVal / unitsVal, 'INR');
          }
        }
      }

      const lineWithoutIsin = line.replace(isin, '').replace(/^\s*ISIN[:\s]*/i, '').trim();

      // 1. Try extracting numeric figures from the ISIN line
      if (quantity === 0 && marketValue === 0) {
        const currentLineExtracted = this.extractNumericRow(lineWithoutIsin);
        if (currentLineExtracted && (currentLineExtracted.quantity > 0 || currentLineExtracted.marketValue > 0)) {
          securityName = (currentLineExtracted.securityName || '').replace(/^\s*ISIN[:\s]*/i, '').trim();
          quantity = currentLineExtracted.quantity;
          price = currentLineExtracted.price;
          marketValue = currentLineExtracted.marketValue;
        }
      }

      // 2. Look ahead up to 3 lines (e.g. multi-line mutual fund folios where units & NAV appear below)
      if (quantity === 0 && marketValue === 0) {
        for (let offset = 1; offset <= 3 && i + offset < lines.length; offset++) {
          const candLine = lines[i + offset]!;
          if (candLine.match(isinRegex)) break; // Stop if next security begins

          const extracted = this.extractNumericRow(candLine);
          if (extracted && (extracted.quantity > 0 || extracted.marketValue > 0)) {
            quantity = extracted.quantity;
            price = extracted.price;
            marketValue = extracted.marketValue;
            if (!securityName || securityName.length < 3) {
              securityName = extracted.securityName || securityName;
            }
            break;
          }
        }
      }

      // 3. Look behind 1 line (e.g. if numbers preceded ISIN)
      if (quantity === 0 && marketValue === 0 && i > 0) {
        const prevLine = lines[i - 1]!;
        if (!prevLine.match(isinRegex) && !prevLine.toUpperCase().includes('PAGE')) {
          const extracted = this.extractNumericRow(prevLine);
          if (extracted && (extracted.quantity > 0 || extracted.marketValue > 0)) {
            quantity = extracted.quantity;
            price = extracted.price;
            marketValue = extracted.marketValue;
          }
        }
      }

      if (quantity > 0 || marketValue > 0) {
        // Normalize if price and market value swapped
        if (marketValue < price && quantity > 0) {
          marketValue = quantity * price;
        }

        // If security name is too short or empty, check preceding lines (i-1, i-2)
        if (securityName.length < 3) {
          if (i > 0) {
            const prev1 = lines[i - 1]!;
            if (!prev1.match(isinRegex) && !prev1.toUpperCase().includes('PAGE') && !prev1.toUpperCase().includes('STATEMENT')) {
              securityName = prev1.replace(/(\d+(?:,\d+)*(?:\.\d+)?)/g, '').replace(/folio\s*(?:no\.?)?:?\s*\S*/i, '').trim();
            }
          }
          if (securityName.length < 3 && i > 1) {
            const prev2 = lines[i - 2]!;
            if (!prev2.match(isinRegex) && !prev2.toUpperCase().includes('PAGE') && !prev2.toUpperCase().includes('STATEMENT')) {
              securityName = prev2.replace(/(\d+(?:,\d+)*(?:\.\d+)?)/g, '').replace(/folio\s*(?:no\.?)?:?\s*\S*/i, '').trim();
            }
          }
        }

        securityName = securityName.replace(/^\s*ISIN[:\s]*/i, '').trim();
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
          warnings.push(`ISIN ${isin} reported 0 units (closed/zero-balance folio).`);
        } else {
          warnings.push(`Could not reliably extract units and value for ISIN ${isin}.`);
        }
      }
    }

    // Deduplicate holdings by ISIN within statement (e.g. if repeated across page breaks)
    const dedupedMap = new Map<string, ParsedCasHolding>();
    for (const h of holdings) {
      if (dedupedMap.has(h.isin)) {
        // If duplicate row detected, preserve the higher or newest value
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

    return {
      provider: 'CDSL',
      statementDate,
      holdings: uniqueHoldings,
      totalReportedValue: totalValue,
      warnings,
    };
  }

  private extractStatementDate(text: string): string {
    // Try formats: "Statement as on : DD-Mon-YYYY", "Statement Date : DD/MM/YYYY", "As on 31-Mar-2026"
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

  private extractNumericRow(text: string): {
    quantity: number;
    price: number;
    marketValue: number;
    securityName?: string;
  } | null {
    const cleanText = text.trim();
    if (!cleanText) return null;

    // Ignore lines that are predominantly folio numbers/account identifiers without units/value keywords
    if (/folio\s*(?:no\.?)?/i.test(cleanText) && !/(?:units|nav|balance|val)/i.test(cleanText)) {
      return null;
    }

    // 1. Keyword-based matching (e.g. "Units: 1245.500 NAV: 82.45 Total Value: 102691.48")
    const unitsMatch = cleanText.match(
      /(?:units|balance|bal|qty|holding|cur\s*bal)[^\d:]*[:\s]+([\d,]+(?:\.\d+)?)/i
    );
    const navMatch = cleanText.match(/(?:nav|price|rate)[^\d:]*[:\s]+([\d,]+(?:\.\d+)?)/i);
    const valMatch = cleanText.match(
      /(?:total\s*val|market\s*val|mkt\s*val|value|val|amount)[^\d:]*[:\s]+([\d,]+(?:\.\d+)?)/i
    );

    if (unitsMatch || valMatch) {
      const q = unitsMatch ? parseFloat(unitsMatch[1]!.replace(/,/g, '')) : 0;
      const v = valMatch ? parseFloat(valMatch[1]!.replace(/,/g, '')) : 0;
      const p = navMatch
        ? parseFloat(navMatch[1]!.replace(/,/g, ''))
        : q > 0 && v > 0
        ? v / q
        : 0;
      if (q > 0 || v > 0) {
        return { quantity: q, price: p, marketValue: v };
      }
    }

    // 2. Trailing 3 columns: [Security Name, Quantity/Balance, Market Price/NAV, Market Value]
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

    // 3. Trailing 2 columns: [Security Name, Quantity/Balance, Market Value]
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

    // 4. Tokenized numbers fallback
    const numbers = cleanText.match(/(\d+(?:,\d+)*(?:\.\d+)?)/g);
    if (numbers && numbers.length >= 2) {
      const cleanNumbers = numbers
        .map((n) => parseFloat(n.replace(/,/g, '')))
        .filter((n) => !isNaN(n));

      if (cleanNumbers.length >= 3) {
        return {
          quantity: cleanNumbers[cleanNumbers.length - 3]!,
          price: cleanNumbers[cleanNumbers.length - 2]!,
          marketValue: cleanNumbers[cleanNumbers.length - 1]!,
          securityName: cleanText.replace(/(\d+(?:,\d+)*(?:\.\d+)?)/g, '').trim(),
        };
      } else if (cleanNumbers.length === 2) {
        const q = cleanNumbers[0]!;
        const v = cleanNumbers[1]!;
        return {
          quantity: q,
          price: q > 0 ? v / q : 0,
          marketValue: v,
          securityName: cleanText.replace(/(\d+(?:,\d+)*(?:\.\d+)?)/g, '').trim(),
        };
      }
    }

    return null;
  }
}
