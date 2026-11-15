import type { FormHTMLAttributes, KeyboardEventHandler, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface ResponsiveModalShellProps {
  /** Mount overlay into document.body via React portal. */
  portal?: boolean;
  /** Backdrop alignment preset: centered dialog, mobile bottom sheet, or top palette. */
  variant?: 'center' | 'sheet' | 'top';
  /** Extra classes merged onto the backdrop wrapper (e.g. z-index, opacity, responsive visibility). */
  backdropClassName?: string;
  /** Extra classes merged onto the modal panel (e.g. max-w-lg, surface colors, border). */
  panelClassName?: string;
  /** Optional handler invoked when clicking outside the modal panel. */
  onBackdropClick?: () => void;
  /** Optional keyboard handler attached to the modal panel. */
  onPanelKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  role?: 'dialog' | 'alertdialog';
  ariaLabel?: string;
  ariaLabelledBy?: string;
  testId?: string;
  /** Optional non-scrolling header slot. */
  header?: ReactNode;
  /** Optional non-scrolling secondary header slot (such as modal tabs). */
  subHeader?: ReactNode;
  /** Extra classes merged onto the body container inside the modal. */
  bodyClassName?: string;
  /** Set false when child steps manage their own scroll containers and sticky footers. */
  scrollableBody?: boolean;
  /** Wraps scrollable body and pinned footer inside a single HTML form when supplied. */
  formProps?: FormHTMLAttributes<HTMLFormElement>;
  /** Optional non-scrolling footer slot pinned below the scrollable body. */
  footer?: ReactNode;
  /** Extra classes merged onto the footer wrapper. */
  footerClassName?: string;
  children: ReactNode;
}

const VARIANT_BACKDROP_CLASSES: Record<
  NonNullable<ResponsiveModalShellProps['variant']>,
  string
> = {
  center: 'items-center p-3 sm:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4',
  sheet: 'items-end sm:items-center p-0 sm:p-4',
  top: 'items-start pt-6 sm:pt-[12dvh] p-3 sm:p-4',
};

const VARIANT_PANEL_CLASSES: Record<
  NonNullable<ResponsiveModalShellProps['variant']>,
  string
> = {
  center: 'rounded-2xl max-h-[90dvh]',
  sheet: 'rounded-t-2xl sm:rounded-2xl max-h-[90dvh] pb-[env(safe-area-inset-bottom)] sm:pb-0',
  top: 'rounded-2xl max-h-[82dvh]',
};

/**
 * Standardized responsive modal/sheet layout container enforcing dynamic viewport
 * height bounds (dvh), independent middle-body scrolling, overscroll containment,
 * non-shrinking headers/footers, and Android gesture safe-area spacing.
 */
export function ResponsiveModalShell({
  portal = false,
  variant = 'center',
  backdropClassName,
  panelClassName,
  onBackdropClick,
  onPanelKeyDown,
  role,
  ariaLabel,
  ariaLabelledBy,
  testId,
  header,
  subHeader,
  bodyClassName,
  scrollableBody = true,
  formProps,
  footer,
  footerClassName,
  children,
}: ResponsiveModalShellProps) {
  const innerContent = (
    <>
      <div
        className={cn(
          scrollableBody
            ? 'flex-1 min-h-0 overflow-y-auto overscroll-contain'
            : 'flex-1 min-h-0 flex flex-col overflow-hidden',
          bodyClassName
        )}
      >
        {children}
      </div>
      {footer ? <div className={cn('shrink-0', footerClassName)}>{footer}</div> : null}
    </>
  );

  const modalNode = (
    <div
      role={role}
      aria-modal={role ? 'true' : undefined}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      data-testid={testId}
      onClick={onBackdropClick}
      className={cn(
        'fixed inset-0 z-50 flex justify-center overscroll-contain bg-black/75 backdrop-blur-sm animate-in fade-in duration-200',
        VARIANT_BACKDROP_CLASSES[variant],
        backdropClassName
      )}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onPanelKeyDown}
        className={cn(
          'relative w-full max-w-lg border border-border bg-card shadow-2xl flex flex-col overflow-hidden',
          VARIANT_PANEL_CLASSES[variant],
          panelClassName
        )}
      >
        {header ? <div className="shrink-0">{header}</div> : null}
        {subHeader ? <div className="shrink-0">{subHeader}</div> : null}
        {formProps ? (
          <form
            {...formProps}
            className={cn('flex-1 min-h-0 flex flex-col overflow-hidden', formProps.className)}
          >
            {innerContent}
          </form>
        ) : (
          innerContent
        )}
      </div>
    </div>
  );

  if (portal && typeof document !== 'undefined') {
    return createPortal(modalNode, document.body);
  }

  return modalNode;
}
