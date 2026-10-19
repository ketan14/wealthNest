import { CurrencyCode } from '../money/currency.js';
import { Money } from '../money/money.js';

export type StatementProvider = 'NSDL' | 'CDSL' | 'UNKNOWN';

export type ParsedAssetType = 'equity' | 'mutual_fund' | 'bond' | 'commodity' | 'reit' | 'other';

export interface ParsedCasHolding {
  readonly isin: string;
  readonly name: string;
  readonly ticker?: string;
  readonly folioOrDemat?: string;
  readonly assetType: ParsedAssetType;
  readonly assetClassId: string;
  readonly quantity: number;
  readonly unitCost?: Money;
  readonly reportedNavOrPrice?: Money;
  readonly reportedMarketValue: Money;
  readonly statementDate: string; // ISO date string YYYY-MM-DD
  readonly currency: CurrencyCode;
}

export interface ParsedCasTransaction {
  readonly isin: string;
  readonly schemeName: string;
  readonly ticker?: string;
  readonly date: string; // ISO date string YYYY-MM-DD
  readonly description: string;
  readonly type: 'buy' | 'sell' | 'dividend' | 'fee';
  readonly amount: Money;
  readonly units?: number;
  readonly navOrPrice?: Money;
  readonly folio?: string;
}

export interface ParsedCasStatement {
  readonly provider: StatementProvider;
  readonly statementDate: string; // ISO date string
  readonly investorName?: string; // Sanitized
  readonly holdings: readonly ParsedCasHolding[];
  readonly transactions?: readonly ParsedCasTransaction[];
  readonly totalReportedValue: Money;
  readonly warnings: readonly string[];
}

export interface ImportSummaryResult {
  readonly batchId: string;
  readonly total: number;
  readonly imported: number;
  readonly updated: number;
  readonly skipped: number;
  readonly failed: number;
  readonly transactionsImported?: number;
}
