import { SupabaseClient } from '@supabase/supabase-js';
import { connectionManager } from '../services/connection-manager';

/**
 * Transparent SupabaseClient Proxy.
 * Delegates all repository queries, auth invocations, and storage operations
 * dynamically to the active Supabase client managed by ConnectionManager.
 *
 * This enables updating the backend server IPv4 address on the fly without
 * rebuilding, redeploying, or breaking any existing repository imports.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const activeClient = connectionManager.getClient();
    const value = Reflect.get(activeClient, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(activeClient);
    }
    return value;
  },
  set(_target, prop, value, receiver) {
    const activeClient = connectionManager.getClient();
    return Reflect.set(activeClient, prop, value, receiver);
  },
});

export { connectionManager };
