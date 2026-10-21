import { Result, ok, err } from '@wealthnest/shared';
import {
  CurrencyCode,
  Money,
  NetWorthSummary,
  calculateHistoricalNetWorth,
  AssetHistoricalInput,
  LiabilityHistoricalInput,
  AssetLiabilityLinkInput,
} from '@wealthnest/domain';
import { HoldingRepositoryPort } from '../ports/holding-repository.port.js';
import { LiabilityRepositoryPort } from '../ports/liability-repository.port.js';

export interface GetNetWorthParams {
  readonly userId: string;
  readonly asOfDate?: string; // ISO YYYY-MM-DD, defaults to current date
  readonly currency?: CurrencyCode;
}

export class GetNetWorthSummaryUseCase {
  constructor(
    private readonly holdingRepo: HoldingRepositoryPort,
    private readonly liabilityRepo: LiabilityRepositoryPort
  ) {}

  async execute(params: GetNetWorthParams): Promise<Result<NetWorthSummary>> {
    const userId = params.userId;
    const targetCurrency = params.currency || 'INR';
    const asOfDate = params.asOfDate || new Date().toISOString().split('T')[0]!;

    // 1. Fetch current holdings
    const holdingsResult = await this.holdingRepo.listDetailsByUser(userId);
    if (!holdingsResult.success) {
      return err(holdingsResult.error);
    }

    // 2. Fetch liabilities
    const liabilitiesResult = await this.liabilityRepo.listLiabilitiesByUser(userId);
    if (!liabilitiesResult.success) {
      return err(liabilitiesResult.error);
    }

    // 3. Fetch asset-liability links
    const linksResult = await this.liabilityRepo.listAssetLiabilityLinks(userId);
    const links: AssetLiabilityLinkInput[] = linksResult.success
      ? linksResult.value.map((l) => ({
          assetId: l.assetId,
          liabilityId: l.liabilityId,
          linkType: l.linkType,
          ownershipSharePercentage: l.ownershipSharePercentage,
        }))
      : [];

    // 4. Map assets to domain input with dated valuations
    const assetsInput: AssetHistoricalInput[] = [];
    for (const h of holdingsResult.value) {
      const holdingCurrency = (h.currency as CurrencyCode) || targetCurrency;
      const currentVal = Money.fromCents(
        BigInt(Math.round(Number(h.currentValueCents) || 0)),
        holdingCurrency
      );

      // Fetch dated valuations for asset
      const valuationsResult = await this.liabilityRepo.listAssetValuations(h.assetId, userId);
      const datedValuations = valuationsResult.success
        ? valuationsResult.value.map((v) => ({
            asOfDate: v.asOfDate,
            value: Money.fromCents(
              v.valuationCents,
              (v.currency as CurrencyCode) || holdingCurrency
            ),
          }))
        : [];

      assetsInput.push({
        assetId: h.assetId,
        name: h.name,
        assetClassId: h.assetClassId,
        valuations: datedValuations,
        fallbackCurrentValue: currentVal,
      });
    }

    // 5. Map liabilities to domain input with dated balances
    const liabilitiesInput: LiabilityHistoricalInput[] = [];
    for (const l of liabilitiesResult.value) {
      const libCurrency = (l.currency as CurrencyCode) || targetCurrency;
      const originalPrincipal = Money.fromCents(l.originalPrincipalCents, libCurrency);
      const emiAmount = Money.fromCents(l.emiAmountCents, libCurrency);

      // Fetch dated balances for liability
      const balancesResult = await this.liabilityRepo.listLiabilityBalances(l.id, userId);
      const datedBalances = balancesResult.success
        ? balancesResult.value.map((b) => ({
            asOfDate: b.asOfDate,
            balance: Money.fromCents(b.balanceCents, libCurrency),
          }))
        : [];

      // If no dated balances exist, use currentBalanceCents as snapshot
      if (datedBalances.length === 0 && l.currentBalanceCents > 0n) {
        datedBalances.push({
          asOfDate: l.lastBalanceDate || l.startDate || asOfDate,
          balance: Money.fromCents(l.currentBalanceCents, libCurrency),
        });
      }

      liabilitiesInput.push({
        liabilityId: l.id,
        name: l.name,
        loanType: l.loanType,
        lender: l.lender,
        status: l.status,
        emiAmount,
        originalPrincipal,
        startDate: l.startDate,
        balances: datedBalances,
        linkedAssetId: l.linkedAssetId,
      });
    }

    // 6. Execute pure domain calculation
    const summary = calculateHistoricalNetWorth({
      asOfDate,
      assets: assetsInput,
      liabilities: liabilitiesInput,
      links,
      currency: targetCurrency,
    });

    return ok(summary);
  }
}
