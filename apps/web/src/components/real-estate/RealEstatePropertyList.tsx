import { Link } from 'react-router-dom';
import {
  Building2,
  MapPin,
  AlertTriangle,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react';
import {
  PropertyType,
  RealEstatePropertyInput,
  summarizeRealEstatePortfolio,
} from '@wealthnest/domain';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface RealEstatePropertyListProps {
  isLoading: boolean;
  properties: ReturnType<typeof summarizeRealEstatePortfolio>['properties'];
  memberNameMap: Map<string, string>;
  isSupportModeActive: boolean;
  formatInr: (paise: bigint) => string;
  getPropertyTypeLabel: (type: PropertyType) => string;
  onEditProperty: (property: RealEstatePropertyInput) => void;
}

export function RealEstatePropertyList({
  isLoading,
  properties,
  memberNameMap,
  isSupportModeActive,
  formatInr,
  getPropertyTypeLabel,
  onEditProperty,
}: RealEstatePropertyListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-slate-400">
          Loading Real Estate Portfolio...
        </CardContent>
      </Card>
    );
  }

  if (properties.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-3">
          <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="text-base font-medium text-slate-200">No Real Estate Holdings Found</div>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Add a Real Estate holding or REIT in your Portfolio to track property equity, LTV,
            rental yields, and appreciation CAGR.
          </p>
          <Link to="/portfolio">
            <Button className="mt-2">Go to Portfolio</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {properties.map((metrics) => {
        const prop = metrics.input;
        const memberName = prop.memberId ? memberNameMap.get(prop.memberId) : undefined;
        const equityPct = Math.max(0, Math.min(100, 100 - metrics.ltvRatioPct));

        return (
          <Card key={prop.id} className="hover:border-slate-700 transition-colors">
            <CardContent className="p-5 space-y-4">
              {/* Top Row */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <h3 className="text-base font-semibold text-white truncate">{prop.name}</h3>
                  {prop.location && (
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {prop.location}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Badge variant="default">{getPropertyTypeLabel(prop.propertyType)}</Badge>
                    {memberName && <Badge variant="secondary">{memberName}</Badge>}
                    {metrics.ltvHealthBand === 'debt_free' && (
                      <Badge variant="success">Debt-Free (0% LTV)</Badge>
                    )}
                    {metrics.ltvHealthBand === 'healthy' && (
                      <Badge variant="success">Healthy LTV ({metrics.ltvRatioPct}%)</Badge>
                    )}
                    {metrics.ltvHealthBand === 'moderate' && (
                      <Badge variant="outline">Moderate LTV ({metrics.ltvRatioPct}%)</Badge>
                    )}
                    {metrics.ltvHealthBand === 'high_leverage' && (
                      <Badge variant="destructive">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        High LTV ({metrics.ltvRatioPct}%)
                      </Badge>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isSupportModeActive}
                  onClick={() => onEditProperty(prop)}
                  aria-label={`Configure ${prop.name}`}
                  className="shrink-0 text-xs gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Configure
                </Button>
              </div>

              {/* Equity vs Debt Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Equity:{' '}
                    <strong className="text-emerald-400">
                      {formatInr(metrics.netPropertyEquityPaise)}
                    </strong>
                  </span>
                  <span className="text-slate-400">
                    Valuation:{' '}
                    <strong className="text-white">{formatInr(prop.currentValuePaise)}</strong>
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${equityPct}%` }}
                  />
                  {metrics.ltvRatioPct > 0 && (
                    <div
                      className="bg-amber-500 h-full transition-all"
                      style={{ width: `${Math.min(100, metrics.ltvRatioPct)}%` }}
                    />
                  )}
                </div>
                {prop.linkedLoanName && (
                  <p className="text-[11px] text-amber-300/90">
                    Linked Loan: {prop.linkedLoanName} · Outstanding{' '}
                    {formatInr(prop.linkedLoanBalancePaise)}
                  </p>
                )}
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80 text-xs">
                <div>
                  <div className="text-slate-500">Gross / Net Yield</div>
                  <div className="font-semibold text-white mt-0.5">
                    {metrics.grossRentalYieldPct.toFixed(2)}% /{' '}
                    <span className="text-emerald-400">
                      {metrics.netRentalYieldPct.toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Monthly Rent</div>
                  <div className="font-semibold text-white mt-0.5">
                    {formatInr(prop.monthlyRentPaise)}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Net Cashflow / Mo</div>
                  <div
                    className={`font-semibold mt-0.5 ${
                      metrics.monthlyNetCashflowPaise >= 0n ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatInr(metrics.monthlyNetCashflowPaise)}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Appreciation</div>
                  <div className="font-semibold text-white mt-0.5 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                    {metrics.appreciationPct.toFixed(1)}%
                    {metrics.appreciationCagrPct !== null && (
                      <span className="text-slate-400 text-[11px]">
                        ({metrics.appreciationCagrPct.toFixed(1)}% CAGR)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

