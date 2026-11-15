import React from 'react';

interface AuthSplitLayoutProps {
  readonly branding: React.ReactNode;
  readonly children: React.ReactNode;
  readonly overlays?: React.ReactNode;
}

/**
 * Responsive split layout for unauthenticated routes (Login, Sign Up, Reset Password, Invite).
 * Uses a single `h-dvh overflow-y-auto` scroll container so Android WebViews and small screens
 * resize smoothly above the soft keyboard without trapping upward touch scrolling.
 */
export function AuthSplitLayout({ branding, children, overlays }: AuthSplitLayoutProps) {
  return (
    <div
      data-testid="auth-scroll-container"
      className="h-dvh w-full overflow-y-auto overflow-x-hidden overscroll-y-contain bg-slate-950 text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-300"
    >
      <div className="min-h-full flex flex-col lg:flex-row relative">
        {branding}
        <div
          data-testid="auth-form-panel"
          className="order-1 lg:order-2 lg:w-1/2 flex items-center justify-center p-4 sm:p-10 lg:p-16 relative"
        >
          <div className="max-w-md w-full">{children}</div>
        </div>
      </div>
      {overlays}
    </div>
  );
}
