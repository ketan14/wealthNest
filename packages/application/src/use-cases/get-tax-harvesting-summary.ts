import { Result, ok, err, isOk } from '@wealthnest/shared';
import {
  calculateCapitalGainsTaxSummary,
  PortfolioTaxSummary,
  RawHoldingTaxInput,
} from '@wealthnest/domain';
import { HoldingRepositoryPort } from '../ports/holding-repository.port.js';

export interface TaxHarvestingOpportunity {
  readonly holdingId: string;
  readonly assetName: string;
  readonly isin?: string;
  readonly assetClassId: string;
  readonly quantity: number;
  readonly currentLossAmountCents: number;
  readonly potentialTaxSavingsCents: number;
  readonly holdingPeriodDays: number;
  readonly term: 'long_term' | 'short_term';
  readonly recommendation: string;
}

export interface TaxHarvestingSummaryDto {
  readonly taxSummary: PortfolioTaxSummary;
  readonly topHarvestingOpportunities: readonly TaxHarvestingOpportunity[];
  readonly deadlineDate: string; // e.g. "March 31, 2026"
  readonly daysRemainingInFy: number;
}

export class GetTaxHarvestingSummaryUseCase {
  constructor(private readonly holdingRepo: HoldingRepositoryPort) {}

  async execute(
    userId: string,
    asOfDateStr: string = new Date().toISOString().slice(0, 10)
  ): Promise<Result<TaxHarvestingSummaryDto>> {
    try {
      const holdingsRes = await this.holdingRepo.listDetailsByUser(userId);
      const holdings = isOk(holdingsRes) ? holdingsRes.value : [];

      const rawInputs: RawHoldingTaxInput[] = holdings.map((h) => ({
        holdingId: h.holdingId,
        name: h.name,
        assetClassId: h.assetClassId,
        isin: h.isin,
        quantity: h.quantity,
        unitCostCents: h.unitCostCents,
        currentValueCents: h.currentValueCents,
        purchaseDate: h.updatedAt ? h.updatedAt.slice(0, 10) : undefined,
      }));

      const taxSummary = calculateCapitalGainsTaxSummary(rawInputs, asOfDateStr);

      // Extract loss positions that can be booked to offset gains
      const lossHoldings = taxSummary.holdings.filter((h) => !h.isGain);

      const opportunities: TaxHarvestingOpportunity[] = lossHoldings
        .map((h) => {
          const savingsCents =
            h.term === 'short_term'
              ? Math.round(Number(h.harvestableLoss.cents) * 0.20)
              : Math.round(Number(h.harvestableLoss.cents) * 0.125);

          return {
            holdingId: h.holdingId,
            assetName: h.assetName,
            isin: h.isin,
            assetClassId: h.assetClassId,
            quantity: h.quantity,
            currentLossAmountCents: Number(h.harvestableLoss.cents),
            potentialTaxSavingsCents: savingsCents,
            holdingPeriodDays: h.holdingPeriodDays,
            term: h.term,
            recommendation: `Sell to harvest ₹${(Number(h.harvestableLoss.cents) / 100).toLocaleString('en-IN')} loss; reinvest in similar fund or rebuy after settlement to save approx ₹${(savingsCents / 100).toLocaleString('en-IN')} in tax.`,
          };
        })
        .sort((a, b) => b.potentialTaxSavingsCents - a.potentialTaxSavingsCents);

      // Compute remaining days to March 31
      const asOf = new Date(asOfDateStr);
      const currentYear = asOf.getFullYear();
      const currentMonth = asOf.getMonth() + 1;
      const targetYear = currentMonth > 3 ? currentYear + 1 : currentYear;
      const fyEndDate = new Date(`${targetYear}-03-31T23:59:59Z`);
      const daysRemaining = Math.max(0, Math.ceil((fyEndDate.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24)));

      return ok({
        taxSummary,
        topHarvestingOpportunities: opportunities,
        deadlineDate: `March 31, ${targetYear}`,
        daysRemainingInFy: daysRemaining,
      });
    } catch (e: any) {
      return err(new Error(e?.message || 'Failed to calculate tax harvesting summary'));
    }
  }
}
