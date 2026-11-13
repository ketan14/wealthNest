import { HoldingDetailDto } from '@wealthnest/application';
import { Badge } from '@/components/ui/Badge';
import { GroupedHoldingBucket, HoldingActionButtons } from './portfolio-table-shared';

interface GroupedHoldingsViewProps {
  readonly groupedHoldings: readonly GroupedHoldingBucket[];
  readonly currencySymbol: string;
  readonly locale: string;
  readonly deletingId: string | null;
  readonly onEdit: (holding: HoldingDetailDto) => void;
  readonly onDelete: (holding: HoldingDetailDto) => void;
}

/**
 * Renders portfolio holdings grouped into collapsible-style asset-class cards with subtotals.
 */
export function GroupedHoldingsView({
  groupedHoldings,
  currencySymbol,
  locale,
  deletingId,
  onEdit,
  onDelete,
}: GroupedHoldingsViewProps) {
  return (
    <div className="p-4 space-y-6">
      {groupedHoldings.map((grp) => {
        const grpGainLossCents = grp.totalValueCents - grp.totalCostCents;
        const isGrpGain = grpGainLossCents >= 0;
        const grpGainLossFormatted = (Math.abs(grpGainLossCents) / 100).toLocaleString('en-IN', {
          style: 'currency',
          currency: 'INR',
        });
        const grpCostFormatted = (grp.totalCostCents / 100).toLocaleString('en-IN', {
          style: 'currency',
          currency: 'INR',
        });
        const grpValueFormatted = (grp.totalValueCents / 100).toLocaleString('en-IN', {
          style: 'currency',
          currency: 'INR',
        });
        const grpReturnPct =
          grp.totalCostCents > 0 ? (grpGainLossCents / grp.totalCostCents) * 100 : 0;

        return (
          <div
            key={grp.classId}
            className="rounded-xl border border-border/80 bg-background/50 overflow-hidden shadow-xs"
          >
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-secondary/30 border-b border-border/60 gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: grp.meta.color }}
                />
                <h3 className="font-semibold text-sm text-foreground">{grp.meta.name}</h3>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {grp.holdings.length} {grp.holdings.length === 1 ? 'position' : 'positions'}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono">
                <span className="text-muted-foreground">
                  Cost: <span className="text-foreground">{grpCostFormatted}</span>
                </span>
                <span className="text-muted-foreground">
                  Value: <span className="font-bold text-foreground">{grpValueFormatted}</span>
                </span>
                <span
                  className={
                    isGrpGain ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'
                  }
                >
                  {isGrpGain ? '+' : '-'}
                  {grpGainLossFormatted} ({isGrpGain ? '+' : ''}
                  {grpReturnPct.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* Section Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-secondary/15 text-muted-foreground">
                    <th className="py-2.5 px-4 font-semibold uppercase tracking-wider">
                      Asset / Ticker
                    </th>
                    <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">
                      Quantity
                    </th>
                    <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">
                      Cost Basis
                    </th>
                    <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">
                      Current Value
                    </th>
                    <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">
                      Gain / Loss
                    </th>
                    <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-center">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {grp.holdings.map((h) => {
                    const totalCostCents = Math.round(h.quantity * h.unitCostCents);
                    const gainLossCents = h.currentValueCents - totalCostCents;
                    const isGain = gainLossCents >= 0;
                    const returnPct =
                      totalCostCents > 0 ? (gainLossCents / totalCostCents) * 100 : 0;

                    const costBasisFormatted = (totalCostCents / 100).toLocaleString('en-IN', {
                      style: 'currency',
                      currency: h.currency || 'INR',
                    });
                    const currentValueFormatted = (h.currentValueCents / 100).toLocaleString(
                      'en-IN',
                      {
                        style: 'currency',
                        currency: h.currency || 'INR',
                      }
                    );
                    const gainLossFormatted = (Math.abs(gainLossCents) / 100).toLocaleString(
                      'en-IN',
                      {
                        style: 'currency',
                        currency: h.currency || 'INR',
                      }
                    );

                    return (
                      <tr key={h.holdingId} className="hover:bg-secondary/20 transition-colors">
                        <td className="py-3 px-4 font-sans">
                          <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                            {h.name}
                            {h.ticker && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary/80 border border-border text-primary font-bold">
                                {h.ticker}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-foreground">
                          {h.quantity.toLocaleString('en-IN', { maximumFractionDigits: 6 })}
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground">
                          <div>{costBasisFormatted}</div>
                          <div className="text-[10px] text-muted-foreground/80">
                            {currencySymbol}
                            {(h.unitCostCents / 100).toLocaleString(locale, {
                              minimumFractionDigits: 2,
                            })}
                            /u
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-foreground">
                          {currentValueFormatted}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={
                              isGain
                                ? 'text-emerald-400 font-semibold'
                                : 'text-rose-400 font-semibold'
                            }
                          >
                            {isGain ? '+' : '-'}
                            {gainLossFormatted}
                          </span>
                          <div
                            className={`text-[10px] font-medium ${
                              isGain ? 'text-emerald-400/80' : 'text-rose-400/80'
                            }`}
                          >
                            {isGain ? '+' : ''}
                            {returnPct.toFixed(2)}%
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <HoldingActionButtons
                            holding={h}
                            deletingId={deletingId}
                            onEdit={onEdit}
                            onDelete={onDelete}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border/70 bg-secondary/25 font-mono text-xs font-semibold">
                    <td className="py-2.5 px-4 text-foreground font-sans">
                      Subtotal ({grp.meta.name})
                    </td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">
                      {grp.holdings
                        .reduce((sum, item) => sum + item.quantity, 0)
                        .toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">
                      {grpCostFormatted}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-foreground">
                      {grpValueFormatted}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <span className={isGrpGain ? 'text-emerald-400' : 'text-rose-400'}>
                        {isGrpGain ? '+' : '-'}
                        {grpGainLossFormatted}
                      </span>
                    </td>
                    <td className="py-2.5 px-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

