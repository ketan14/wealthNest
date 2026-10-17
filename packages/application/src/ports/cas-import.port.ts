import { Result } from '@wealthnest/shared';
import { StatementProvider, ImportSummaryResult } from '@wealthnest/domain';

export interface ImportCasItemDto {
  readonly isin: string;
  readonly name: string;
  readonly ticker?: string;
  readonly assetClassId: string;
  readonly quantity: number;
  readonly unitCostCents: number;
  readonly currentValueCents: number;
  readonly currency: string;
  readonly selected: boolean;
  readonly isExisting?: boolean;
}

export interface CasPreviewDto {
  readonly provider: StatementProvider;
  readonly statementDate: string;
  readonly items: readonly ImportCasItemDto[];
  readonly totalReportedValueCents: number;
  readonly warnings: readonly string[];
}

export interface ConfirmCasImportParams {
  readonly userId: string;
  readonly provider: StatementProvider;
  readonly statementDate: string;
  readonly items: readonly ImportCasItemDto[];
}

export interface CasImportRepositoryPort {
  upsertHoldingsFromCas(params: ConfirmCasImportParams): Promise<Result<ImportSummaryResult>>;
}
