import { useFamily } from '@/lib/family/family-context';
import { usePreferences } from '@/lib/preferences/preferences-context';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Users, Shield, CheckCircle } from 'lucide-react';

export function FamilyDistributionWidget() {
  const { familySummary, members, accounts, setSelectedMemberId, selectedMemberId } = useFamily();
  const { formatAmount } = usePreferences();

  if (!familySummary) {
    return null;
  }

  const {
    totalFamilyWealthPaise,
    memberDistributions,
    hufTaxHarvestBenefitPaise,
  } = familySummary;

  const hufBenefitNumber = Number(hufTaxHarvestBenefitPaise);

  return (
    <Card className="bg-slate-900/90 border-slate-800 shadow-xl overflow-hidden relative">
      {/* Decorative gradient blur */}
      <div className="absolute top-0 right-0 w-80 h-36 bg-purple-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-36 bg-blue-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      <CardHeader className="pb-3 border-b border-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base text-slate-100 font-semibold flex items-center gap-2">
                Family Wealth Distribution & Multi-PAN Architecture
                <Badge variant="outline" className="border-purple-500/40 text-purple-300 bg-purple-500/10 text-[10px]">
                  Phase 6A
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Aggregated household net worth across {members.length} legal entities and {accounts.length} Demat/MF folios
              </CardDescription>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">Total Family Wealth</div>
            <div className="text-lg font-bold text-white tracking-tight">
              {formatAmount(Number(totalFamilyWealthPaise))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Multi-Segment Distribution Bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-medium">
            <span>Portfolio Allocation by Entity</span>
            <span>100% Consolidated</span>
          </div>

          <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
            {memberDistributions.map((dist) => {
              if (dist.percentageOfTotal <= 0) return null;
              return (
                <div
                  key={dist.memberId}
                  className="h-full transition-all duration-500 hover:brightness-110 cursor-pointer relative group"
                  style={{
                    width: `${dist.percentageOfTotal}%`,
                    backgroundColor: dist.colorHex,
                  }}
                  title={`${dist.memberName}: ${dist.percentageOfTotal}% (${formatAmount(Number(dist.totalWealthPaise))})`}
                  onClick={() => setSelectedMemberId(dist.memberId)}
                />
              );
            })}
          </div>
        </div>

        {/* Member Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {memberDistributions.map((dist) => {
            const isSelected = selectedMemberId === dist.memberId;
            return (
              <div
                key={dist.memberId}
                onClick={() => setSelectedMemberId(dist.memberId)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 bg-blue-950/20 shadow-md ring-1 ring-blue-500/50'
                    : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: dist.colorHex }}
                    />
                    <span className="text-xs font-semibold text-slate-200 truncate max-w-[130px]">
                      {dist.memberName}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {dist.relationship}
                  </span>
                </div>

                <div className="text-sm font-bold text-white mb-1">
                  {formatAmount(Number(dist.totalWealthPaise))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{dist.percentageOfTotal}% of total</span>
                  <span>{dist.accountCount} {dist.accountCount === 1 ? 'Demat' : 'Demats'}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Multi-PAN HUF Tax Harvest Benefit Banner */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-purple-200 flex items-center gap-1.5">
                <span>HUF Section 112A Tax Shield Active</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300 border border-purple-700/50">
                  Budget 2024
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                Hindu Undivided Family (HUF) provides an independent PAN entity with its own ₹1,25,000 annual LTCG exemption.
              </p>
            </div>
          </div>

          <div className="shrink-0 text-left sm:text-right pl-2 sm:pl-0 border-l sm:border-l-0 border-purple-800/40">
            <div className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold">Annual Tax Advantage</div>
            <div className="text-sm font-bold text-emerald-400 flex items-center sm:justify-end gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{hufBenefitNumber > 0 ? formatAmount(hufBenefitNumber) : '₹15,625 / year'}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
