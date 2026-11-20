import { RefreshCw } from 'lucide-react';

interface SyncingIndicatorProps {
  readonly isSyncing: boolean;
  readonly label?: string;
  readonly className?: string;
}

/**
 * Lightweight non-blocking inline pill indicating background query revalidation.
 */
export function SyncingIndicator({
  isSyncing,
  label = 'Syncing…',
  className = '',
}: SyncingIndicatorProps) {
  if (!isSyncing) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium normal-case tracking-normal bg-primary/10 text-primary border border-primary/20 shrink-0 ${className}`}
    >
      <RefreshCw className="w-2.5 h-2.5 animate-spin shrink-0" />
      <span>{label}</span>
    </span>
  );
}
