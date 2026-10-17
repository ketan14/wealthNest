import { Loader2 } from 'lucide-react';

export function LoadingPage() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-muted-foreground"
    >
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <span className="text-sm font-medium">Loading WealthNest shell...</span>
    </div>
  );
}
