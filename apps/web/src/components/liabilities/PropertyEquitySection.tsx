import { PropertyEquityDetail } from '@wealthnest/domain';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Building2 } from 'lucide-react';

interface PropertyEquitySectionProps {
  readonly propertyEquities: readonly PropertyEquityDetail[];
  readonly currencySymbol: string;
  readonly locale: string;
  readonly onUpdateAppraisal: (asset: { id: string; name: string; valuationCents: bigint }) => void;
}

export function PropertyEquitySection({
  propertyEquities,
  currencySymbol,
  locale,
  onUpdateAppraisal,
}: PropertyEquitySectionProps) {
  if (propertyEquities.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Property Equity & Loan-To-Value (LTV)
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Mortgage balances automatically offset property valuations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {propertyEquities.map((pe) => {
          const propVal = pe.propertyValue.toDecimal();
          const debtVal = pe.totalDebt.toDecimal();
          const eqVal = pe.equity.toDecimal();
          const ltv = pe.ltvRatioPercentage;

          return (
            <Card
              key={pe.assetId}
              className="border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden"
            >
              <CardHeader className="pb-3 border-b border-border/50 bg-accent/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    <CardTitle className="text-base font-semibold">{pe.assetName}</CardTitle>
                  </div>
                  <Badge
                    variant={pe.isNegativeEquity ? 'destructive' : 'success'}
                    className="text-xs"
                  >
                    {pe.isNegativeEquity ? 'Negative Equity / Underwater' : 'Positive Equity'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-accent/30 border border-border/60">
                    <span className="block text-[11px] text-muted-foreground uppercase font-medium">
                      Property Value
                    </span>
                    <span className="text-sm font-bold font-mono text-foreground">
                      {currencySymbol}
                      {propVal.toLocaleString(locale, { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-accent/30 border border-border/60">
                    <span className="block text-[11px] text-muted-foreground uppercase font-medium">
                      Secured Debt
                    </span>
                    <span className="text-sm font-bold font-mono text-rose-400">
                      {currencySymbol}
                      {debtVal.toLocaleString(locale, { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="block text-[11px] text-emerald-400 uppercase font-medium">
                      Net Home Equity
                    </span>
                    <span
                      className={`text-sm font-bold font-mono ${
                        pe.isNegativeEquity ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {pe.isNegativeEquity ? `-${currencySymbol}` : currencySymbol}
                      {eqVal.toLocaleString(locale, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                    <span className="text-muted-foreground">Loan-To-Value (LTV):</span>
                    <span
                      className={`font-semibold ${
                        ltv > 80
                          ? 'text-rose-400'
                          : ltv > 60
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                      }`}
                    >
                      {ltv.toFixed(1)}% LTV
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-accent overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        ltv > 80 ? 'bg-rose-500' : ltv > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(ltv, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>0%</span>
                    <span>Bank Limit 80%</span>
                    <span>100%</span>
                  </div>
                </div>

                {pe.linkedLoans.length > 0 && (
                  <div className="pt-2 border-t border-border/60">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5">
                      Secured Loans ({pe.linkedLoans.length})
                    </p>
                    <div className="space-y-1">
                      {pe.linkedLoans.map((l) => (
                        <div
                          key={l.liabilityId}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-accent/20"
                        >
                          <span className="text-foreground">{l.name}</span>
                          <span className="font-mono font-medium text-rose-400">
                            ₹
                            {l.outstandingBalance
                              .toDecimal()
                              .toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-xs gap-1.5 h-8"
                    onClick={() =>
                      onUpdateAppraisal({
                        id: pe.assetId,
                        name: pe.assetName,
                        valuationCents: BigInt(Math.round(propVal * 100)),
                      })
                    }
                  >
                    <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    Update Appraisal
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
