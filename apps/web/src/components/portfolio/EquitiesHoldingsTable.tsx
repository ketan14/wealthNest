import { HoldingDetailDto, MarketQuoteDto } from '@wealthnest/application';
import {
  EquitiesSubtotals,
  HoldingActionButtons,
  HoldingEntityBadges,
  PortfolioAccountRef,
  PortfolioMemberRef,
  findLiveQuote,
} from './portfolio-table-shared';

interface EquitiesHoldingsTableProps {
  readonly equitiesHoldings: readonly HoldingDetailDto[];
  readonly equitiesSubtotals: EquitiesSubtotals;
  readonly members: readonly PortfolioMemberRef[];
  readonly accounts: readonly PortfolioAccountRef[];
  readonly liveQuotesMap: ReadonlyMap<string, MarketQuoteDto>;
  readonly currencySymbol: string;
  readonly locale: string;
  readonly deletingId: string | null;
  readonly onEdit: (holding: HoldingDetailDto) => void;
  readonly onDelete: (holding: HoldingDetailDto) => void;
}

/**
 * Renders the Direct Equities & ETFs tailored table view with live CMP quotes and subtotals.
 */
export function EquitiesHoldingsTable({
  equitiesHoldings,
  equitiesSubtotals,
  members,
  accounts,
  liveQuotesMap,
  currencySymbol,
  locale,
  deletingId,
  onEdit,
  onDelete,
}: EquitiesHoldingsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-y border-border/80 bg-blue-500/5 text-muted-foreground">
            <th className="py-3 px-4 font-semibold uppercase tracking-wider">Security</th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider">Ticker</th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider">ISIN</th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider">Demat Account</th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
              Quantity
            </th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
              Market Price
            </th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Value</th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
              Gain / Loss
            </th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50 font-mono">
          {equitiesHoldings.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-8 text-center text-muted-foreground font-sans">
                No direct equity or ETF holdings match the filter.
              </td>
            </tr>
          ) : (
            equitiesHoldings.map((h) => {
              const totalCostCents = Math.round(h.quantity * h.unitCostCents);
              const gainLossCents = h.currentValueCents - totalCostCents;
              const isGain = gainLossCents >= 0;
              const returnPct = totalCostCents > 0 ? (gainLossCents / totalCostCents) * 100 : 0;
              const marketPricePerShare =
                h.quantity > 0 ? h.currentValueCents / (h.quantity * 100) : 0;
              const q = findLiveQuote(h, liveQuotesMap);
              const price = q ? q.priceCents / 100 : marketPricePerShare;
              const isUp = q ? q.changePercent >= 0 : isGain;

              return (
                <tr key={h.holdingId} className="hover:bg-secondary/30 transition-colors">
                  <td className="py-3.5 px-4 font-sans font-semibold text-foreground">
                    <div>{h.name}</div>
                    <HoldingEntityBadges
                      memberId={h.memberId}
                      accountId={h.accountId}
                      members={members}
                      accounts={accounts}
                    />
                  </td>
                  <td className="py-3.5 px-4">
                    {h.ticker ? (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold">
                        {h.ticker}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground">
                    {h.isin || '—'}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground">
                    {h.dematAccountId || 'Demat Main'}
                  </td>
                  <td className="py-3.5 px-4 text-right text-foreground font-semibold">
                    {h.quantity.toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                  </td>
                  <td className="py-3.5 px-4 text-right text-muted-foreground">
                    <div>
                      <div className="font-bold text-foreground">
                        {currencySymbol}
                        {price.toLocaleString(locale, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      {q && (
                        <div className="flex items-center justify-end gap-1 text-[10px] mt-0.5 font-sans">
                          <span
                            className={`px-1 rounded text-[9px] font-semibold ${
                              isUp
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : 'text-rose-400 bg-rose-500/10'
                            }`}
                          >
                            {isUp ? '+' : ''}
                            {q.changePercent.toFixed(2)}%
                          </span>
                          <span className="font-mono text-[9px] text-blue-400">{q.source}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-foreground">
                    {currencySymbol}
                    {(h.currentValueCents / 100).toLocaleString(locale, {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span
                      className={
                        isGain ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'
                      }
                    >
                      {isGain ? '+' : '-'}
                      {currencySymbol}
                      {(Math.abs(gainLossCents) / 100).toLocaleString(locale, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <div
                      className={`text-[10px] font-medium ${isGain ? 'text-emerald-400/80' : 'text-rose-400/80'}`}
                    >
                      {isGain ? '+' : ''}
                      {returnPct.toFixed(2)}%
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <HoldingActionButtons
                      holding={h}
                      deletingId={deletingId}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        {equitiesHoldings.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-border/80 bg-blue-500/5 font-mono text-xs font-semibold">
              <td colSpan={4} className="py-3 px-4 text-foreground font-sans">
                Subtotal ({equitiesHoldings.length} Equities & ETFs)
              </td>
              <td className="py-3 px-4 text-right text-foreground font-bold">
                {equitiesSubtotals.totalShares.toLocaleString('en-IN', {
                  maximumFractionDigits: 2,
                })}
              </td>
              <td className="py-3 px-4 text-right text-muted-foreground">
                Cost: {currencySymbol}
                {(equitiesSubtotals.totalCostCents / 100).toLocaleString(locale, {
                  minimumFractionDigits: 2,
                })}
              </td>
              <td className="py-3 px-4 text-right font-bold text-foreground">
                {currencySymbol}
                {(equitiesSubtotals.totalValueCents / 100).toLocaleString(locale, {
                  minimumFractionDigits: 2,
                })}
              </td>
              <td className="py-3 px-4 text-right">
                <span
                  className={
                    equitiesSubtotals.gainLossCents >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }
                >
                  {equitiesSubtotals.gainLossCents >= 0 ? '+' : '-'}
                  {currencySymbol}
                  {(Math.abs(equitiesSubtotals.gainLossCents) / 100).toLocaleString(locale, {
                    minimumFractionDigits: 2,
                  })}
                </span>
                <div className="text-[10px] text-muted-foreground">
                  {equitiesSubtotals.gainLossCents >= 0 ? '+' : ''}
                  {equitiesSubtotals.returnPct.toFixed(2)}%
                </div>
              </td>
              <td className="py-3 px-4"></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
