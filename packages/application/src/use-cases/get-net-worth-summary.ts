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
    const isLiveCurrentView = !params.asOfDate;
    const asOfDate = params.asOfDate || new Date().toISOString().split('T')[0]!;

    // 1-3. Fetch holdings, liabilities, and collateral links concurrently
    const [holdingsResult, liabilitiesResult, linksResult] = await Promise.all([
      params.householdId && this.holdingRepo.listDetailsByHousehold
        ? this.holdingRepo.listDetailsByHousehold(params.householdId)
        : this.holdingRepo.listDetailsByUser(params.userId),
      params.householdId && this.liabilityRepo.listLiabilitiesByHousehold
        ? this.liabilityRepo.listLiabilitiesByHousehold(params.householdId)
        : this.liabilityRepo.listLiabilitiesByUser(params.userId),
      this.liabilityRepo.listAssetLiabilityLinks(scopeId),
    ]);

    if (!holdingsResult.success) {
      return err(holdingsResult.error);
    }
    if (!liabilitiesResult.success) {
      return err(liabilitiesResult.error);
    }

    const memberFilter = params.memberId && params.memberId !== 'all' ? params.memberId : undefined;

    const filteredHoldings = memberFilter
      ? holdingsResult.value.filter(
          (h) =>
            h.memberId === memberFilter ||
            Boolean(h.owners?.some((o) => o.familyMemberId === memberFilter))
        )
      : holdingsResult.value;

    const filteredLiabilities = memberFilter
      ? liabilitiesResult.value.filter(
          (l) =>
            l.memberId === memberFilter ||
            Boolean(l.parties?.some((p) => p.familyMemberId === memberFilter)) ||
            Boolean(l.coBorrowerMemberIds && l.coBorrowerMemberIds.includes(memberFilter))
        )
      : liabilitiesResult.value;

    const links: AssetLiabilityLinkInput[] = linksResult.success
      ? linksResult.value.map((l) => ({
          assetId: l.assetId,
          liabilityId: l.liabilityId,
          linkType: l.linkType,
          ownershipSharePercentage: l.ownershipSharePercentage,
        }))
      : [];

    // 4. Map assets to domain input with dated valuations concurrently (deduplicated per assetId)
    const valuationCache = new Map<string, ReturnType<LiabilityRepositoryPort['listAssetValuations']>>();
    const getAssetValuations = (assetId: string) => {
      let pending = valuationCache.get(assetId);
      if (!pending) {
        pending = this.liabilityRepo.listAssetValuations(assetId, scopeId);
        valuationCache.set(assetId, pending);
      }
      return pending;
    };

    const assetsInput: AssetHistoricalInput[] = await Promise.all(
      filteredHoldings.map(async (h) => {
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
        const valuationsResult = await getAssetValuations(h.assetId);
        const datedValuations = valuationsResult.success
          ? valuationsResult.value.map((v) => ({
              asOfDate: v.asOfDate,
              value: Money.fromCents(
                scaleHoldingCents(v.valuationCents),
                (v.currency as CurrencyCode) || holdingCurrency
              ),
            }))
          : [];

        return {
          assetId: h.assetId,
          name: h.name,
          assetClassId: h.assetClassId,
          valuations: datedValuations,
          fallbackCurrentValue: currentVal,
        };
      })
    );

    // 5. Map liabilities to domain input with dated balances concurrently
    const liabilitiesInput: LiabilityHistoricalInput[] = await Promise.all(
      filteredLiabilities.map(async (l) => {
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

        const balancesResult = await this.liabilityRepo.listLiabilityBalances(l.id, scopeId);
        const rawBalances = balancesResult.success
          ? balancesResult.value.map((b) => ({
              asOfDate: b.asOfDate,
              balance: Money.fromCents(scaleLiabilityCents(b.balanceCents), libCurrency),
            }))
          : [];

        // For live System Overview (no explicit asOfDate), ensure the newest recorded balance
        // (e.g. local timezone ahead of UTC or edited statement date) is not dropped by UTC today.
        const datedBalances = isLiveCurrentView
          ? (() => {
              const sortedDesc = [...rawBalances].sort((a, b) =>
                b.asOfDate > a.asOfDate ? 1 : b.asOfDate < a.asOfDate ? -1 : 0
              );
              const newest = sortedDesc[0];
              if (newest && newest.asOfDate > asOfDate) {
                return [{ asOfDate, balance: newest.balance }];
              }
              return sortedDesc;
            })()
          : rawBalances;

        // If no dated balances exist, use currentBalanceCents (including 0n for paid-off loans) as snapshot
        if (datedBalances.length === 0) {
          datedBalances.push({
            asOfDate:
              l.lastBalanceDate && (!isLiveCurrentView || l.lastBalanceDate <= asOfDate)
                ? l.lastBalanceDate
                : l.startDate && l.startDate <= asOfDate
                  ? l.startDate
                  : asOfDate,
            balance: Money.fromCents(scaleLiabilityCents(l.currentBalanceCents), libCurrency),
          });
        }

        return {
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
        };
      })
    );

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
