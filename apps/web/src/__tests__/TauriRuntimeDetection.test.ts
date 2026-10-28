import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isTauri,
  getAppPlatform,
  isTauriDesktop,
  isTauriMobile,
} from '../lib/tauri/tauri-runtime';

describe('Phase 10: Tauri 2 Runtime Environment & Platform Detection', () => {
  const originalTauri = (window as unknown as { __TAURI__?: unknown }).__TAURI__;
  const originalInternals = (window as unknown as { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
  const originalUserAgent = navigator.userAgent;

  beforeEach(() => {
    delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    if (originalTauri) {
      (window as unknown as { __TAURI__?: unknown }).__TAURI__ = originalTauri;
    } else {
      delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
    }

    if (originalInternals) {
      (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = originalInternals;
    } else {
      delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    }

    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });

  it('TC-10-01A: returns false and "web" in standard browser runtime', () => {
    expect(isTauri()).toBe(false);
    expect(getAppPlatform()).toBe('web');
    expect(isTauriDesktop()).toBe(false);
    expect(isTauriMobile()).toBe(false);
  });

  it('TC-10-01B: detects Tauri Desktop environment via global bridge', () => {
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
      window: { getCurrentWindow: () => {} },
    };

    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0',
      configurable: true,
    });

    expect(isTauri()).toBe(true);
    expect(getAppPlatform()).toBe('desktop');
    expect(isTauriDesktop()).toBe(true);
    expect(isTauriMobile()).toBe(false);
  });

  it('TC-10-01C: detects Tauri Mobile runtime on Android / iOS user agents', () => {
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};

    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
      configurable: true,
    });

    expect(isTauri()).toBe(true);
    expect(getAppPlatform()).toBe('mobile');
    expect(isTauriDesktop()).toBe(false);
    expect(isTauriMobile()).toBe(true);
  });

  it('TC-10-01D: detects Tauri Mobile runtime on iPhone user agent', () => {
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {};

    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      configurable: true,
    });

    expect(isTauri()).toBe(true);
    expect(getAppPlatform()).toBe('mobile');
    expect(isTauriDesktop()).toBe(false);
    expect(isTauriMobile()).toBe(true);
  });
});
