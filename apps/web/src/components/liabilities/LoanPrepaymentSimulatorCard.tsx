import { useMemo, useState } from 'react';
import { LiabilityDto } from '@wealthnest/application';
import { Money, simulateLoanPrepayment } from '@wealthnest/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AccessibleChartContainer } from '@/components/ui/AccessibleChartContainer';
import { TrendingDown, Calculator } from 'lucide-react';

interface LoanPrepaymentSimulatorCardProps {
  readonly liabilities: readonly LiabilityDto[];
}

const EXTRA_MONTHLY_OPTIONS = [0, 5000, 10000, 25000] as const;
const LUMP_SUM_OPTIONS = [0, 100000, 250000, 500000] as const;

export function LoanPrepaymentSimulatorCard({ liabilities }: LoanPrepaymentSimulatorCardProps) {
  const activeLoans = useMemo(
    () => liabilities.filter((l) => l.status === 'active' && l.currentBalanceCents > 0n),
    [liabilities]
  );

  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [extraMonthlyRupees, setExtraMonthlyRupees] = useState<number>(10000);
  const [lumpSumRupees, setLumpSumRupees] = useState<number>(100000);

  const activeLoan = useMemo(() => {
    if (activeLoans.length === 0) return null;
    return activeLoans.find((l) => l.id === selectedLoanId) ?? activeLoans[0]!;
  }, [activeLoans, selectedLoanId]);

  const simulation = useMemo(() => {
    if (!activeLoan) return null;
    const currency = activeLoan.currency === 'USD' ? 'USD' : 'INR';
    return simulateLoanPrepayment({
      outstandingBalance: Money.fromCents(activeLoan.currentBalanceCents, currency),
      annualInterestRate: activeLoan.interestRate,
      monthlyEmi: Money.fromCents(activeLoan.emiAmountCents, currency),
      extraMonthlyPrepayment: Money.fromDecimal(extraMonthlyRupees, currency),
      lumpSumPrepayment: Money.fromDecimal(lumpSumRupees, currency),
    });
  }, [activeLoan, extraMonthlyRupees, lumpSumRupees]);

  if (!activeLoan || !simulation) {
    return null;
  }

  const maxBalance = Math.max(
    ...simulation.yearlySchedule.map((p) => p.baselineBalance.toDecimal()),
    1
  );
  const width = 560;
  const height = 180;
  const padX = 28;
  const padY = 18;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;
  const totalPts = Math.max(simulation.yearlySchedule.length - 1, 1);

  const toX = (idx: number) => padX + (idx / totalPts) * plotW;
  const toY = (val: number) => padY + plotH - (val / maxBalance) * plotH;

  const baselinePoints = simulation.yearlySchedule
    .map((p, idx) => `${toX(idx).toFixed(1)},${toY(p.baselineBalance.toDecimal()).toFixed(1)}`)
    .join(' ');

  const acceleratedPoints = simulation.yearlySchedule
    .map((p, idx) => `${toX(idx).toFixed(1)},${toY(p.acceleratedBalance.toDecimal()).toFixed(1)}`)
    .join(' ');

  const tableRows = simulation.yearlySchedule.map((p) => ({
    label: `Year ${p.year}`,
    values: [p.baselineBalance.formatIndianCompact(), p.acceleratedBalance.formatIndianCompact()],
  }));

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              Prepayment & Compound Amortization Simulator
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Compare baseline EMI schedule against extra monthly or lump-sum principal prepayments
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="text-[11px] border-emerald-500/30 text-emerald-400 self-start sm:self-auto"
          >
            {activeLoan.interestRate.toFixed(2)}% p.a. ({activeLoan.interestType})
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div>
            <label
              htmlFor="prepay-loan-select"
              className="text-[11px] text-muted-foreground block mb-1"
            >
              Active Loan
            </label>
            <select
              id="prepay-loan-select"
              value={activeLoan.id}
              onChange={(e) => setSelectedLoanId(e.target.value)}
              className="w-full h-9 rounded-lg border border-border/80 bg-secondary/50 px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {activeLoans.map((l) => (
                <option key={l.id} value={l.id}>
                  Simulate: {l.name} ({l.lender})
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="text-[11px] text-muted-foreground block mb-1">
              Extra Monthly Prepay
            </span>
            <div className="flex flex-wrap gap-1.5">
              {EXTRA_MONTHLY_OPTIONS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setExtraMonthlyRupees(amt)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                    extraMonthlyRupees === amt
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-secondary/40 border-border/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {amt === 0 ? '₹0' : `₹${(amt / 1000).toFixed(0)}k`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[11px] text-muted-foreground block mb-1">One-Time Lump Sum</span>
            <div className="flex flex-wrap gap-1.5">
              {LUMP_SUM_OPTIONS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setLumpSumRupees(amt)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                    lumpSumRupees === amt
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-secondary/40 border-border/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {amt === 0 ? '₹0' : `₹${(amt / 100000).toFixed(amt % 100000 === 0 ? 0 : 1)}L`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-secondary/40 border border-border/60">
            <p className="text-[11px] text-muted-foreground">Interest Saved</p>
            <p className="text-sm sm:text-base font-bold font-mono text-emerald-400">
              {simulation.interestSaved.formatIndianCompact()}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-secondary/40 border border-border/60">
            <p className="text-[11px] text-muted-foreground">Tenure Reduced</p>
            <p className="text-sm sm:text-base font-bold font-mono text-cyan-400">
              {simulation.monthsSaved} mos
            </p>
          </div>
          <div className="p-3 rounded-xl bg-secondary/40 border border-border/60">
            <p className="text-[11px] text-muted-foreground">Baseline Payoff</p>
            <p className="text-sm sm:text-base font-bold font-mono text-foreground">
              {(simulation.baselineMonthsToPayoff / 12).toFixed(1)} yrs
            </p>
          </div>
          <div className="p-3 rounded-xl bg-secondary/40 border border-border/60">
            <p className="text-[11px] text-muted-foreground">Accelerated Payoff</p>
            <p className="text-sm sm:text-base font-bold font-mono text-emerald-300 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" />
              {(simulation.acceleratedMonthsToPayoff / 12).toFixed(1)} yrs
            </p>
          </div>
        </div>

        <AccessibleChartContainer
          title={`Amortization payoff curve for ${activeLoan.name}`}
          description={`Prepaying saves ${simulation.interestSaved.formatIndianCompact()} in interest and reduces tenure by ${simulation.monthsSaved} months.`}
          headers={['Year', 'Baseline Balance', 'With Prepayment']}
          rows={tableRows}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-44 overflow-visible"
            role="img"
            aria-label={`Loan balance projection for ${activeLoan.name}`}
          >
            <line
              x1={padX}
              y1={padY + plotH}
              x2={width - padX}
              y2={padY + plotH}
              stroke="currentColor"
              strokeOpacity="0.15"
            />
            <polyline
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="4 4"
              points={baselinePoints}
            />
            <polyline fill="none" stroke="#10b981" strokeWidth="2.5" points={acceleratedPoints} />
          </svg>
        </AccessibleChartContainer>
      </CardContent>
    </Card>
  );
}
