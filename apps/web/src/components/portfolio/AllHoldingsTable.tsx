import { useState, useEffect } from 'react';
import { HoldingDetailDto, MarketQuoteDto } from '@wealthnest/application';
import { HoldingCard } from '@/components/portfolio/HoldingCard';
import { Button } from '@/components/ui/Button';
import { usePrivacy } from '@/lib/preferences/privacy-context';
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

const PAGE_SIZE = 25;

function formatHoldingDate(iso?: string): string {
  if (!iso) return '—';
  const parsed = Date.parse(iso);
  if (isNaN(parsed)) return iso.slice(0, 10);
  return new Date(parsed).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Phase 3C Consolidated Holdings View (mobile cards or desktop table):
 * - Columns: Investment, Owner, Quantity, Invested Value (Cost Basis), Current Value, Gain/Loss, Last Updated, Action.
 * - Full Privacy Mode masking via usePrivacy().maskAmount.
 * - Automatic pagination when > 25 positions.
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
  const { maskAmount } = usePrivacy();
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(filteredHoldings.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [filteredHoldings.length, page, totalPages]);

  const pagedHoldings =
    filteredHoldings.length > PAGE_SIZE
      ? filteredHoldings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      : filteredHoldings;

  const paginationControls =
    filteredHoldings.length > PAGE_SIZE ? (
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 text-xs text-muted-foreground">
        <span>
          Showing {(page - 1) * PAGE_SIZE + 1}–
          {Math.min(page * PAGE_SIZE, filteredHoldings.length)} of {filteredHoldings.length}{' '}
          holdings
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-7 px-2.5 text-xs"
          >
            Previous
          </Button>
          <span className="font-mono">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="h-7 px-2.5 text-xs"
          >
            Next
          </Button>
        </div>
      </div>
    ) : null;

  if (isMobile) {
    return (
      <div>
        <div className="space-y-3 p-4">
          {pagedHoldings.map((h) => {
            const mem = members.find((m) => m.id === (h.memberId || 'mem-self'));
            const acc = accounts.find((a) => a.id === h.accountId);
            return (
              <HoldingCard
                key={h.holdingId}
                holding={{
                  ...h,
                  memberName: mem?.name,
                  brokerName: acc?.brokerName,
                }}
                onEdit={onEdit}
                onDelete={() => onDelete(h)}
                isDeleting={deletingId === h.holdingId}
              />
            );
          })}
        </div>
        {paginationControls}
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-y border-border/80 bg-secondary/20 text-muted-foreground">
              <th className="py-3 px-4 font-semibold uppercase tracking-wider">
                Investment / Ticker
              </th>
              <th className="py-3 px-4 font-semibold uppercase tracking-wider hidden md:table-cell">
                Owner
              </th>
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
              <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right hidden xl:table-cell">
                Last Updated
              </th>
              <th className="py-3 px-4 font-semibold uppercase tracking-wider text-center">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 font-mono">
            {pagedHoldings.map((h) => {
              const totalCostCents = Math.round(h.quantity * h.unitCostCents);
              const gainLossCents = h.currentValueCents - totalCostCents;
              const isGain = gainLossCents > 0;
              const isLoss = gainLossCents < 0;
              const returnPct = totalCostCents > 0 ? (gainLossCents / totalCostCents) * 100 : 0;

              const costBasisFormatted = maskAmount(
                (totalCostCents / 100).toLocaleString('en-IN', {
                  style: 'currency',
                  currency: h.currency || 'INR',
                })
              );
              const currentValueFormatted = maskAmount(
                (h.currentValueCents / 100).toLocaleString('en-IN', {
                  style: 'currency',
                  currency: h.currency || 'INR',
                })
              );
              const gainLossFormatted = maskAmount(
                `${isGain ? '+' : isLoss ? '-' : ''}${(Math.abs(gainLossCents) / 100).toLocaleString(
                  'en-IN',
                  {
                    style: 'currency',
                    currency: h.currency || 'INR',
                  }
                )}`
              );
              const unitCostFormatted = maskAmount(
                `${currencySymbol}${(h.unitCostCents / 100).toLocaleString(locale, {
                  minimumFractionDigits: 2,
                })}`
              );
              const q = findLiveQuote(h, liveQuotesMap);

              return (
                <tr key={h.holdingId} className="hover:bg-secondary/30 transition-colors">
                  {/* Investment, Ticker & Category Pill */}
                  <td className="py-3.5 px-4 font-sans">
                    <div className="font-semibold text-foreground text-sm flex items-center gap-2 flex-wrap">
                      <span>{h.name}</span>
                      {h.ticker && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary/80 border border-border text-primary font-bold">
                          {h.ticker}
                        </span>
                      )}
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-medium border"
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
                    </div>
                    {h.folioNumber && (
                      <div className="font-mono text-[10px] text-cyan-400 mt-0.5">
                        Folio: {h.folioNumber} {h.schemePlan ? `• ${h.schemePlan}` : ''}
                      </div>
                    )}
                    <div className="md:hidden">
                      <HoldingEntityBadges
                        memberId={h.memberId}
                        accountId={h.accountId}
                        members={members}
                        accounts={accounts}
                      />
                    </div>
                  </td>

                  {/* Dedicated Owner & Account Column */}
                  <td className="py-3.5 px-4 font-sans hidden md:table-cell">
                    <HoldingEntityBadges
                      memberId={h.memberId}
                      accountId={h.accountId}
                      members={members}
                      accounts={accounts}
                    />
                  </td>

                  {/* Quantity */}
                  <td className="py-3.5 px-4 text-right text-foreground">
                    {h.quantity.toLocaleString('en-IN', { maximumFractionDigits: 6 })}
                  </td>

                  {/* Invested Value / Cost Basis */}
                  <td className="py-3.5 px-4 text-right text-muted-foreground">
                    {(h.costBasisVerified ?? true) ? (
                      <>
                        <div>{costBasisFormatted}</div>
                        <div className="text-[10px] text-muted-foreground/80">
                          {unitCostFormatted}/u
                        </div>
                      </>
                    ) : (
                      <div>
                        <button
                          type="button"
                          onClick={() => onEdit(h)}
                          className="text-xs text-emerald-400 font-semibold hover:underline flex items-center justify-end gap-1 ml-auto"
                          title="Enter purchase price or NAV"
                        >
                          <span>Missing cost</span>
                          <span className="text-[10px] bg-emerald-500/15 px-1 py-0.2 rounded border border-emerald-500/30">
                            + Add
                          </span>
                        </button>
                        <div className="text-[10px] text-amber-400/80">Unverified in CAS</div>
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
                          {maskAmount(
                            `${currencySymbol}${(q.priceCents / 100).toLocaleString(locale, {
                              minimumFractionDigits: 2,
                            })}`
                          )}
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
                              : isLoss
                                ? 'text-rose-400 font-semibold'
                                : 'text-foreground font-semibold'
                          }
                        >
                          {gainLossFormatted}
                        </span>
                        <div
                          className={`text-[10px] font-medium ${
                            isGain
                              ? 'text-emerald-400/80'
                              : isLoss
                                ? 'text-rose-400/80'
                                : 'text-muted-foreground'
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

                  {/* Last Updated */}
                  <td className="py-3.5 px-4 text-right text-muted-foreground text-[11px] hidden xl:table-cell">
                    {formatHoldingDate(h.updatedAt)}
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
      {paginationControls}
    </div>
  );
}
