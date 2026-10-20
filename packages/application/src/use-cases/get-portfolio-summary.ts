import { Result, ok, err } from '@wealthnest/shared';
import {
  CurrencyCode,
  Money,
  calculatePortfolioSummary,
  PortfolioSummary,
  HoldingValuationItem,
} from '@wealthnest/domain';
import { HoldingRepositoryPort, HoldingDetailDto } from '../ports/holding-repository.port.js';

export interface PortfolioDataDto {
  readonly summary: PortfolioSummary;
  readonly holdings: readonly HoldingDetailDto[];
}

export class GetPortfolioSummaryUseCase {
  constructor(private readonly holdingRepo: HoldingRepositoryPort) {}

  async execute(userId: string, currency: CurrencyCode = 'INR'): Promise<Result<PortfolioDataDto>> {
    const holdingsResult = await this.holdingRepo.listDetailsByUser(userId);

    if (!holdingsResult.success) {
      return err(holdingsResult.error);
    }

    const holdings = holdingsResult.value;

    // Map DTOs to pure domain calculation input using Money value objects
    const valuationItems: HoldingValuationItem[] = holdings.map((h) => {
      const holdingCurrency = (h.currency as CurrencyCode) || currency;
      const totalCostCents = BigInt(
        Math.round((Number(h.quantity) || 0) * (Number(h.unitCostCents) || 0))
      );
      const costBasis = Money.fromCents(totalCostCents, holdingCurrency);
      const currentValue = Money.fromCents(
        BigInt(Math.round(Number(h.currentValueCents) || 0)),
        holdingCurrency
      );

      return {
        holdingId: h.holdingId,
        assetClassId: h.assetClassId,
        assetClassName: h.assetClassName,
        colorHex: h.assetClassColor,
        quantity: h.quantity,
        costBasis,
        currentValue,
      };
    });

    const summary = calculatePortfolioSummary(valuationItems, currency);

    return ok({
      summary,
      holdings,
    });
  }
}
