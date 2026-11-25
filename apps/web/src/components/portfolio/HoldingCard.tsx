import { Trash2, TrendingUp, TrendingDown, Minus, Edit2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { usePrivacy } from '@/lib/preferences/privacy-context';
import { HoldingDetailDto } from '@wealthnest/application';

export interface HoldingCardProps {
  holding: HoldingDetailDto & {
    memberName?: string;
    brokerName?: string;
  };
  onEdit?: (holding: HoldingDetailDto) => void;
  onDelete?: (holding: HoldingDetailDto) => void;
  isDeleting?: boolean;
}

function formatShortDate(iso?: string): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (isNaN(ms)) return iso.slice(0, 10);
  return new Date(ms).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function HoldingCard({ holding, onEdit, onDelete, isDeleting = false }: HoldingCardProps) {
  const { maskAmount } = usePrivacy();
  const totalCostCents = Math.round(holding.quantity * holding.unitCostCents);
  const gainLossCents = holding.currentValueCents - totalCostCents;
  const isGain = gainLossCents > 0;
  const isLoss = gainLossCents < 0;
  const returnPct = totalCostCents > 0 ? (gainLossCents / totalCostCents) * 100 : 0;
  const isCostVerified = holding.costBasisVerified ?? true;

  const costBasisFormatted = maskAmount(
    (totalCostCents / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: holding.currency || 'INR',
    })
  );

  const currentValueFormatted = maskAmount(
    (holding.currentValueCents / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: holding.currency || 'INR',
    })
  );

  const gainLossFormatted = maskAmount(
    `${isGain ? '+' : isLoss ? '-' : ''}${(Math.abs(gainLossCents) / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: holding.currency || 'INR',
    })}`
  );

  const updatedLabel = formatShortDate(holding.updatedAt);

  return (
    <div
      data-testid="holding-card"
      className="bg-card border border-border/80 rounded-xl p-4 shadow-sm hover:border-primary/40 transition-all space-y-3"
    >
      {/* Header: Name, Ticker, and Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm text-foreground truncate max-w-[200px]">
              {holding.name}
            </h4>
            {holding.ticker && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                {holding.ticker}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${holding.assetClassColor || '#10b981'}20`,
                color: holding.assetClassColor || '#10b981',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: holding.assetClassColor || '#10b981' }}
              />
              {holding.assetClassName || 'Asset'}
            </span>
            {holding.memberName && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                {holding.memberName}
              </Badge>
            )}
            {holding.brokerName && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {holding.brokerName}
              </span>
            )}
            {updatedLabel && (
              <span className="text-[10px] text-muted-foreground font-mono">
                • {updatedLabel}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 -mr-2 -mt-2">
          {onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEdit(holding)}
              aria-label={`Edit ${holding.name}`}
              className="text-muted-foreground hover:text-primary hover:bg-primary/10 min-h-[44px] min-w-[44px] p-2"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDelete(holding)}
              disabled={isDeleting}
              aria-label={`Delete ${holding.name}`}
              className="text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 min-h-[44px] min-w-[44px] p-2"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Financial Details Grid */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 font-mono text-xs">
        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
            Current Value
          </span>
          <span className="font-bold text-foreground text-sm">{currentValueFormatted}</span>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
            Gain / Loss
          </span>
          {isCostVerified ? (
            <div
              className={`inline-flex items-center gap-1 font-semibold ${
                isGain
                  ? 'text-emerald-400'
                  : isLoss
                    ? 'text-rose-400'
                    : 'text-muted-foreground'
              }`}
            >
              {isGain ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : isLoss ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : (
                <Minus className="w-3.5 h-3.5" />
              )}
              <span>
                {gainLossFormatted} ({isGain ? '+' : ''}
                {returnPct.toFixed(1)}%)
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground text-[11px] italic font-sans">
              Pending txn history
            </span>
          )}
        </div>

        <div>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
            Quantity
          </span>
          <span className="text-foreground">
            {Number(holding.quantity).toLocaleString('en-IN', {
              maximumFractionDigits: 4,
            })}
          </span>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
            Cost Basis
          </span>
          {isCostVerified ? (
            <span className="text-muted-foreground">{costBasisFormatted}</span>
          ) : (
            <button
              type="button"
              onClick={() => onEdit?.(holding)}
              className="text-xs text-emerald-400 font-semibold hover:underline font-sans"
            >
              + Add cost
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
