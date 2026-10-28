import { createPortal } from 'react-dom';
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

  const modalContent = (
    <div
      data-testid="confirm-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={onCancel}
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-200"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
      }}
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-2xl relative my-auto"
        style={{
          maxWidth: 'min(28rem, calc(100vw - 2rem))',
          width: '100%',
        }}
        onClick={(e) => e.stopPropagation()}
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

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3">
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
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
