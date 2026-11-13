import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Building2, Landmark, Plus, Edit2, ShieldCheck, Percent } from 'lucide-react';
import { HoldingDetailDto, LiabilityDto } from '@wealthnest/application';
import { Money } from '@wealthnest/domain';
import { usePreferences } from '@/lib/preferences/preferences-context';

interface RealEstateSubViewProps {
  holdings: HoldingDetailDto[];
  liabilities: LiabilityDto[];
  onAddProperty?: () => void;
  onEditValuation?: (holding: HoldingDetailDto) => void;
  onAddLoan?: () => void;
}

export function RealEstateSubView({
  holdings,
  liabilities,
  onAddProperty,
  onEditValuation,
}: RealEstateSubViewProps) {
  const { currencySymbol, preferences } = usePreferences();
  const locale = preferences.numberFormat || 'en-IN';

  // Filter real estate holdings (real_estate or property asset classes)
  const properties = useMemo(() => {
    return holdings.filter(
      (h) => h.assetClassId === 'real_estate' || h.assetClassId === 'property'
    );
  }, [holdings]);

  // Map each property to its linked mortgages and net equity
  const propertyEquityList = useMemo(() => {
    return properties.map((property) => {
      // Find liabilities linked to this asset
      const linkedLoans = liabilities.filter((l) => l.linkedAssetId === property.assetId || l.linkedAssetId === property.holdingId);
      const totalDebtCents = linkedLoans.reduce((sum, l) => sum + (l.currentBalanceCents || 0n), 0n);
      const propertyValuationCents = BigInt(property.currentValueCents || 0);

      const propertyValue = Money.fromCents(propertyValuationCents, 'INR');
      const totalDebt = Money.fromCents(totalDebtCents, 'INR');

      // Net Equity = Property Valuation - Total Debt
      const netEquityCents = propertyValuationCents > totalDebtCents ? propertyValuationCents - totalDebtCents : 0n;
      const netEquity = Money.fromCents(netEquityCents, 'INR');

      // LTV % = (Debt / Valuation) * 100
      const ltvRatio = propertyValuationCents > 0n ? Number((totalDebtCents * 10000n) / propertyValuationCents) / 100 : 0;

      return {
        property,
        linkedLoans,
        propertyValue,
        totalDebt,
        netEquity,
        ltvRatio,
      };
    });
  }, [properties, liabilities]);

  const totalRealEstateGross = propertyEquityList.reduce((sum, p) => sum + p.propertyValue.toDecimal(), 0);
  const totalMortgageDebt = propertyEquityList.reduce((sum, p) => sum + p.totalDebt.toDecimal(), 0);
  const totalNetEquity = Math.max(0, totalRealEstateGross - totalMortgageDebt);
  const overallLtv = totalRealEstateGross > 0 ? (totalMortgageDebt / totalRealEstateGross) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Real Estate Equity Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>Gross Property Value</span>
              <Building2 className="w-4 h-4 text-emerald-400" />
            </div>
            <CardTitle className="text-2xl font-bold font-mono text-foreground pt-1">
              {currencySymbol}{totalRealEstateGross.toLocaleString(locale, { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">{properties.length} real estate parcels tracked</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>Mortgage Debt</span>
              <Landmark className="w-4 h-4 text-rose-400" />
            </div>
            <CardTitle className="text-2xl font-bold font-mono text-foreground pt-1">
              {currencySymbol}{totalMortgageDebt.toLocaleString(locale, { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">Linked home loans & mortgages</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>True Net Equity</span>
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold font-mono text-emerald-400 pt-1">
              {currencySymbol}{totalNetEquity.toLocaleString(locale, { maximumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">Market value minus outstanding loans</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
              <span>Overall LTV Ratio</span>
              <Percent className="w-4 h-4 text-blue-400" />
            </div>
            <CardTitle className="text-2xl font-bold font-mono text-foreground pt-1">
              {overallLtv.toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Badge
              variant={overallLtv <= 50 ? 'success' : overallLtv <= 75 ? 'secondary' : 'destructive'}
              className="text-[10px]"
            >
              {overallLtv <= 50 ? 'Conservative LTV' : overallLtv <= 75 ? 'Moderate LTV' : 'High Leverage'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Property Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Real Estate Parcels & Collateral</h3>
            <p className="text-xs text-muted-foreground">Independent property equity, mortgage balance, and appraisal history</p>
          </div>
          {onAddProperty && (
            <Button size="sm" onClick={onAddProperty} className="gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold">
              <Plus className="w-3.5 h-3.5" />
              Add Property
            </Button>
          )}
        </div>

        {propertyEquityList.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium text-foreground">No Real Estate Properties Registered</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Add your primary residence, plots, or rental apartments to track property equity alongside linked home loans.
            </p>
            {onAddProperty && (
              <Button size="sm" onClick={onAddProperty} className="mt-4 gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Register Property
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {propertyEquityList.map(({ property, linkedLoans, propertyValue, totalDebt, netEquity, ltvRatio }) => (
              <Card key={property.holdingId} className="border-border/80 bg-card/60 backdrop-blur-sm flex flex-col justify-between">
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary shrink-0" />
                          <CardTitle className="text-base font-semibold truncate">{property.name}</CardTitle>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{property.ticker || 'Residential Property'}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        LTV {ltvRatio.toFixed(1)}%
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Valuation vs Debt Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-muted-foreground">Equity: {currencySymbol}{netEquity.toDecimal().toLocaleString(locale, { maximumFractionDigits: 0 })}</span>
                        <span className="text-rose-400">Debt: {currencySymbol}{totalDebt.toDecimal().toLocaleString(locale, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="h-2 w-full bg-secondary/80 rounded-full overflow-hidden flex">
                        <div
                          style={{ width: `${Math.max(5, 100 - ltvRatio)}%` }}
                          className="bg-emerald-500 h-full"
                          title="Net Equity"
                        />
                        <div
                          style={{ width: `${Math.min(95, ltvRatio)}%` }}
                          className="bg-rose-500 h-full"
                          title="Mortgage Debt"
                        />
                      </div>
                    </div>

                    {/* Financial Figures Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/50">
                        <span className="text-[10px] text-muted-foreground uppercase block">Estimated Value</span>
                        <span className="text-sm font-bold font-mono text-foreground">
                          {currencySymbol}{propertyValue.toDecimal().toLocaleString(locale, { maximumFractionDigits: 0 })}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/50">
                        <span className="text-[10px] text-muted-foreground uppercase block">Net Equity</span>
                        <span className="text-sm font-bold font-mono text-emerald-400">
                          {currencySymbol}{netEquity.toDecimal().toLocaleString(locale, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>

                    {/* Linked Loans List */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-muted-foreground block">Linked Mortgage Loans</span>
                      {linkedLoans.length > 0 ? (
                        linkedLoans.map((loan) => (
                          <div key={loan.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 border border-border/40 text-xs">
                            <span className="font-medium text-foreground truncate">{loan.name}</span>
                            <span className="font-mono text-rose-400 shrink-0">
                              {currencySymbol}{Number(loan.currentBalanceCents / 100n).toLocaleString(locale, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                          <span>Debt-Free (100% Unencumbered)</span>
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </div>

                <div className="p-4 border-t border-border/50 bg-secondary/10 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Updated: {new Date(property.updatedAt).toLocaleDateString()}
                  </span>
                  {onEditValuation && (
                    <Button variant="ghost" size="sm" onClick={() => onEditValuation(property)} className="h-7 px-2.5 gap-1.5 text-xs text-primary">
                      <Edit2 className="w-3.5 h-3.5" />
                      Update Valuation
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

