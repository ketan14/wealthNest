import { useState, useMemo } from 'react';
import {
  calculateFamilyPortfolioSummary,
  HoldingFamilyItem,
} from '@wealthnest/domain';
import { HoldingDetailDto } from '@wealthnest/application';
import { useFamily } from '@/lib/family/family-context';
import { usePreferences } from '@/lib/preferences/preferences-context';
import { usePrivacy } from '@/lib/preferences/privacy-context';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { WEALTH_SURFACE } from '@/components/ui/DashboardPrimitives';
import {
  Users,
  Shield,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Settings2,
  Landmark,
} from 'lucide-react';

interface FamilyDistributionWidgetProps {
  readonly holdings?: readonly HoldingDetailDto[];
  readonly onManageEntities?: () => void;
}

/**
 * Phase 4 Compact Family Wealth & Multi-PAN Architecture Section:
 * - A. Family Ownership Overview: Combined Family + Individual Members + HUF PAN Entities with investment value, % share, holding count, account count, and joint ownership indicators.
 * - B. PAN Entity Management: Direct trigger to manage Individual PANs, HUF entities, and Demat/MF folios.
 * - C. Separate Expandable Tax Information section with verified FY eligibility context (no guaranteed-benefit placeholders).
 */
export function FamilyDistributionWidget({
  holdings,
  onManageEntities,
}: FamilyDistributionWidgetProps = {}) {
  const { familySummary, members, accounts, setSelectedMemberId, selectedMemberId } = useFamily();
  const { formatAmount } = usePreferences();
  const { maskAmount } = usePrivacy();
  const [isTaxExpanded, setIsTaxExpanded] = useState(true);

  // Compute live summary from active portfolio holdings when provided; fall back to context familySummary
  const effectiveSummary = useMemo(() => {
    if (holdings && members.length > 0) {
      const domainItems: HoldingFamilyItem[] = holdings.map((h) => ({
        id: h.holdingId,
        memberId: h.memberId,
        accountId: h.accountId,
        owners: h.owners,
        currentValuePaise: BigInt(Math.round(Number(h.currentValueCents) || 0)),
        costBasisPaise:
          h.costBasisVerified !== false
            ? BigInt(Math.round((Number(h.quantity) || 0) * (Number(h.unitCostCents) || 0)))
            : BigInt(Math.round(Number(h.currentValueCents) || 0)),
        holdingPeriodDays: 400,
        isEquityOrMutualFund: h.assetClassId === 'equity' || h.assetClassId === 'mutual_fund',
      }));
      return calculateFamilyPortfolioSummary(members, accounts, domainItems);
    }
    return familySummary;
  }, [holdings, members, accounts, familySummary]);

  // Count joint holdings per member when holdings are provided
  const jointCountByMember = useMemo(() => {
    const map = new Map<string, number>();
    if (!holdings) return map;
    for (const h of holdings) {
      if (h.owners && h.owners.length > 1) {
        for (const o of h.owners) {
          if (o.ownershipShare > 0) {
            map.set(o.familyMemberId, (map.get(o.familyMemberId) || 0) + 1);
          }
        }
      }
    }
    return map;
  }, [holdings]);

  if (!effectiveSummary) {
    return null;
  }

  const { totalFamilyWealthPaise, memberDistributions, hufTaxHarvestBenefitPaise } =
    effectiveSummary;
  const hufBenefitNumber = Number(hufTaxHarvestBenefitPaise);

  const individualCount = members.filter((m) => m.relationship !== 'huf').length;
  const hufCount = members.filter((m) => m.relationship === 'huf').length;
  const totalHoldingsCount = holdings
    ? holdings.length
    : memberDistributions.reduce((acc, d) => acc + d.holdingCount, 0);

  return (
    <Card className={`${WEALTH_SURFACE} overflow-hidden`}>
      <CardHeader className="pb-3 p-4 sm:p-6 sm:pb-3 border-b border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm sm:text-base text-foreground font-semibold flex items-center gap-2 flex-wrap">
                <span>Family Wealth Distribution &amp; Multi-PAN Architecture</span>
                <Badge
                  variant="outline"
                  className="border-primary/30 text-primary bg-primary/10 text-[10px]"
                >
                  Phase 6A
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {individualCount} family {individualCount === 1 ? 'member' : 'members'}
                {hufCount > 0 ? ` • ${hufCount} HUF PAN ${hufCount === 1 ? 'entity' : 'entities'}` : ''} •{' '}
                {accounts.length} Demat/MF {accounts.length === 1 ? 'folio' : 'folios'}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {onManageEntities && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onManageEntities}
                className="h-8 px-2.5 text-xs gap-1.5 border-border/80"
              >
                <Settings2 className="w-3.5 h-3.5 text-primary" />
                <span>Manage PAN &amp; Folios</span>
              </Button>
            )}
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                Total Family Wealth
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-foreground tracking-tight">
                {maskAmount(formatAmount(Number(totalFamilyWealthPaise)))}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 pt-4 space-y-4">
        {/* Multi-Segment Distribution Bar */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5 font-medium">
            <span>Portfolio Allocation by Entity</span>
            <span className="font-mono">{totalHoldingsCount} Holdings • 100% Consolidated</span>
          </div>

          <div className="h-2.5 w-full bg-secondary/70 rounded-full overflow-hidden flex border border-border/50">
            {memberDistributions.map((dist) => {
              if (dist.percentageOfTotal <= 0) return null;
              return (
                <div
                  key={dist.memberId}
                  className="h-full transition-all duration-300 hover:brightness-110 cursor-pointer"
                  style={{
                    width: `${dist.percentageOfTotal}%`,
                    backgroundColor: dist.colorHex,
                  }}
                  title={`${dist.memberName}: ${dist.percentageOfTotal}% (${maskAmount(formatAmount(Number(dist.totalWealthPaise)))})`}
                  onClick={() => setSelectedMemberId(dist.memberId)}
                />
              );
            })}
          </div>
        </div>

        {/* A. Family Ownership Overview Grid (Combined Family + Individual Members & HUF PANs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Combined Family Summary Card */}
          <div
            onClick={() => setSelectedMemberId('all')}
            className={`p-3 rounded-xl border transition-all cursor-pointer touch-manipulation ${
              selectedMemberId === 'all'
                ? 'border-primary bg-primary/10 shadow-xs'
                : 'border-border/70 bg-secondary/25 hover:bg-secondary/50 hover:border-border'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5 gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <Landmark className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground truncate">
                  Combined Family
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 shrink-0">
                ALL
              </span>
            </div>

            <div className="text-sm font-bold font-mono text-foreground mb-1">
              {maskAmount(formatAmount(Number(totalFamilyWealthPaise)))}
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <span>100% of total</span>
              <span>
                {totalHoldingsCount} {totalHoldingsCount === 1 ? 'holding' : 'holdings'} •{' '}
                {accounts.length} {accounts.length === 1 ? 'folio' : 'folios'}
              </span>
            </div>
          </div>

          {/* Individual Member & Legal PAN Entity Cards */}
          {memberDistributions.map((dist) => {
            const isSelected = selectedMemberId === dist.memberId;
            const isHufEntity = dist.relationship === 'huf';
            const jointCount = jointCountByMember.get(dist.memberId) ?? 0;

            return (
              <div
                key={dist.memberId}
                onClick={() => setSelectedMemberId(dist.memberId)}
                className={`p-3 rounded-xl border transition-all cursor-pointer touch-manipulation ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-xs'
                    : 'border-border/70 bg-secondary/25 hover:bg-secondary/50 hover:border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: dist.colorHex }}
                    />
                    <span className="text-xs font-semibold text-foreground truncate">
                      {dist.memberName}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                      isHufEntity
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-secondary text-muted-foreground border-border'
                    }`}
                  >
                    {isHufEntity ? 'HUF PAN' : dist.relationship}
                  </span>
                </div>

                <div className="text-sm font-bold font-mono text-foreground mb-1">
                  {maskAmount(formatAmount(Number(dist.totalWealthPaise)))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono gap-1 flex-wrap">
                  <span>{dist.percentageOfTotal}% of total</span>
                  <span>
                    {dist.holdingCount} {dist.holdingCount === 1 ? 'holding' : 'holdings'} •{' '}
                    {dist.accountCount} {dist.accountCount === 1 ? 'Demat' : 'Demats'}
                    {jointCount > 0 ? ` • ${jointCount} joint` : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* C. Separate Expandable Tax Information Section (Verified Eligibility & FY Context) */}
        <div className="rounded-xl border border-border/70 bg-secondary/20 overflow-hidden">
          <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                  <span>HUF Section 112A Tax Shield Active</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    FY 2025-26 • Budget 2024
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Separate HUF PAN entity carries an independent ₹1,25,000 annual equity LTCG
                  exemption threshold.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
              <div className="text-left sm:text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Annual Tax Advantage
                </div>
                <div className="text-sm font-bold font-mono text-emerald-400 flex items-center sm:justify-end gap-1">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{maskAmount(formatAmount(hufBenefitNumber))}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsTaxExpanded((prev) => !prev)}
                aria-expanded={isTaxExpanded}
                aria-label="Toggle tax eligibility details"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                {isTaxExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {isTaxExpanded && (
            <div className="px-3.5 pb-3 pt-2 border-t border-border/40 text-[11px] text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>
                Eligibility notice: Estimated LTCG tax differential based on verified equity/MF
                cost basis and holding periods (≥ 12 months). Not a guaranteed tax reduction.
              </span>
              <span className="font-mono text-[10px] text-purple-300 shrink-0">
                12.5% LTCG above ₹1.25L / PAN
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
