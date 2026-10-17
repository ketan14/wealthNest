import { ICasStatementParser } from './cas-parser.interface.js';
import { ParsedCasStatement, ParsedCasHolding, StatementProvider } from './cas-types.js';
import { Money } from '../money/money.js';
import { inferAssetClassFromIsin, isValidIsin } from './isin.js';

export class NsdlCasParser implements ICasStatementParser {
  readonly provider: StatementProvider = 'NSDL';

  canParse(rawText: string): boolean {
    const textUpper = rawText.toUpperCase();
    const hasNsdlIdentifier =
      textUpper.includes('NATIONAL SECURITIES DEPOSITORY') ||
      textUpper.includes('NSDL') ||
      textUpper.includes('DP ID') ||
      textUpper.includes('NSDL CAS');

    return hasNsdlIdentifier;
  }

  parse(pages: readonly string[]): ParsedCasStatement {
    const fullText = pages.join('\n');
    const statementDate = this.extractStatementDate(fullText);
    const warnings: string[] = [];
    const holdings: ParsedCasHolding[] = [];

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

      let securityName = '';
      let quantity = 0;
      let price = 0;
      let marketValue = 0;

      const lineWithoutIsin = line.replace(isin, '').trim();

      // Check for 3 trailing numeric columns: [Balance/Quantity, Rate (Rs.)/Price, Value (Rs.)/Market Value]
      const threeColMatch = lineWithoutIsin.match(/^(.*?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)$/);
      // Check for 2 trailing numeric columns: [Balance/Quantity, Value (Rs.)/Market Value]
      const twoColMatch = !threeColMatch ? lineWithoutIsin.match(/^(.*?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)$/) : null;

      if (threeColMatch) {
        securityName = threeColMatch[1]?.trim() ?? '';
        quantity = parseFloat(threeColMatch[2]!.replace(/,/g, ''));
        price = parseFloat(threeColMatch[3]!.replace(/,/g, ''));
        marketValue = parseFloat(threeColMatch[4]!.replace(/,/g, ''));
      } else if (twoColMatch) {
        securityName = twoColMatch[1]?.trim() ?? '';
        quantity = parseFloat(twoColMatch[2]!.replace(/,/g, ''));
        marketValue = parseFloat(twoColMatch[3]!.replace(/,/g, ''));
        price = quantity > 0 ? marketValue / quantity : 0;
      } else {
        const numbers = lineWithoutIsin.match(/(\d+(?:,\d+)*(?:\.\d+)?)/g);
        if (numbers && numbers.length >= 2) {
          const cleanNumbers = numbers
            .map((n) => parseFloat(n.replace(/,/g, '')))
            .filter((n) => !isNaN(n));

          if (cleanNumbers.length >= 3) {
            marketValue = cleanNumbers[cleanNumbers.length - 1]!;
            price = cleanNumbers[cleanNumbers.length - 2]!;
            quantity = cleanNumbers[cleanNumbers.length - 3]!;
          } else if (cleanNumbers.length === 2) {
            marketValue = cleanNumbers[1]!;
            quantity = cleanNumbers[0]!;
            price = quantity > 0 ? marketValue / quantity : 0;
          }

          securityName = lineWithoutIsin.replace(/(\d+(?:,\d+)*(?:\.\d+)?)/g, '').trim();
        }
      }

      if (quantity > 0 || marketValue > 0) {
        if (marketValue < price && quantity > 0) {
          marketValue = quantity * price;
        }

        if (securityName.length < 3 && i > 0) {
          const prevLine = lines[i - 1]!;
          if (!prevLine.match(isinRegex) && !prevLine.toUpperCase().includes('PAGE')) {
            securityName = prevLine.replace(/(\d+(?:,\d+)*(?:\.\d+)?)/g, '').trim();
          }
        }

        if (!securityName || securityName.length < 2) {
          securityName = `Security ${isin}`;
        }

        const { assetClassId, assetType } = inferAssetClassFromIsin(isin, securityName);

        holdings.push({
          isin,
          name: securityName,
          assetType,
          assetClassId,
          quantity,
          reportedNavOrPrice: Money.fromDecimal(price, 'INR'),
          reportedMarketValue: Money.fromDecimal(marketValue, 'INR'),
          statementDate,
          currency: 'INR',
        });
      } else {
        warnings.push(`Could not reliably extract units and value for ISIN ${isin}.`);
      }
    }

    // Deduplicate holdings by ISIN within statement
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

    return {
      provider: 'NSDL',
      statementDate,
      holdings: uniqueHoldings,
      totalReportedValue: totalValue,
      warnings,
    };
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
