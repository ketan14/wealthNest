import { cn } from '@/lib/utils';

export interface EntityChipMember {
  readonly id: string;
  readonly name: string;
  readonly colorHex?: string;
}

interface EntitySelectorChipsProps {
  readonly members: readonly EntityChipMember[];
  readonly selectedMemberId: string | 'all';
  readonly onSelectMember: (memberId: string | 'all') => void;
  readonly onOpenManage?: () => void;
  readonly showMobileHeader?: boolean;
  readonly badgeLabel?: string;
  readonly className?: string;
}

/**
 * Shared horizontally scrollable family / legal entity selector strip.
 * Used across Home Overview, Portfolio, and Liabilities for uniform touch ergonomics.
 */
export function EntitySelectorChips({
  members,
  selectedMemberId,
  onSelectMember,
  onOpenManage,
  showMobileHeader = true,
  badgeLabel = 'Household',
  className = '',
}: EntitySelectorChipsProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {showMobileHeader && (
        <div className="flex items-center justify-between text-xs text-muted-foreground sm:hidden">
          <span className="font-semibold uppercase tracking-wider text-slate-400 text-[11px]">
            My Family
          </span>
          {onOpenManage ? (
            <button
              type="button"
              onClick={onOpenManage}
              className="text-[11px] font-medium text-primary hover:underline touch-manipulation"
            >
              Manage
            </button>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] border border-border/60">
              {badgeLabel}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain no-scrollbar py-0.5">
        <button
          type="button"
          onClick={() => onSelectMember('all')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 touch-manipulation active:scale-[0.98]',
            selectedMemberId === 'all'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-secondary/60 text-muted-foreground hover:bg-secondary border border-border/60'
          )}
        >
          All Members
        </button>

        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelectMember(m.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 inline-flex items-center gap-1.5 touch-manipulation active:scale-[0.98]',
              selectedMemberId === m.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary/60 text-muted-foreground hover:bg-secondary border border-border/60'
            )}
          >
            {m.colorHex && (
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: m.colorHex }}
              />
            )}
            <span>{m.name}</span>
          </button>
        ))}

        {onOpenManage && (
          <button
            type="button"
            onClick={onOpenManage}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/40 hover:bg-secondary border border-border/60 whitespace-nowrap shrink-0 transition-colors"
            title="Manage Family Entities & Accounts"
          >
            <span>+ Manage</span>
          </button>
        )}
      </div>
    </div>
  );
}
