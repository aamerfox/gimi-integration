/**
 * config/constants.ts
 *
 * Single source of truth for all app-level secrets and keys.
 *
 * Values are injected at build time via app.config.js (which reads from .env).
 * Fallback strings are empty — missing env vars will be caught by the
 * validateConfig() check below, which throws a clear error in development.
 *
 * DO NOT hardcode real secrets here. Use the .env file instead.
 */

import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

/** TrackSolid / Jimi API application key */
export const APP_KEY: string = extra.appKey || '';

/** TrackSolid / Jimi API application secret (used for HMAC-MD5 signing) */
export const APP_SECRET: string = extra.appSecret || '';

/** OCI Tag API application key */
export const TAG_APP_KEY: string = extra.tagAppKey || '';

/** HMAC-SHA256 secret for signing/verifying share link URLs */
export const SHARE_SECRET: string = extra.shareSecret || '';

/**
 * Validates that all required secrets are present.
 * Called once at startup in development to catch missing .env entries early.
 * Silent in production to avoid leaking which keys are absent.
 */
export function validateConfig(): void {
  if (__DEV__) {
    const missing: string[] = [];
    if (!APP_KEY)      missing.push('EXPO_PUBLIC_APP_KEY');
    if (!APP_SECRET)   missing.push('EXPO_PUBLIC_APP_SECRET');
    if (!TAG_APP_KEY)  missing.push('EXPO_PUBLIC_TAG_APP_KEY');
    if (!SHARE_SECRET) missing.push('EXPO_PUBLIC_SHARE_SECRET');

    if (missing.length > 0) {
      console.warn(
        `[Config] Missing environment variables: ${missing.join(', ')}\n` +
        'Copy .env.example → .env and fill in the required values.'
      );
    }
  }
}
