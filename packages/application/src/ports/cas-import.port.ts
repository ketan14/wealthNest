import { Result } from '@wealthnest/shared';
import { StatementProvider, ImportSummaryResult } from '@wealthnest/domain';

export interface ImportCasItemDto {
  readonly isin: string;
  readonly name: string;
  readonly ticker?: string;
  readonly assetClassId: string;
  readonly instrumentType?: string;
  readonly dematAccountId?: string;
  readonly folioNumber?: string;
  readonly amcName?: string;
  readonly schemePlan?: string;
  readonly quantity: number;
  readonly unitCostCents: number;
  readonly currentValueCents: number;
  readonly costBasisVerified?: boolean;
  readonly currency: string;
  readonly selected: boolean;
  readonly isExisting?: boolean;
}

export interface ImportCasTransactionDto {
  readonly isin: string;
  readonly schemeName: string;
  readonly ticker?: string;
  readonly date: string; // ISO date string YYYY-MM-DD
  readonly description: string;
  readonly type: 'buy' | 'sell' | 'dividend' | 'fee';
  readonly amountCents: number;
  readonly units?: number;
  readonly navPriceCents?: number;
  readonly currency: string;
  readonly selected: boolean;
  readonly folio?: string;
}

export interface CasPreviewDto {
  readonly provider: StatementProvider;
  readonly statementDate: string;
  readonly items: readonly ImportCasItemDto[];
  readonly equities: readonly ImportCasItemDto[];
  readonly mutualFunds: readonly ImportCasItemDto[];
  readonly transactions?: readonly ImportCasTransactionDto[];
  readonly totalReportedValueCents: number;
  readonly warnings: readonly string[];
}

export interface ConfirmCasImportParams {
  readonly userId: string;
  readonly provider: StatementProvider;
  readonly statementDate: string;
  readonly items: readonly ImportCasItemDto[];
  readonly transactions?: readonly ImportCasTransactionDto[];
}

export interface CasImportRepositoryPort {
  upsertHoldingsFromCas(params: ConfirmCasImportParams): Promise<Result<ImportSummaryResult>>;
}
