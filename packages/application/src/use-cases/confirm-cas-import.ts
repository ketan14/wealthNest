import { Result, ok, err } from '@wealthnest/shared';
import { ImportSummaryResult } from '@wealthnest/domain';
import { CasImportRepositoryPort, ConfirmCasImportParams } from '../ports/cas-import.port.js';

export class ConfirmCasImportUseCase {
  constructor(private readonly casImportRepo: CasImportRepositoryPort) {}

  async execute(params: ConfirmCasImportParams): Promise<Result<ImportSummaryResult>> {
    if (!params.userId || params.userId.trim().length === 0) {
      return err(new Error('User ID is required to import holdings.'));
    }

    const selectedItems = params.items.filter((i) => i.selected);
    const selectedTransactions = (params.transactions || []).filter((t) => t.selected);

    if (selectedItems.length === 0 && selectedTransactions.length === 0) {
      return ok({
        batchId: '',
        total: params.items.length,
        imported: 0,
        updated: 0,
        skipped: params.items.length,
        failed: 0,
        transactionsImported: 0,
      });
    }

    const res = await this.casImportRepo.upsertHoldingsFromCas({
      ...params,
      items: selectedItems,
      transactions: selectedTransactions,
    });

    if (res.success) {
      return ok({
        ...res.value,
        total: params.items.length,
        skipped: params.items.length - selectedItems.length,
      });
    }

    return res;
  }
}
