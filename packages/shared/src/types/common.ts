/**
 * Branded nominal type helper to prevent accidental ID mixing
 */
export type Brand<K, T> = K & { readonly __brand: T };

export type UUID = string;
export type ISODateString = string;

/**
 * System execution environment enumeration
 */
export type AppEnvironment = 'development' | 'staging' | 'production' | 'test';
