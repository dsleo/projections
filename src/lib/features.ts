/**
 * Centralized feature flags.
 *
 * Goal:
 * - Vercel production should be able to run without native binaries like `tectonic`.
 * - Local dev can keep TeX compilation enabled.
 */

/**
 * TeX compilation requires a native TeX engine (tectonic) + synctex.
 *
 * Default behavior:
 * - enabled in development
 * - disabled in production unless explicitly enabled
 */
export function isTexEnabled(): boolean {
    // Allow explicit override.
    const env = process.env.NEXT_PUBLIC_ENABLE_TEX;
    if (env != null) return env === '1' || env.toLowerCase() === 'true';

    return process.env.NODE_ENV !== 'production';
}
