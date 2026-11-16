import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCanonicalAppOrigin,
  resolveAppRedirectUrl,
  DEFAULT_CANONICAL_APP_ORIGIN,
} from '../lib/config/app-redirect-url';

describe('App Redirect URL & HTTPS App Link Resolution (AUTH-04)', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.stubEnv('VITE_PUBLIC_APP_URL', '');
    vi.stubEnv('VITE_APP_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('defaults to canonical production domain https://app.wealthnest.in when in WebView / custom scheme', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { origin: 'capacitor://localhost' },
    });
    expect(getCanonicalAppOrigin()).toBe(DEFAULT_CANONICAL_APP_ORIGIN);

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { origin: 'https://tauri.localhost' },
    });
    expect(getCanonicalAppOrigin()).toBe(DEFAULT_CANONICAL_APP_ORIGIN);

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { origin: 'file://' },
    });
    expect(getCanonicalAppOrigin()).toBe(DEFAULT_CANONICAL_APP_ORIGIN);
  });

  it('respects window.location.origin in normal web browser environments', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { origin: 'https://wealthnest.vaghela-ketan.workers.dev' },
    });
    expect(getCanonicalAppOrigin()).toBe('https://wealthnest.vaghela-ketan.workers.dev');
  });

  it('prefers explicit VITE_PUBLIC_APP_URL / VITE_APP_URL environment overrides', () => {
    vi.stubEnv('VITE_PUBLIC_APP_URL', 'https://custom.wealthnest.in/');
    expect(getCanonicalAppOrigin()).toBe('https://custom.wealthnest.in');

    vi.stubEnv('VITE_PUBLIC_APP_URL', '');
    vi.stubEnv('VITE_APP_URL', 'https://preview.wealthnest.in/');
    expect(getCanonicalAppOrigin()).toBe('https://preview.wealthnest.in');
  });

  it('correctly formats relative paths into verified HTTPS redirect URLs', () => {
    vi.stubEnv('VITE_PUBLIC_APP_URL', 'https://app.wealthnest.in');

    expect(resolveAppRedirectUrl('/reset-password')).toBe('https://app.wealthnest.in/reset-password');
    expect(resolveAppRedirectUrl('invite?token=abc-123')).toBe(
      'https://app.wealthnest.in/invite?token=abc-123'
    );
  });
});
