import { HoldingDetailDto, MarketQuoteDto } from '@wealthnest/application';
import { HoldingCard } from '@/components/portfolio/HoldingCard';
import {
  HoldingActionButtons,
  HoldingEntityBadges,
  PortfolioAccountRef,
  PortfolioMemberRef,
  findLiveQuote,
} from './portfolio-table-shared';

interface AllHoldingsTableProps {
  readonly filteredHoldings: readonly HoldingDetailDto[];
  readonly isMobile: boolean;
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
 * Renders the consolidated All Investments view (mobile card list or desktop dense table).
 */
export function AllHoldingsTable({
  filteredHoldings,
  isMobile,
  members,
  accounts,
  liveQuotesMap,
  currencySymbol,
  locale,
  deletingId,
  onEdit,
  onDelete,
}: AllHoldingsTableProps) {
  if (isMobile) {
    return (
      <div className="space-y-3 p-4">
        {filteredHoldings.map((h) => (
          <HoldingCard
            key={h.holdingId}
            holding={h}
            onEdit={onEdit}
            onDelete={() => onDelete(h)}
            isDeleting={deletingId === h.holdingId}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-y border-border/80 bg-secondary/20 text-muted-foreground">
            <th className="py-3 px-4 font-semibold uppercase tracking-wider">Asset / Ticker</th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider">Class</th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
              Quantity
            </th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
              Cost Basis
            </th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
              Current Value
            </th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
              Gain / Loss
            </th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50 font-mono">
          {filteredHoldings.map((h) => {
            const totalCostCents = Math.round(h.quantity * h.unitCostCents);
            const gainLossCents = h.currentValueCents - totalCostCents;
            const isGain = gainLossCents >= 0;
            const returnPct = totalCostCents > 0 ? (gainLossCents / totalCostCents) * 100 : 0;

            const costBasisFormatted = (totalCostCents / 100).toLocaleString('en-IN', {
              style: 'currency',
              currency: h.currency || 'INR',
            });
            const currentValueFormatted = (h.currentValueCents / 100).toLocaleString('en-IN', {
              style: 'currency',
              currency: h.currency || 'INR',
            });
            const gainLossFormatted = (Math.abs(gainLossCents) / 100).toLocaleString('en-IN', {
              style: 'currency',
              currency: h.currency || 'INR',
            });
            const q = findLiveQuote(h, liveQuotesMap);

            return (
              <tr key={h.holdingId} className="hover:bg-secondary/30 transition-colors">
                {/* Name & Ticker */}
                <td className="py-3.5 px-4 font-sans">
                  <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                    {h.name}
                    {h.ticker && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary/80 border border-border text-primary font-bold">
                        {h.ticker}
                      </span>
                    )}
                  </div>
                  {h.folioNumber && (
                    <div className="font-mono text-[10px] text-cyan-400 mt-0.5">
                      Folio: {h.folioNumber} {h.schemePlan ? `• ${h.schemePlan}` : ''}
                    </div>
                  )}
                  <HoldingEntityBadges
                    memberId={h.memberId}
                    accountId={h.accountId}
                    members={members}
                    accounts={accounts}
                  />
                </td>

                {/* Asset Class */}
                <td className="py-3.5 px-4 font-sans">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border"
                    style={{
                      borderColor: `${h.assetClassColor}40`,
                      backgroundColor: `${h.assetClassColor}15`,
                      color: h.assetClassColor,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: h.assetClassColor }}
                    />
                    {h.assetClassName}
                  </span>
                </td>

                {/* Quantity */}
                <td className="py-3.5 px-4 text-right text-foreground">
                  {h.quantity.toLocaleString('en-IN', { maximumFractionDigits: 6 })}
                </td>

                {/* Cost Basis */}
                <td className="py-3.5 px-4 text-right text-muted-foreground">
                  {(h.costBasisVerified ?? true) ? (
                    <>
                      <div>{costBasisFormatted}</div>
                      <div className="text-[10px] text-muted-foreground/80">
                        {currencySymbol}
                        {(h.unitCostCents / 100).toLocaleString(locale, {
                          minimumFractionDigits: 2,
                        })}
                        /u
                      </div>
                    </>
                  ) : (
                    <div>
                      <span>—</span>
                      <div className="text-[10px] text-amber-400">Unverified in CAS</div>
                    </div>
                  )}
                </td>

                {/* Current Value / CMP */}
                <td className="py-3.5 px-4 text-right font-bold text-foreground">
                  <div>{currentValueFormatted}</div>
                  {q && (
                    <div className="flex items-center justify-end gap-1 text-[10px] mt-0.5 font-normal">
                      <span className="text-muted-foreground font-mono">
                        {q.source === 'NSE' || q.source === 'BSE' ? 'CMP: ' : 'NAV: '}
                        {currencySymbol}
                        {(q.priceCents / 100).toLocaleString(locale, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <span
                        className={`px-1 py-0.2 rounded font-semibold text-[9px] ${
                          q.changePercent >= 0
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-rose-400 bg-rose-500/10'
                        }`}
                      >
                        {q.changePercent >= 0 ? '+' : ''}
                        {q.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </td>

                {/* Gain / Loss */}
                <td className="py-3.5 px-4 text-right">
                  {(h.costBasisVerified ?? true) ? (
                    <>
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
                    </>
                  ) : (
                    <span className="text-muted-foreground text-[11px] italic">
                      Pending txn history
                    </span>
                  )}
                </td>

                {/* Edit & Delete Action */}
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
          })}
        </tbody>
      </table>
    </div>
  );
}

