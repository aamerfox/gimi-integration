/**
 * Share Location utilities.
 * Generates and validates self-signed, expiring share URLs.
 *
 * URL format:
 *   {origin}/share?imei=X&name=ENCODED&exp=UNIX_TS&tok=ACCESS_TOKEN&sig=HMAC
 *
 * HMAC = HmacSHA256( `${imei}|${exp}|${tok}`, SHARE_SECRET )
 */

import CryptoJS from 'crypto-js';

// We sign with the same app secret already baked into the app
const SHARE_SECRET = 'AFF6D2C054844194BC1C9A93B8B9C3AA';

export interface ShareParams {
    imei: string;
    name: string;
    exp: number;      // unix timestamp (seconds)
    tok: string;      // access token — embedded so viewer can fetch live location
}

/** Build a signed share URL */
export function createShareUrl(
    baseUrl: string,
    params: ShareParams
): string {
    const payload = `${params.imei}|${params.exp}|${params.tok}`;
    const sig = CryptoJS.HmacSHA256(payload, SHARE_SECRET).toString();
    const q = new URLSearchParams({
        imei: params.imei,
        name: params.name,
        exp: String(params.exp),
        tok: params.tok,
        sig,
    });
    return `${baseUrl}/share?${q.toString()}`;
}

/** Validate a share URL's signature and expiry. Returns parsed params or null. */
export function validateShareUrl(search: string): ShareParams | null {
    try {
        const p = new URLSearchParams(search);
        const imei = p.get('imei');
        const name = p.get('name');
        const exp = Number(p.get('exp'));
        const tok = p.get('tok');
        const sig = p.get('sig');

        if (!imei || !name || !exp || !tok || !sig) return null;

        // Check expiry
        if (Date.now() / 1000 > exp) return null;

        // Verify HMAC
        const payload = `${imei}|${exp}|${tok}`;
        const expected = CryptoJS.HmacSHA256(payload, SHARE_SECRET).toString();
        if (sig !== expected) return null;

        return { imei, name, exp, tok };
    } catch {
        return null;
    }
}

/** Duration presets in seconds */
export const SHARE_DURATIONS = [
    { label: '1 hour', seconds: 3600 },
    { label: '4 hours', seconds: 4 * 3600 },
    { label: '24 hours', seconds: 24 * 3600 },
    { label: '7 days', seconds: 7 * 24 * 3600 },
] as const;
