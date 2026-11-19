import { useState } from 'react';
import { formatCompactRupees, formatExactRupees } from '@/lib/formatters/currency';
import { usePrivacy } from '@/lib/preferences/privacy-context';

interface CurrencyDisplayProps {
  amount: number;
  className?: string;
  compactDecimals?: number;
  showSign?: boolean;
  prefix?: string;
  suffix?: string;
  isPositiveColor?: boolean;
  allowToggle?: boolean;
}

/**
 * Interactive Currency Component:
 * - Renders compact Indian denominations by default (e.g. ₹1.27Cr, ₹15.05L, ₹22.00K).
 * - Tappable/clickable on mobile touchscreens and desktop to toggle between compact and exact paise precision.
 * - Fully respects the global Privacy Eye toggle (masks as ₹ ••••••).
 */
export function CurrencyDisplay({
  amount,
  className = '',
  compactDecimals = 2,
  showSign = false,
  prefix = '',
  suffix = '',
  isPositiveColor,
  allowToggle = true,
}: CurrencyDisplayProps) {
  const { hideBalances } = usePrivacy();
  const [showExact, setShowExact] = useState(false);

  const formattedCompact = formatCompactRupees(amount, {
    compact: true,
    compactDecimals,
    showSign,
    masked: hideBalances,
  });

  const formattedExact = showSign
    ? `${amount > 0 ? '+' : ''}${formatExactRupees(amount, '₹', hideBalances)}`
    : formatExactRupees(amount, '₹', hideBalances);

  const displayValue = showExact ? formattedExact : formattedCompact;

  const colorClass =
    isPositiveColor !== undefined
      ? isPositiveColor
        ? 'text-emerald-400'
        : 'text-rose-400'
      : '';

  return (
    <span
      role={allowToggle ? 'button' : undefined}
      tabIndex={allowToggle ? 0 : undefined}
      onClick={(e) => {
        if (!allowToggle || hideBalances) return;
        e.stopPropagation();
        setShowExact((prev) => !prev);
      }}
      onKeyDown={(e) => {
        if (!allowToggle || hideBalances) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setShowExact((prev) => !prev);
        }
      }}
      title={hideBalances ? 'Privacy Mode Active' : `Click/Tap to view ${showExact ? 'compact' : 'exact'} amount`}
      className={`font-mono tabular-nums inline-block select-none ${allowToggle && !hideBalances ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''} ${colorClass} ${className}`}
    >
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
}
