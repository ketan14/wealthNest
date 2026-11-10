import { ICasStatementParser } from './cas-parser.interface.js';
import { ParsedCasHolding, ParsedCasStatement, StatementProvider } from './cas-types.js';
import { Money } from '../money/money.js';
import {
  cleanSecurityName,
  extractMutualFundSchemeDetails,
  inferAssetClassFromIsin,
  inferTickerFromSecurity,
  isValidIsin,
} from './isin.js';

const REGISTRAR_ROW = /^(CAMS|KFINTECH|KFIN|KARVY)\s+(\S+)\s*(.*)$/i;
const DATE_TOKEN = /\b(\d{2})-([A-Za-z]{3})-(\d{4})\b/;
const ISIN_TOKEN = /\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b/;
const NUMBER_TOKEN = /(?<![\w.])\d[\d,]*(?:\.\d+)?(?![\w.])/g;

const MONTHS: Record<string, string> = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
};

interface NumericRow {
  readonly units: number;
  readonly price: number;
  readonly marketValuePaise: bigint;
  readonly costPaise: bigint | undefined;
}

/**
 * Parses a decimal string (e.g. "1,23,456.789") into integer paise, rounded half-up.
 * Works on the string digits only so no floating-point error is introduced.
 */
function toPaise(token: string): bigint {
  const clean = token.replace(/,/g, '');
  const [whole = '0', frac = ''] = clean.split('.');
  const paddedFrac = (frac + '000').slice(0, 3);
  const paiseFromFrac = BigInt(paddedFrac.slice(0, 2));
  const roundUp = paddedFrac.charAt(2) >= '5' ? 1n : 0n;
  return BigInt(whole) * 100n + paiseFromFrac + roundUp;
}

/**
 * CAMS / KFintech "Consolidated Account Summary" parser.
 *
 * Each mutual fund row in this statement is laid out as:
 *   <Registrar> <Folio No> <Scheme code>-<Scheme name ... wrapped over several lines> (Non-Demat)
 *   <Closing Units> <NAV Date> <Price> <Market Value> <ISIN> <Cost Value>
 *
 * Note the extracted column order differs from the printed header, which is why
 * the generic CDSL fallback used to mis-assign units / NAV / value.
 *
 * Holdings are keyed by ISIN + Folio so the Direct and Regular plans of one scheme
 * inside the same folio remain separate holdings.
 */
export class CamsKfinCasParser implements ICasStatementParser {
  readonly provider: StatementProvider = 'CAMS_KFIN';

  canParse(rawText: string): boolean {
    const upper = rawText.toUpperCase();
    return (
      upper.includes('CONSOLIDATED ACCOUNT SUMMARY') &&
      (upper.includes('KFIN') || upper.includes('CAMS')) &&
      !upper.includes('CENTRAL DEPOSITORY SERVICES') &&
      !upper.includes('NATIONAL SECURITIES DEPOSITORY')
    );
  }

  parse(pages: readonly string[]): ParsedCasStatement {
    const lines = pages
      .join('\n')
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter((l) => l.length > 0);

    const statementDate = this.extractStatementDate(lines);
    const warnings: string[] = [];
    const holdingsByKey = new Map<string, ParsedCasHolding>();

    let blockStart = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      if (/^Total\b/i.test(line)) {
        blockStart = i + 1;
        continue;
      }

      const row = this.parseNumericRow(line);
      if (!row) continue;

      const isin = line.match(ISIN_TOKEN)![1]!;
      const header = this.collectHeader(lines, blockStart, i);
      blockStart = i + 1;

      if (!row.ok) {
        warnings.push(
          `Could not reconcile units × price with market value for ISIN ${isin}; row skipped.`
        );
        continue;
      }
      const numeric = row.value;

      const schemeName = this.cleanSchemeName(header.schemeRaw) || `Mutual Fund ${isin}`;
      const folio = header.folio;
      const { assetClassId, assetType, instrumentType } = inferAssetClassFromIsin(
        isin,
        schemeName,
        'mutual_fund_rta'
      );
      const mfDetails = extractMutualFundSchemeDetails(schemeName);
      const unitCost =
        numeric.costPaise !== undefined && numeric.costPaise > 0n && numeric.units > 0
          ? Money.fromDecimal(Number(numeric.costPaise) / 100 / numeric.units, 'INR')
          : Money.fromDecimal(numeric.price, 'INR');

      const holding: ParsedCasHolding = {
        isin,
        name: schemeName,
        ticker: inferTickerFromSecurity(isin, schemeName),
        folioOrDemat: folio,
        folioNumber: folio,
        amcName: mfDetails.amcName,
        schemePlan:
          mfDetails.plan !== 'Unknown'
            ? `${mfDetails.plan} Plan${mfDetails.option !== 'Unknown' ? ` - ${mfDetails.option}` : ''}`
            : undefined,
        assetType,
        assetClassId,
        instrumentType,
        quantity: numeric.units,
        unitCost,
        costBasisVerified: numeric.costPaise !== undefined && numeric.costPaise > 0n,
        reportedNavOrPrice: Money.fromDecimal(numeric.price, 'INR'),
        reportedMarketValue: Money.fromCents(numeric.marketValuePaise, 'INR'),
        statementDate,
        currency: 'INR',
      };

      const key = `${isin}::${folio ?? 'default'}`;
      if (holdingsByKey.has(key)) {
        warnings.push(`Duplicate entry for ISIN ${isin} in folio ${folio ?? 'n/a'} ignored.`);
        continue;
      }
      holdingsByKey.set(key, holding);
    }

    const holdings = Array.from(holdingsByKey.values());
    let totalValue = Money.zero('INR');
    for (const h of holdings) totalValue = totalValue.add(h.reportedMarketValue);

    this.checkStatementTotal(lines, totalValue, warnings);

    return {
      provider: this.provider,
      statementDate,
      holdings,
      transactions: [],
      totalReportedValue: totalValue,
      warnings,
    };
  }

  /**
   * A numeric row holds one ISIN, one NAV date and 3-4 numbers:
   * units, price, market value and (optionally) cost value, in that order.
   * The invariant units × price ≈ market value validates the column mapping,
   * with a permutation fallback in case the PDF text order differs.
   */
  private parseNumericRow(line: string): { ok: true; value: NumericRow } | { ok: false } | null {
    const isinMatch = line.match(ISIN_TOKEN);
    if (!isinMatch || !isValidIsin(isinMatch[1]!) || !DATE_TOKEN.test(line)) return null;

    const rest = line.replace(isinMatch[1]!, ' ').replace(DATE_TOKEN, ' ');
    const tokens = rest.match(NUMBER_TOKEN) ?? [];
    if (tokens.length < 3) return { ok: false };

    const matches = (u: string, p: string, v: string): boolean => {
      const units = parseFloat(u.replace(/,/g, ''));
      const price = parseFloat(p.replace(/,/g, ''));
      const valuePaise = toPaise(v);
      const expectedPaise = Math.round(units * price * 100);
      // Statement prints value rounded to the rupee/paisa: allow ₹1 or 0.1% drift
      const tolerance = Math.max(100, Math.round(Number(valuePaise) * 0.001));
      return Math.abs(expectedPaise - Number(valuePaise)) <= tolerance;
    };

    const build = (uIdx: number, pIdx: number, vIdx: number): NumericRow => {
      const costIdx = [0, 1, 2, 3].find(
        (n) => n < tokens.length && ![uIdx, pIdx, vIdx].includes(n)
      );
      return {
        units: parseFloat(tokens[uIdx]!.replace(/,/g, '')),
        price: parseFloat(tokens[pIdx]!.replace(/,/g, '')),
        marketValuePaise: toPaise(tokens[vIdx]!),
        costPaise: costIdx !== undefined ? toPaise(tokens[costIdx]!) : undefined,
      };
    };

    // Expected layout first
    if (matches(tokens[0]!, tokens[1]!, tokens[2]!)) {
      return { ok: true, value: build(0, 1, 2) };
    }

    // Fallback: any ordered triple satisfying units × price ≈ value
    for (let u = 0; u < tokens.length; u++) {
      for (let p = 0; p < tokens.length; p++) {
        for (let v = 0; v < tokens.length; v++) {
          if (u === p || p === v || u === v) continue;
          if (matches(tokens[u]!, tokens[p]!, tokens[v]!)) {
            return { ok: true, value: build(u, p, v) };
          }
        }
      }
    }
    return { ok: false };
  }

  /**
   * Walks the lines between the previous holding row and this one to find
   * "<Registrar> <Folio> <scheme...>" and the wrapped scheme name lines.
   */
  private collectHeader(
    lines: readonly string[],
    from: number,
    rowIdx: number
  ): { folio?: string; schemeRaw: string } {
    let startIdx = -1;
    for (let k = rowIdx - 1; k >= from; k--) {
      if (REGISTRAR_ROW.test(lines[k]!)) {
        startIdx = k;
        break;
      }
    }
    if (startIdx === -1) return { schemeRaw: '' };

    const first = lines[startIdx]!.match(REGISTRAR_ROW)!;
    const parts = [first[3] ?? '', ...lines.slice(startIdx + 1, rowIdx)];
    return { folio: first[2], schemeRaw: parts.join(' ') };
  }

  private cleanSchemeName(raw: string): string {
    let name = raw
      .replace(/\(\s*Non[-\s]*Demat\s*\)/gi, ' ')
      .replace(/\(\s*formerly[^)]*\)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Strip RTA scheme code prefix such as "GD201-", "K168D-", "PP001ZG-", "RMFMFAGG-"
    const code = name.match(/^([A-Z0-9]+)-(?=\S)/);
    if (code && (/\d/.test(code[1]!) || code[1]!.length >= 7)) {
      name = name.slice(code[0].length);
    }
    return cleanSecurityName(name);
  }

  private checkStatementTotal(lines: readonly string[], total: Money, warnings: string[]): void {
    const totalLine = lines.find((l) => /^Total\b/i.test(l) && /\d/.test(l));
    if (!totalLine) return;
    const nums = totalLine.match(NUMBER_TOKEN);
    if (!nums || nums.length === 0) return;

    // First figure is the Market Value total, second (when present) is Cost total.
    const reported = [toPaise(nums[0]!), nums[1] ? toPaise(nums[1]) : undefined];
    const marketCandidates = reported.filter((n): n is bigint => n !== undefined);
    const diff = marketCandidates.reduce<bigint | null>((best, candidate) => {
      const d = candidate > total.cents ? candidate - total.cents : total.cents - candidate;
      return best === null || d < best ? d : best;
    }, null);

    // Allow up to ₹10 for per-row rounding in the printed statement
    if (diff !== null && diff > 1000n) {
      warnings.push(
        `Sum of parsed holdings (${total.toDecimal().toFixed(2)}) does not match the statement total. Please review the preview before importing.`
      );
    }
  }

  private extractStatementDate(lines: readonly string[]): string {
    const candidate =
      lines.find((l) => /As on/i.test(l) && DATE_TOKEN.test(l)) ??
      lines.find((l) => DATE_TOKEN.test(l));
    const m = candidate?.match(DATE_TOKEN);
    if (m) {
      const month = MONTHS[m[2]!.toUpperCase()] ?? '01';
      return `${m[3]}-${month}-${m[1]}`;
    }
    return new Date().toISOString().split('T')[0]!;
  }
}
