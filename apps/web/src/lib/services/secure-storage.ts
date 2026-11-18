import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import type { SupportedStorage } from '@supabase/supabase-js';

/**
 * Keystore-backed SupportedStorage implementation for Supabase Auth.
 * When running inside a native mobile runtime (Android / iOS), sensitive JWT
 * access tokens and refresh tokens are persisted in hardware-backed secure storage
 * (Android Keystore / EncryptedSharedPreferences) rather than unencrypted WebView localStorage.
 *
 * When running in standard web browsers, it seamlessly falls back to window.localStorage.
 */
export class CapacitorSecureStorage implements SupportedStorage {
  private isNative: boolean;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  async getItem(key: string): Promise<string | null> {
    if (!this.isNative) {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }

    try {
      const value = await SecureStorage.get(key);
      if (typeof value === 'string') {
        return value;
      }
      return value !== null && value !== undefined ? JSON.stringify(value) : null;
    } catch {
      // Key not found or error reading from Keystore
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!this.isNative) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      return;
    }

    try {
      await SecureStorage.set(key, value);
    } catch (err) {
      console.error('Failed to securely persist auth token in Keystore:', err);
    }
  }

  async removeItem(key: string): Promise<void> {
    if (!this.isNative) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      return;
    }

    try {
      await SecureStorage.remove(key);
    } catch {
      // Ignore if key did not exist
    }
  }
}

export const capacitorSecureStorage = new CapacitorSecureStorage();
