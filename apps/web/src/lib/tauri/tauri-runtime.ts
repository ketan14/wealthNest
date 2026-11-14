/**
 * Tauri 2 Runtime Environment & Platform Detection
 */

export type AppPlatform = 'desktop' | 'mobile' | 'web';

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    // Tauri 2 internal bridge
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ ||
    // Tauri 1/2 global object
    (window as unknown as { __TAURI__?: unknown }).__TAURI__
  );
}

export function isMobileUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function getAppPlatform(): AppPlatform {
  if (!isTauri()) return 'web';

  const isMobileOS =
    isMobileUserAgent() ||
    (typeof window !== 'undefined' && 'ontouchstart' in window && window.innerWidth < 768);

  return isMobileOS ? 'mobile' : 'desktop';
}

export function isTauriDesktop(): boolean {
  return isTauri() && getAppPlatform() === 'desktop';
}

export function isTauriMobile(): boolean {
  return isTauri() && getAppPlatform() === 'mobile';
}
