import { Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TransactionType, isInflow } from '@wealthnest/domain';
import { TransactionDetailDto } from '@wealthnest/application';

export interface TransactionCardProps {
  transaction: TransactionDetailDto & {
    taxCategory?: string;
  };
  onDelete?: (transaction: TransactionDetailDto) => void;
  isDeleting?: boolean;
}

const typeBadgeStyles: Record<
  TransactionType,
  { bg: string; text: string; label: string }
> = {
  deposit: {
    bg: 'bg-emerald-500/15 border-emerald-500/30',
    text: 'text-emerald-400',
    label: 'Deposit',
  },
  dividend: {
    bg: 'bg-emerald-500/15 border-emerald-500/30',
    text: 'text-emerald-400',
    label: 'Dividend',
  },
  sell: {
    bg: 'bg-teal-500/15 border-teal-500/30',
    text: 'text-teal-400',
    label: 'Sell',
  },
  buy: {
    bg: 'bg-blue-500/15 border-blue-500/30',
    text: 'text-blue-400',
    label: 'Buy',
  },
  withdrawal: {
    bg: 'bg-rose-500/15 border-rose-500/30',
    text: 'text-rose-400',
    label: 'Withdrawal',
  },
  fee: {
    bg: 'bg-amber-500/15 border-amber-500/30',
    text: 'text-amber-400',
    label: 'Fee',
  },
};


export function TransactionCard({
  transaction,
  onDelete,
  isDeleting = false,
}: TransactionCardProps) {
  const isTxInflow = isInflow(transaction.type);
  const badgeStyle = typeBadgeStyles[transaction.type] || {
    bg: 'bg-secondary',
    text: 'text-foreground',
    label: transaction.type,
  };

  const formattedDate = new Date(transaction.transactionDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const formattedAmount = (transaction.amountCents / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: transaction.currency || 'INR',
  });

  return (
    <div
      data-testid="transaction-card"
      className="bg-card border border-border/80 rounded-xl p-4 shadow-sm hover:border-primary/40 transition-all space-y-2.5"
    >
      {/* Top row: Type badge, Date, and Delete button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeStyle.bg} ${badgeStyle.text}`}
          >
            {isTxInflow ? (
              <ArrowDownLeft className="w-3 h-3" />
            ) : (
              <ArrowUpRight className="w-3 h-3" />
            )}
            {badgeStyle.label}
          </span>
          <span className="text-xs text-muted-foreground font-mono">{formattedDate}</span>
        </div>

        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(transaction)}
            disabled={isDeleting}
            aria-label={`Delete transaction ${transaction.id}`}
            className="text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 min-h-[44px] min-w-[44px] p-2 shrink-0 -mr-2 -my-2"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Main info: Asset name/notes & Amount */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground truncate">
            {transaction.assetName || transaction.notes || 'Unspecified Asset'}
          </p>
          {transaction.quantity != null && transaction.quantity > 0 && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              Qty:{' '}
              {Number(transaction.quantity).toLocaleString('en-IN', {
                maximumFractionDigits: 4,
              })}
            </p>
          )}
        </div>

        <div className="text-right shrink-0">
          <span
            className={`font-mono text-sm font-bold ${
              isTxInflow ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isTxInflow ? '+' : '-'}
            {formattedAmount}
          </span>
        </div>
      </div>

      {/* Bottom metadata: notes & tags */}
      {transaction.notes && (
        <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate max-w-[260px] italic">{transaction.notes}</span>
          {transaction.taxCategory && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0">
              {transaction.taxCategory}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
