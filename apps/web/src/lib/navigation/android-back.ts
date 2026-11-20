export type BackDismissHandler = () => boolean | void;

const backDismissStack: BackDismissHandler[] = [];

/**
 * Registers a LIFO back-dismiss handler for an open modal, drawer, or sheet.
 * Returns an unregister cleanup function.
 */
export function registerBackDismissHandler(handler: BackDismissHandler): () => void {
  backDismissStack.push(handler);
  return () => {
    const idx = backDismissStack.lastIndexOf(handler);
    if (idx !== -1) {
      backDismissStack.splice(idx, 1);
    }
  };
}

/**
 * Attempts to close the top-most open modal, sheet, or dialog overlay.
 * Returns true if an overlay was found and dismissed.
 */
export function dismissTopOpenOverlay(): boolean {
  for (let i = backDismissStack.length - 1; i >= 0; i -= 1) {
    const handler = backDismissStack[i];
    if (!handler) continue;
    const result = handler();
    if (result !== false) {
      return true;
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const dialogs = Array.from(
    document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')
  );
  const topDialog = dialogs[dialogs.length - 1];
  if (!topDialog) {
    return false;
  }

  const closeBtn = topDialog.querySelector<HTMLButtonElement>(
    'button[aria-label*="close" i]:not([disabled]), button[aria-label*="dismiss" i]:not([disabled])'
  );
  if (closeBtn) {
    closeBtn.click();
    return true;
  }

  const escEvent = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  });
  topDialog.dispatchEvent(escEvent);
  document.dispatchEvent(escEvent);
  return true;
}

export interface HandleAndroidBackOptions {
  readonly pathname: string;
  readonly historyIdx: number;
  readonly canGoBack: boolean;
  readonly nowMs: number;
  readonly lastRootBackMs: number;
  readonly exitConfirmWindowMs?: number;
  readonly navigate: (to: number | string, options?: { replace?: boolean }) => void;
  readonly showExitHint: (message: string) => void;
  readonly onExit: () => void;
}

/**
 * Executes Android hardware/gesture Back behavior:
 * 1) Dismisses top-most open modal/drawer/sheet if present.
 * 2) Navigates back in app history (or returns to `/` when deep-linked onto a sub-route).
 * 3) On root (`/` or `/login`), requires two back presses within 2s before exiting.
 * Returns updated `lastRootBackMs` timestamp for double-back exit tracking.
 */
export function handleAndroidBackPress({
  pathname,
  historyIdx,
  canGoBack,
  nowMs,
  lastRootBackMs,
  exitConfirmWindowMs = 2000,
  navigate,
  showExitHint,
  onExit,
}: HandleAndroidBackOptions): number {
  if (dismissTopOpenOverlay()) {
    return 0;
  }

  const isRootRoute = pathname === '/' || pathname === '/login';
  if (!isRootRoute) {
    if (historyIdx > 0 || canGoBack) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
    return 0;
  }

  if (lastRootBackMs > 0 && nowMs - lastRootBackMs <= exitConfirmWindowMs) {
    onExit();
    return 0;
  }

  showExitHint('Press back again to exit WealthNest');
  return nowMs;
}
