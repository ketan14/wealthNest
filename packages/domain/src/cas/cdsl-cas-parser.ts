import { ICasStatementParser } from './cas-parser.interface.js';
import {
  ParsedCasStatement,
  ParsedCasHolding,
  StatementProvider,
} from './cas-types.js';
import { Money } from '../money/money.js';
import {
  cleanSecurityName,
  inferAssetClassFromIsin,
  inferTickerFromSecurity,
  isValidIsin,
  extractMutualFundSchemeDetails,
} from './isin.js';
import {
  extractDematAccountId,
  isBoilerplateHeader,
  extractDematNumericRow,
  extractGenericNumericRow,
  extractStatementDate,
} from './cdsl-cas-helpers.js';
import {
  extractMutualFundNumbers,
  parseRtaMutualFundSection,
} from './cdsl-rta-mf-parser.js';

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
    const isNsdl =
      textUpper.includes('NATIONAL SECURITIES DEPOSITORY') || textUpper.includes('NSDL CAS');
    return hasCdslIdentifier && !isNsdl;
  }

  parse(pages: readonly string[]): ParsedCasStatement {
    const fullText = pages.join('\n');
    const statementDate = extractStatementDate(fullText);
    const dematAccountId = extractDematAccountId(fullText);
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
      const nextIsinIndex =
        oIdx + 1 < occurrences.length ? occurrences[oIdx + 1]!.index : lines.length;

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

      // Extract Folio number if present on this line or nearby context
      const folioRegex = /\b(?:Folio\s*(?:No\.?)?|Folio)\s*[:\s]+([0-9A-Za-z/_-]+)\b/i;
      const lineFolio = line.match(folioRegex);
      if (lineFolio) {
        folio = lineFolio[1];
      } else {
        for (let b = 1; b <= 4 && i - b >= 0; b++) {
          const fm = lines[i - b]!.match(folioRegex);
          if (fm) {
            folio = fm[1];
            break;
          }
        }
        if (!folio) {
          for (let fIdx = 1; fIdx <= 4 && i + fIdx < lines.length; fIdx++) {
            const fm = lines[i + fIdx]!.match(folioRegex);
            if (fm) {
              folio = fm[1];
              break;
            }
          }
        }
      }

      // Scan up to 8 candidate lines forward (capped at next ISIN)
      const scanEnd = Math.min(nextIsinIndex, i + 8);
      let dematRes: { quantity: number; price: number; marketValue: number } | null = null;
      let mfRes: {
        units: number;
        nav: number;
        invested: number;
        valuation: number;
        folio?: string;
      } | null = null;

      for (let j = i; j < scanEnd; j++) {
        const text = j === i ? line.substring(line.indexOf(isin) + isin.length).trim() : lines[j]!;
        if (!text) continue;

        // 1. Demat depository dash balance row (e.g. "16.000 -- -- -- 16.000 2900.2500 46,404.00")
        if (text.includes('--') || text.includes('- -')) {
          const d = extractDematNumericRow(text);
          if (d && (d.quantity > 0 || d.marketValue > 0)) {
            dematRes = d;
            break;
          }
        }

        // 2. Mutual Fund folio balance row (e.g. "DIRECT 625.535 165.517 60,708.71 1,03,536.68")
        const isEtf = /\b(?:ETF|BEES)\b/i.test(text) || /\b(?:ETF|BEES)\b/i.test(line);
        if (
          !isEtf &&
          (/\b(?:ARN|DIRECT)\b/i.test(text) || (isin.startsWith('INF') && !text.includes('ETF')))
        ) {
          const m = extractMutualFundNumbers(text);
          if (m && (m.units > 0 || m.valuation > 0)) {
            mfRes = m;
            break;
          }
        }

        // 3. Fallback generic Demat row
        const d = extractDematNumericRow(text);
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
            if (
              lines[j]!.includes('--') ||
              lines[j]!.includes('- -') ||
              extractDematNumericRow(lines[j]!)
            ) {
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
            if (prev.match(isinRegex) || isBoilerplateHeader(prev)) break;
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
        const schemeParts: string[] = [];
        const prevOccurIndex = oIdx > 0 ? occurrences[oIdx - 1]!.index : 0;

        // Look backward up to 8 lines (stopping at previous holding's numbers line or table header)
        for (let b = 1; b <= 8 && i - b >= 0 && i - b > prevOccurIndex; b++) {
          const prevL = lines[i - b]!;
          if (
            extractMutualFundNumbers(prevL) ||
            isBoilerplateHeader(prevL) ||
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
        const schemeName =
          cleanSecurityName(schemeParts.join(' ')) || cleanSecurityName(textBeforeIsin);

        securityName = schemeName;
        quantity = mfRes.units;
        price = mfRes.nav;
        marketValue = mfRes.valuation;
        folio = mfRes.folio || folio;

        if (mfRes.invested > 0 && mfRes.units > 0) {
          unitCost = Money.fromDecimal(mfRes.invested / mfRes.units, 'INR');
        }
      } else {
        // Fallback generic 2/3 column line parser
        for (let offset = 0; offset <= 2 && i + offset < lines.length; offset++) {
          const cand = lines[i + offset]!;
          const extracted = extractGenericNumericRow(cand.replace(isin, ''));
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

        const statementSection = dematRes ? 'demat' : mfRes ? 'mutual_fund_rta' : 'unknown';
        const { assetClassId, assetType, instrumentType } = inferAssetClassFromIsin(
          isin,
          securityName,
          statementSection
        );
        const ticker = inferTickerFromSecurity(isin, securityName);
        const mfDetails =
          assetClassId === 'mutual_fund' ? extractMutualFundSchemeDetails(securityName) : null;
        const resolvedFolio = mfRes ? folio || mfRes.folio : undefined;

        holdings.push({
          isin,
          name: securityName,
          ticker,
          folioOrDemat: resolvedFolio || (dematRes ? dematAccountId : undefined),
          dematAccountId: dematRes ? dematAccountId : undefined,
          folioNumber: resolvedFolio,
          amcName: mfDetails?.amcName,
          schemePlan:
            mfDetails && mfDetails.plan !== 'Unknown'
              ? `${mfDetails.plan} Plan${mfDetails.option !== 'Unknown' ? ` - ${mfDetails.option}` : ''}`
              : undefined,
          assetType,
          assetClassId,
          instrumentType,
          quantity,
          unitCost: unitCost || (price > 0 ? Money.fromDecimal(price, 'INR') : undefined),
          costBasisVerified: false,
          reportedNavOrPrice: Money.fromDecimal(price, 'INR'),
          reportedMarketValue: Money.fromDecimal(marketValue, 'INR'),
          statementDate,
          currency: 'INR',
        });
      } else {
        const isExplicitZero =
          Boolean(line.match(/(?:balance|units|bal)[^\d:]*[:\s]+0(?:\.0+)?\b/i)) ||
          Boolean(
            i + 1 < lines.length &&
            lines[i + 1]!.match(/(?:balance|units|bal)[^\d:]*[:\s]+0(?:\.0+)?\b/i)
          );

        if (isExplicitZero) {
          rawWarnings.push(`ISIN ${isin} reported 0 units (closed/zero-balance position).`);
        } else {
          rawWarnings.push(`Could not reliably extract units and value for ISIN ${isin}.`);
        }
      }
    }

    // 1. Process Demat and Summary Table holdings
    // Key by (ISIN + Folio / Demat) so multiple folios of the same scheme are preserved
    const dedupedMap = new Map<string, ParsedCasHolding>();
    for (const h of holdings) {
      const key = `${h.isin}::${h.folioNumber || h.folioOrDemat || h.dematAccountId || 'default'}`;
      if (dedupedMap.has(key)) {
        const existing = dedupedMap.get(key)!;
        if (h.reportedMarketValue.cents > existing.reportedMarketValue.cents) {
          dedupedMap.set(key, h);
        }
      } else {
        dedupedMap.set(key, h);
      }
    }

    // 2. Process RTA Mutual Fund Section (Transactions and Closing Balances)
    const rtaResult = parseRtaMutualFundSection(pages, statementDate);
    for (const rtaH of rtaResult.holdings) {
      const key = `${rtaH.isin}::${rtaH.folioNumber || rtaH.folioOrDemat || 'default'}`;
      if (dedupedMap.has(key)) {
        const existing = dedupedMap.get(key)!;
        // Enrich holding name if existing name is short or truncated
        if (rtaH.name && rtaH.name.length > existing.name.length) {
          dedupedMap.set(key, {
            ...existing,
            name: rtaH.name,
            ticker: rtaH.ticker || existing.ticker,
            amcName: rtaH.amcName || existing.amcName,
            schemePlan: rtaH.schemePlan || existing.schemePlan,
          });
        }
      } else {
        // Holding only exists in RTA section (statement without summary table)
        dedupedMap.set(key, rtaH);
      }
    }

    const uniqueHoldings = Array.from(dedupedMap.values());
    let totalValue = Money.zero('INR');
    for (const h of uniqueHoldings) {
      totalValue = totalValue.add(h.reportedMarketValue);
    }

    // Filter out warnings for ISINs that were successfully extracted elsewhere in statement
    const extractedIsins = new Set(uniqueHoldings.map((h) => h.isin));
    const finalWarnings = rawWarnings.filter((w) => {
      const match = w.match(/\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b/);
      if (!match) return true;
      return !extractedIsins.has(match[1]!);
    });

    return {
      provider: 'CDSL',
      statementDate,
      holdings: uniqueHoldings,
      transactions: rtaResult.transactions,
      totalReportedValue: totalValue,
      warnings: finalWarnings,
    };
  }
}
