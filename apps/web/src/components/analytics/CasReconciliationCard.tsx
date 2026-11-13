import React, { useState, useMemo } from 'react';
import {
  FileCheck2,
  Upload,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import {
  Money,
  CurrencyCode,
  ParsedCasHolding,
  ParsedBrokerHolding,
  ParsedBrokerTrade,
  detectAndParseBrokerCsv,
  reconcileCasWithBroker,
  ReconciliationStatus,
} from '@wealthnest/domain';
import { HoldingDetailDto } from '@wealthnest/application';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface CasReconciliationCardProps {
  holdings: readonly HoldingDetailDto[];
}

function toCasHoldings(holdings: readonly HoldingDetailDto[]): ParsedCasHolding[] {
  const today = new Date().toISOString().slice(0, 10);
  return holdings
    .filter((h) => h.assetClassId === 'equity' || h.assetClassId === 'mutual_fund')
    .map((h) => {
      const currency = (h.currency as CurrencyCode) || 'INR';
      return {
        isin: h.isin || h.ticker || h.holdingId,
        name: h.name,
        ticker: h.ticker,
        assetType: h.assetClassId === 'mutual_fund' ? 'mutual_fund' : 'equity',
        assetClassId: h.assetClassId,
        quantity: h.quantity,
        unitCost: Money.fromCents(BigInt(Math.round(h.unitCostCents || 0)), currency),
        costBasisVerified: h.costBasisVerified !== false,
        reportedMarketValue: Money.fromCents(
          BigInt(Math.round(h.currentValueCents || 0)),
          currency
        ),
        statementDate: today,
        currency,
      };
    });
}

function getStatusBadge(status: ReconciliationStatus) {
  switch (status) {
    case 'matched':
      return <Badge variant="success">Matched</Badge>;
    case 'cost_basis_unverified':
      return <Badge variant="outline">Unverified Cost Basis</Badge>;
    case 'quantity_mismatch':
      return <Badge variant="destructive">Qty Mismatch</Badge>;
    case 'missing_in_broker':
      return <Badge variant="secondary">Missing in Broker</Badge>;
    case 'missing_in_cas':
      return <Badge variant="secondary">Missing in CAS</Badge>;
  }
}

export function CasReconciliationCard({ holdings }: CasReconciliationCardProps) {
  const [brokerHoldings, setBrokerHoldings] = useState<readonly ParsedBrokerHolding[]>([]);
  const [brokerTrades, setBrokerTrades] = useState<readonly ParsedBrokerTrade[]>([]);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [parseWarning, setParseWarning] = useState<string | null>(null);

  const casHoldings = useMemo(() => toCasHoldings(holdings), [holdings]);

  const effectiveBrokerHoldings = useMemo(() => {
    if (brokerHoldings.length > 0 || brokerTrades.length > 0) return brokerHoldings;
    // Default baseline mirrors current holdings when no CSV uploaded yet so cost-basis flags show
    return casHoldings.map((c) => ({
      symbol: c.ticker || c.isin,
      isin: c.isin,
      name: c.name,
      quantity: c.quantity,
      unitCost: c.unitCost || Money.zero('INR'),
      assetType: (c.assetType === 'mutual_fund' ? 'mutual_fund' : 'equity') as
        | 'equity'
        | 'mutual_fund',
      rawBroker: 'ZERODHA' as const,
    }));
  }, [brokerHoldings, brokerTrades, casHoldings]);

  const summary = useMemo(
    () =>
      reconcileCasWithBroker({
        casHoldings,
        brokerHoldings: effectiveBrokerHoldings,
        brokerTrades,
      }),
    [casHoldings, effectiveBrokerHoldings, brokerTrades]
  );

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseWarning(null);

    const text = await file.text();
    const parsed = detectAndParseBrokerCsv(text);

    if (parsed.holdings.length === 0 && parsed.trades.length === 0) {
      setParseWarning(
        parsed.warnings[0] ||
          'Could not detect Zerodha or Groww holdings/tradebook columns in CSV.'
      );
      return;
    }

    setBrokerHoldings(parsed.holdings);
    setBrokerTrades(parsed.trades);
    setSourceLabel(`${parsed.provider} ${parsed.csvType} (${file.name})`);
  };

  const handleReset = () => {
    setBrokerHoldings([]);
    setBrokerTrades([]);
    setSourceLabel(null);
    setParseWarning(null);
  };

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base">
                CAS ↔ Broker Tradebook Auto-Reconciliation
              </CardTitle>
              <CardDescription>
                Cross-check CAS ISIN quantities & Section 112A cost-basis verification against
                Zerodha / Groww CSVs
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={summary.reconciliationScorePct >= 90 ? 'success' : 'outline'}
              className="font-mono"
            >
              {summary.reconciliationScorePct}% Verified
            </Badge>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold cursor-pointer hover:bg-emerald-400 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Broker CSV</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvUpload}
                className="hidden"
              />
            </label>
            {sourceLabel && (
              <Button size="sm" variant="ghost" onClick={handleReset} className="text-xs">
                Reset
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {parseWarning && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {parseWarning}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {summary.totalMatched} Matched
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <HelpCircle className="w-3.5 h-3.5" />
            {summary.unverifiedCostBasisCount} Unverified Cost Basis
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            {summary.quantityMismatchCount} Qty Mismatch
          </span>
          {sourceLabel && (
            <span className="inline-flex items-center gap-1 text-slate-400 ml-auto">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Comparing against: <strong className="text-slate-200">{sourceLabel}</strong>
            </span>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Asset / ISIN</th>
                <th className="px-3 py-2.5 font-medium text-right">CAS Qty</th>
                <th className="px-3 py-2.5 font-medium text-right">Broker Qty</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Action / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {summary.records.slice(0, 8).map((rec) => (
                <tr key={rec.key} className="hover:bg-secondary/20">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground">{rec.name}</div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {rec.isin || rec.symbol}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{rec.casQuantity}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{rec.brokerQuantity}</td>
                  <td className="px-3 py-2.5">{getStatusBadge(rec.status)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-xs">
                    {rec.recommendation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

