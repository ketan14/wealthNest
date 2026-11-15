import { Result, ok, err } from '@wealthnest/shared';
import {
  CurrencyCode,
  Money,
  NetWorthSummary,
  calculateHistoricalNetWorth,
  AssetHistoricalInput,
  LiabilityHistoricalInput,
  AssetLiabilityLinkInput,
  allocateBigIntByShares,
  calculateMemberLiabilitySharePaise,
} from '@wealthnest/domain';
import { HoldingRepositoryPort } from '../ports/holding-repository.port.js';
import { LiabilityRepositoryPort } from '../ports/liability-repository.port.js';

export interface GetNetWorthParams {
  readonly userId: string;
  readonly householdId?: string;
  readonly asOfDate?: string; // ISO YYYY-MM-DD, defaults to current date
  readonly currency?: CurrencyCode;
  readonly memberId?: string;
}

export class GetNetWorthSummaryUseCase {
  constructor(
    private readonly holdingRepo: HoldingRepositoryPort,
    private readonly liabilityRepo: LiabilityRepositoryPort
  ) {}

  async execute(params: GetNetWorthParams): Promise<Result<NetWorthSummary>> {
    const scopeId = params.householdId || params.userId;
    const targetCurrency = params.currency || 'INR';
    const asOfDate = params.asOfDate || new Date().toISOString().split('T')[0]!;

    // 1. Fetch current holdings
    const holdingsResult = await (params.householdId && this.holdingRepo.listDetailsByHousehold
      ? this.holdingRepo.listDetailsByHousehold(params.householdId)
      : this.holdingRepo.listDetailsByUser(params.userId));
    if (!holdingsResult.success) {
      return err(holdingsResult.error);
    }

    const memberFilter = params.memberId && params.memberId !== 'all' ? params.memberId : undefined;

    const filteredHoldings = memberFilter
      ? holdingsResult.value.filter(
          (h) =>
            h.memberId === memberFilter ||
            Boolean(h.owners?.some((o) => o.familyMemberId === memberFilter))
        )
      : holdingsResult.value;

    // 2. Fetch liabilities
    const liabilitiesResult = await (params.householdId &&
    this.liabilityRepo.listLiabilitiesByHousehold
      ? this.liabilityRepo.listLiabilitiesByHousehold(params.householdId)
      : this.liabilityRepo.listLiabilitiesByUser(params.userId));
    if (!liabilitiesResult.success) {
      return err(liabilitiesResult.error);
    }

    const filteredLiabilities = memberFilter
      ? liabilitiesResult.value.filter(
          (l) =>
            l.memberId === memberFilter ||
            Boolean(l.parties?.some((p) => p.familyMemberId === memberFilter)) ||
            Boolean(l.coBorrowerMemberIds && l.coBorrowerMemberIds.includes(memberFilter))
        )
      : liabilitiesResult.value;

    // 3. Fetch asset-liability links
    const linksResult = await this.liabilityRepo.listAssetLiabilityLinks(scopeId);
    const links: AssetLiabilityLinkInput[] = linksResult.success
      ? linksResult.value.map((l) => ({
          assetId: l.assetId,
          liabilityId: l.liabilityId,
          linkType: l.linkType,
          ownershipSharePercentage: l.ownershipSharePercentage,
        }))
      : [];

    // 4. Map assets to domain input with dated valuations (respecting joint ownership splits on member filter)
    const assetsInput: AssetHistoricalInput[] = [];
    for (const h of filteredHoldings) {
      const holdingCurrency = (h.currency as CurrencyCode) || targetCurrency;
      const rawCurrentCents = BigInt(Math.round(Number(h.currentValueCents) || 0));
      const scaleHoldingCents = (amount: bigint): bigint => {
        if (!memberFilter || !h.owners || h.owners.length === 0) return amount;
        const splits = allocateBigIntByShares(
          amount,
          h.owners.map((o) => ({
            familyMemberId: o.familyMemberId,
            sharePercentage: o.ownershipShare,
            isPrimary: o.isPrimaryOwner,
          }))
        );
        return splits.find((s) => s.familyMemberId === memberFilter)?.allocatedCents ?? 0n;
      };

      const currentVal = Money.fromCents(scaleHoldingCents(rawCurrentCents), holdingCurrency);

      // Fetch dated valuations for asset
      const valuationsResult = await this.liabilityRepo.listAssetValuations(h.assetId, scopeId);
      const datedValuations = valuationsResult.success
        ? valuationsResult.value.map((v) => ({
            asOfDate: v.asOfDate,
            value: Money.fromCents(
              scaleHoldingCents(v.valuationCents),
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

    // 5. Map liabilities to domain input with dated balances (respecting joint liability splits on member filter)
    const liabilitiesInput: LiabilityHistoricalInput[] = [];
    for (const l of filteredLiabilities) {
      const libCurrency = (l.currency as CurrencyCode) || targetCurrency;
      const scaleLiabilityCents = (amount: bigint): bigint => {
        if (!memberFilter) return amount;
        if (l.parties && l.parties.length > 0) {
          return calculateMemberLiabilitySharePaise({
            outstandingBalanceCents: amount,
            memberId: memberFilter,
            primaryMemberId: l.memberId,
            parties: l.parties,
          });
        }
        return amount;
      };

      const originalPrincipal = Money.fromCents(
        scaleLiabilityCents(l.originalPrincipalCents),
        libCurrency
      );
      const emiAmount = Money.fromCents(scaleLiabilityCents(l.emiAmountCents), libCurrency);

      // Fetch dated balances for liability
      const balancesResult = await this.liabilityRepo.listLiabilityBalances(l.id, scopeId);
      const datedBalances = balancesResult.success
        ? balancesResult.value.map((b) => ({
            asOfDate: b.asOfDate,
            balance: Money.fromCents(scaleLiabilityCents(b.balanceCents), libCurrency),
          }))
        : [];

      // If no dated balances exist, use currentBalanceCents as snapshot
      if (datedBalances.length === 0 && l.currentBalanceCents > 0n) {
        datedBalances.push({
          asOfDate: l.lastBalanceDate || l.startDate || asOfDate,
          balance: Money.fromCents(scaleLiabilityCents(l.currentBalanceCents), libCurrency),
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
