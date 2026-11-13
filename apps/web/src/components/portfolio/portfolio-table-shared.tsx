import { HoldingDetailDto, MarketQuoteDto } from '@wealthnest/application';
import { Edit2, Loader2, Trash2 } from 'lucide-react';

export interface PortfolioMemberRef {
  readonly id: string;
  readonly name: string;
  readonly relationship: string;
  readonly colorHex: string;
}

export interface PortfolioAccountRef {
  readonly id: string;
  readonly brokerName: string;
}

export interface GroupedHoldingBucket {
  readonly classId: string;
  readonly meta: { readonly name: string; readonly color: string };
  readonly holdings: HoldingDetailDto[];
  totalValueCents: number;
  totalCostCents: number;
}

export interface EquitiesSubtotals {
  readonly totalShares: number;
  readonly totalValueCents: number;
  readonly totalCostCents: number;
  readonly gainLossCents: number;
  readonly returnPct: number;
}

export interface MfSubtotals {
  readonly totalUnits: number;
  readonly totalValueCents: number;
  readonly totalVerifiedCostCents: number;
  readonly verifiedGainLossCents: number;
  readonly verifiedReturnPct: number;
}

export function findLiveQuote(
  holding: HoldingDetailDto,
  liveQuotesMap: ReadonlyMap<string, MarketQuoteDto>
): MarketQuoteDto | undefined {
  return (
    (holding.isin ? liveQuotesMap.get(holding.isin) : undefined) ||
    (holding.ticker ? liveQuotesMap.get(holding.ticker) : undefined) ||
    liveQuotesMap.get(holding.holdingId)
  );
}

/**
 * Renders household member and broker/demat account badges for a holding row.
 */
export function HoldingEntityBadges({
  memberId,
  accountId,
  members,
  accounts,
}: {
  readonly memberId?: string | null;
  readonly accountId?: string | null;
  readonly members: readonly PortfolioMemberRef[];
  readonly accounts: readonly PortfolioAccountRef[];
}) {
  const mem = members.find((m) => m.id === (memberId || 'mem-self'));
  const acc = accounts.find((a) => a.id === accountId);

  if (!mem && !acc) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1 font-sans">
      {mem && (
        <span
          className="text-[10px] px-1.5 py-0.2 rounded font-medium flex items-center gap-1"
          style={{
            backgroundColor: `${mem.colorHex}22`,
            border: `1px solid ${mem.colorHex}55`,
            color: mem.colorHex,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: mem.colorHex }} />
          {mem.name.split(' ')[0]} {mem.relationship === 'huf' ? 'HUF' : ''}
        </span>
      )}
      {acc && (
        <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground font-mono border border-border">
          {acc.brokerName}
        </span>
      )}
    </div>
  );
}

/**
 * Renders accessible Edit and Delete action buttons for a holding row.
 */
export function HoldingActionButtons({
  holding,
  deletingId,
  onEdit,
  onDelete,
}: {
  readonly holding: HoldingDetailDto;
  readonly deletingId: string | null;
  readonly onEdit: (holding: HoldingDetailDto) => void;
  readonly onDelete: (holding: HoldingDetailDto) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => onEdit(holding)}
        title="Edit / Update Valuation"
        className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <Edit2 className="w-3.5 h-3.5" />
      </button>
      <button
        disabled={deletingId === holding.holdingId}
        onClick={() => onDelete(holding)}
        title="Delete Position"
        className="p-1.5 rounded-md text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        {deletingId === holding.holdingId ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
