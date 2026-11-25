import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { SyncingIndicator } from '@/components/ui/SyncingIndicator';
import { cn } from '@/lib/utils';

/**
 * Shared WealthNest visual tokens (Phase 1 Design Foundation).
 * Ensures consistent surface, spacing, typography, and semantic polarity across dashboards.
 */
export const WEALTH_SURFACE =
  'border-border/80 bg-card/60 backdrop-blur-sm shadow-sm rounded-xl';

export const WEALTH_LABEL =
  'text-[11px] uppercase tracking-wider font-semibold text-muted-foreground';

export const WEALTH_KPI_GRID = 'grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4';

export const WEALTH_TONE = {
  positive: {
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  },
  negative: {
    text: 'text-rose-400',
    badge: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  },
  neutral: {
    text: 'text-foreground',
    badge: 'bg-secondary/70 text-muted-foreground border border-border/60',
  },
} as const;

export function getPolarityTone(value: number) {
  if (value > 0) return WEALTH_TONE.positive;
  if (value < 0) return WEALTH_TONE.negative;
  return WEALTH_TONE.neutral;
}

export function getPolarityBool(value: number): boolean | undefined {
  if (value > 0) return true;
  if (value < 0) return false;
  return undefined;
}

export interface KpiMetricCardProps {
  readonly label: string;
  readonly amountRupees?: number;
  readonly displayValue?: React.ReactNode;
  readonly subtext?: string;
  readonly badge?: React.ReactNode;
  readonly icon?: React.ReactNode;
  readonly showSign?: boolean;
  readonly isPositiveColor?: boolean;
  readonly allowToggle?: boolean;
  readonly isSyncing?: boolean;
  readonly className?: string;
}

/**
 * Reusable compact KPI card with standardized label typography, tabular figures,
 * privacy masking via CurrencyDisplay, and subtle revalidation shimmer.
 */
export function KpiMetricCard({
  label,
  amountRupees,
  displayValue,
  subtext,
  badge,
  icon,
  showSign = false,
  isPositiveColor,
  allowToggle = true,
  isSyncing = false,
  className = '',
}: KpiMetricCardProps) {
  const pulseClass = isSyncing
    ? 'opacity-65 animate-pulse transition-opacity duration-200'
    : 'transition-opacity duration-200';

  return (
    <Card className={cn(WEALTH_SURFACE, 'p-3.5 sm:p-4 flex flex-col justify-between', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn(WEALTH_LABEL, 'truncate')}>{label}</span>
        {icon && <span className="shrink-0">{icon}</span>}
      </div>

      <div className={cn('text-lg sm:text-xl font-bold font-mono tabular-nums tracking-tight mt-1.5', pulseClass)}>
        {amountRupees !== undefined ? (
          <CurrencyDisplay
            amount={amountRupees}
            showSign={showSign}
            isPositiveColor={isPositiveColor}
            allowToggle={allowToggle}
          />
        ) : (
          displayValue
        )}
      </div>

      {(subtext || badge) && (
        <div className="flex items-center justify-between gap-1.5 mt-1.5 min-h-[18px]">
          {subtext ? (
            <span className="text-[11px] text-muted-foreground truncate">{subtext}</span>
          ) : (
            <span />
          )}
          {badge && <span className="shrink-0">{badge}</span>}
        </div>
      )}
    </Card>
  );
}

export interface HeroSummaryCardProps {
  readonly title: string;
  readonly amountRupees: number;
  readonly headerActions?: React.ReactNode;
  readonly badges?: React.ReactNode;
  readonly metaRow?: React.ReactNode;
  readonly children?: React.ReactNode;
  readonly isSyncing?: boolean;
  readonly allowToggle?: boolean;
  readonly isPositiveColor?: boolean;
  readonly className?: string;
}

/**
 * Reusable executive summary hero shell shared across System Overview, Portfolio, and module dashboards.
 */
export function HeroSummaryCard({
  title,
  amountRupees,
  headerActions,
  badges,
  metaRow,
  children,
  isSyncing = false,
  allowToggle = true,
  isPositiveColor,
  className = '',
}: HeroSummaryCardProps) {
  const pulseClass = isSyncing
    ? 'opacity-65 animate-pulse transition-opacity duration-200'
    : 'transition-opacity duration-200';

  return (
    <Card className={cn(WEALTH_SURFACE, 'relative overflow-hidden', className)}>
      <CardHeader className="pb-3 p-4 sm:p-6 sm:pb-3">
        <div className="flex items-center justify-between gap-2 text-muted-foreground text-xs uppercase font-semibold">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate">{title}</span>
            <SyncingIndicator isSyncing={isSyncing} />
          </div>
          {headerActions && <div className="flex items-center gap-1.5 shrink-0">{headerActions}</div>}
        </div>

        <div className="pt-1">
          <div
            className={cn(
              'text-3xl sm:text-4xl font-extrabold font-mono tabular-nums tracking-tight text-foreground',
              pulseClass
            )}
          >
            <CurrencyDisplay
              amount={amountRupees}
              isPositiveColor={isPositiveColor}
              allowToggle={allowToggle}
              className="text-3xl sm:text-4xl font-extrabold"
            />
          </div>

          {badges && <div className="flex items-center gap-2 mt-2.5 flex-wrap">{badges}</div>}
          {metaRow && (
            <div className="flex items-center justify-between gap-2 mt-2.5 flex-wrap text-[11px] text-muted-foreground">
              {metaRow}
            </div>
          )}
        </div>
      </CardHeader>

      {children && (
        <CardContent className="p-4 pt-3 sm:p-6 sm:pt-3 border-t border-border/50">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
