import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';
import { ResponsiveModalShell } from './ResponsiveModalShell';

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
    <ResponsiveModalShell
      portal
      role="dialog"
      ariaLabelledBy="confirm-modal-title"
      testId="confirm-modal"
      onBackdropClick={onCancel}
      backdropClassName="z-[9999] bg-black/80"
      panelClassName="max-w-md bg-card border-border p-4 sm:p-6"
      bodyClassName="pr-0.5"
      footer={
        <div className="mt-5 sm:mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            data-testid="cancel-modal-button"
            className="w-full sm:w-auto min-h-[44px] font-medium"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isDanger ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isLoading}
            data-testid="confirm-modal-button"
            className="w-full sm:w-auto min-h-[44px] font-semibold"
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
            isDanger
              ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
              : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3
              id="confirm-modal-title"
              className="text-base font-semibold text-foreground leading-tight"
            >
              {title}
            </h3>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 -mt-2 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed break-words">
            {message}
          </p>
        </div>
      </div>
    </ResponsiveModalShell>
  );
}
