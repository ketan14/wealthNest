import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

export interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmActionModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div
      data-testid="confirm-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        className="w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl transform transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile bottom-sheet drag handle */}
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isDanger
                ? 'bg-rose-500/15 text-rose-500 border border-rose-500/20'
                : 'bg-amber-500/15 text-amber-500 border border-amber-500/20'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3
                id="confirm-modal-title"
                className="text-base font-semibold text-foreground leading-tight"
              >
                {title}
              </h3>
              <button
                onClick={onCancel}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            data-testid="cancel-modal-button"
            className="w-full sm:w-auto min-h-[44px]"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isDanger ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isLoading}
            data-testid="confirm-modal-button"
            className="w-full sm:w-auto min-h-[44px]"
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
