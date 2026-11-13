import { HoldingDetailDto } from '@wealthnest/application';
import { CheckCircle2, HelpCircle } from 'lucide-react';
import {
  HoldingActionButtons,
  HoldingEntityBadges,
  MfSubtotals,
  PortfolioAccountRef,
  PortfolioMemberRef,
} from './portfolio-table-shared';

interface MutualFundsHoldingsTableProps {
  readonly mutualFundHoldings: readonly HoldingDetailDto[];
  readonly mfSubtotals: MfSubtotals;
  readonly members: readonly PortfolioMemberRef[];
  readonly accounts: readonly PortfolioAccountRef[];
  readonly currencySymbol: string;
  readonly locale: string;
  readonly deletingId: string | null;
  readonly onEdit: (holding: HoldingDetailDto) => void;
  readonly onDelete: (holding: HoldingDetailDto) => void;
}

/**
 * Renders the Mutual Funds tailored table view with AMC, folio, verified cost basis, and subtotals.
 */
export function MutualFundsHoldingsTable({
  mutualFundHoldings,
  mfSubtotals,
  members,
  accounts,
  currencySymbol,
  locale,
  deletingId,
  onEdit,
  onDelete,
}: MutualFundsHoldingsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-y border-border/80 bg-cyan-500/5 text-muted-foreground">
            <th className="py-3 px-4 font-semibold uppercase tracking-wider">
              Scheme / Fund Name
            </th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider">AMC</th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider">Folio No.</th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider">Plan</th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Units</th>
            <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">NAV</th>
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
          {mutualFundHoldings.length === 0 ? (
            <tr>
              <td colSpan={10} className="py-8 text-center text-muted-foreground font-sans">
                No mutual fund positions match the filter.
              </td>
            </tr>
          ) : (
            mutualFundHoldings.map((h) => {
              const totalCostCents = Math.round(h.quantity * h.unitCostCents);
              const gainLossCents = h.currentValueCents - totalCostCents;
              const isGain = gainLossCents >= 0;
              const returnPct = totalCostCents > 0 ? (gainLossCents / totalCostCents) * 100 : 0;
              const navPerUnit = h.quantity > 0 ? h.currentValueCents / (h.quantity * 100) : 0;

              return (
                <tr key={h.holdingId} className="hover:bg-secondary/30 transition-colors">
                  <td className="py-3.5 px-4 font-sans font-semibold text-foreground">
                    <div>{h.name}</div>
                    {h.isin && (
                      <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                        ISIN: {h.isin}
                      </div>
                    )}
                    <HoldingEntityBadges
                      memberId={h.memberId}
                      accountId={h.accountId}
                      members={members}
                      accounts={accounts}
                    />
                  </td>
                  <td className="py-3.5 px-4 font-sans text-muted-foreground text-[11px]">
                    {h.amcName || '—'}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-cyan-400 font-semibold">
                    {h.folioNumber || '—'}
                  </td>
                  <td className="py-3.5 px-4 font-sans text-muted-foreground text-[11px]">
                    <span className="px-1.5 py-0.5 rounded bg-secondary/80 border border-border">
                      {h.schemePlan || 'Direct'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right text-foreground font-semibold">
                    {h.quantity.toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                  </td>
                  <td className="py-3.5 px-4 text-right text-muted-foreground">
                    {currencySymbol}
                    {navPerUnit.toLocaleString(locale, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {h.costBasisVerified ? (
                      <div>
                        <div className="text-foreground font-semibold">
                          {currencySymbol}
                          {(totalCostCents / 100).toLocaleString(locale, {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-[10px] text-emerald-400 flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Verified</span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="text-muted-foreground">—</span>
                        <div className="text-[10px] text-amber-400/90 flex items-center justify-end gap-1">
                          <HelpCircle className="w-2.5 h-2.5" />
                          <span>Unverified (CAS)</span>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-foreground">
                    {currencySymbol}
                    {(h.currentValueCents / 100).toLocaleString(locale, {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {h.costBasisVerified ? (
                      <>
                        <span
                          className={
                            isGain
                              ? 'text-emerald-400 font-semibold'
                              : 'text-rose-400 font-semibold'
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
                      </>
                    ) : (
                      <span className="text-muted-foreground text-[11px] italic">
                        Pending txn history
                      </span>
                    )}
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
        {mutualFundHoldings.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-border/80 bg-cyan-500/5 font-mono text-xs font-semibold">
              <td colSpan={4} className="py-3 px-4 text-foreground font-sans">
                Subtotal ({mutualFundHoldings.length} Mutual Fund Folios)
              </td>
              <td className="py-3 px-4 text-right text-foreground font-bold">
                {mfSubtotals.totalUnits.toLocaleString('en-IN', {
                  maximumFractionDigits: 3,
                })}
              </td>
              <td className="py-3 px-4"></td>
              <td className="py-3 px-4 text-right text-muted-foreground">
                Verified: {currencySymbol}
                {(mfSubtotals.totalVerifiedCostCents / 100).toLocaleString(locale, {
                  minimumFractionDigits: 2,
                })}
              </td>
              <td className="py-3 px-4 text-right font-bold text-foreground">
                {currencySymbol}
                {(mfSubtotals.totalValueCents / 100).toLocaleString(locale, {
                  minimumFractionDigits: 2,
                })}
              </td>
              <td className="py-3 px-4 text-right">
                <span
                  className={
                    mfSubtotals.verifiedGainLossCents >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }
                >
                  {mfSubtotals.verifiedGainLossCents >= 0 ? '+' : '-'}
                  {currencySymbol}
                  {(Math.abs(mfSubtotals.verifiedGainLossCents) / 100).toLocaleString(locale, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </td>
              <td className="py-3 px-4"></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

