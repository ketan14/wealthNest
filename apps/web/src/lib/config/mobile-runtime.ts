import { Capacitor } from '@capacitor/core';

/**
 * Returns true if running natively on a mobile platform (Android / iOS).
 * On native mobile builds, demo mock data fallbacks (such as Vaghela family demo portfolios,
 * demo transactions, demo liabilities, and demo goals) must be suppressed so that
 * the app never shows synthetic mock data when offline or disconnected.
 */
export function isNativeMobileApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Returns whether demo mock data fallbacks should be rendered.
 * On native Android / iOS builds, demo fallbacks are strictly disabled (returns false).
 * On desktop web browsers, demo fallbacks are permitted only when running unauthenticated.
 */
export function shouldAllowDemoData(isDemoMode: boolean): boolean {
  if (isNativeMobileApp()) {
    return false;
  }
  return isDemoMode;
}
