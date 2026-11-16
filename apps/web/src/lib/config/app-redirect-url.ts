/**
 * Target Resolution for External HTTPS Redirects and App Links
 *
 * Resolves verified HTTPS App Link / Universal Link targets for:
 * - Password recovery (ForgotPasswordModal, ResetPasswordPage)
 * - Email confirmation / sign-up verification (SignUpPage)
 * - Household member invitations (HouseholdSharingCard)
 * - Platform admin user provisioning
 *
 * Avoids custom WebView schemes (capacitor://localhost, https://tauri.localhost,
 * file://, http://localhost) being sent into GoTrue email templates, mitigating
 * unverified custom-scheme hijacking (AUTH-04).
 */

export const DEFAULT_CANONICAL_APP_ORIGIN = 'https://app.wealthnest.in';

/**
 * Returns the verified canonical base URL for external email redirects and deep links.
 *
 * Resolution order:
 * 1. Explicit environment override `VITE_PUBLIC_APP_URL` or `VITE_APP_URL`
 * 2. Current `window.location.origin` if running in standard web browser over HTTPS/HTTP
 *    (excluding custom native schemes like capacitor://, tauri://, file://, ionic://)
 * 3. Default production canonical origin: https://app.wealthnest.in
 */
export function getCanonicalAppOrigin(): string {
  if (typeof import.meta !== 'undefined') {
    const envUrl =
      (import.meta.env?.VITE_PUBLIC_APP_URL as string | undefined)?.trim() ||
      (import.meta.env?.VITE_APP_URL as string | undefined)?.trim();
    if (envUrl) {
      return envUrl.replace(/\/+$/, '');
    }
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    const isCustomNativeScheme =
      origin.startsWith('capacitor://') ||
      origin.startsWith('tauri://') ||
      origin.startsWith('https://tauri.localhost') ||
      origin.startsWith('ionic://') ||
      origin.startsWith('file://');

    if (!isCustomNativeScheme && origin.startsWith('http')) {
      return origin.replace(/\/+$/, '');
    }
  }

  return DEFAULT_CANONICAL_APP_ORIGIN;
}

/**
 * Resolves a full external URL target for authentication or invitation redirects.
 * @param path Relative path, e.g. '/auth/reset-password', '/invite?token=...'
 */
export function resolveAppRedirectUrl(path: string): string {
  const base = getCanonicalAppOrigin();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
