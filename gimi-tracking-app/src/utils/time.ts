/**
 * Gimi Time Utilities
 * Handles conversion from API UTC strings to local / GMT+3 time.
 */



export function formatGimiTime(utcString: string | undefined): string {
    if (!utcString) return '—';

    try {
        // Gimi format: YYYY-MM-DD HH:mm:ss
        // Parse as UTC (by appending 'Z') to convert to user's local timezone
        const date = new Date(utcString.replace(' ', 'T') + (utcString.endsWith('Z') ? '' : 'Z'));
        
        if (isNaN(date.getTime())) return utcString; 

        const pad = (n: number) => n.toString().padStart(2, '0');
        const yyyy = date.getFullYear();
        const mm = pad(date.getMonth() + 1);
        const dd = pad(date.getDate());
        const hh = pad(date.getHours());
        const min = pad(date.getMinutes());
        const ss = pad(date.getSeconds());

        return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    } catch {
        return utcString;
    }
}

export function formatGimiTimeOnly(utcString: string | undefined): string {
    if (!utcString) return '—';

    try {
        const date = new Date(utcString.replace(' ', 'T') + (utcString.endsWith('Z') ? '' : 'Z'));
        
        if (isNaN(date.getTime())) return utcString; 

        const pad = (n: number) => n.toString().padStart(2, '0');
        const hh = pad(date.getHours());
        const min = pad(date.getMinutes());
        const ss = pad(date.getSeconds());

        return `${hh}:${min}:${ss}`;
    } catch {
        return utcString;
    }
}

/**
 * Checks if a timestamp (local string) is within a certain minute threshold.
 * Used for more accurate Online status logic.
 */
export function isRecent(utcString: string | undefined, thresholdMins = 5): boolean {
    if (!utcString) return false;
    try {
        const date = new Date(utcString.replace(' ', 'T') + (utcString.endsWith('Z') ? '' : 'Z'));
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        return diffMs < (thresholdMins * 60 * 1000);
    } catch {
        return false;
    }
}

/**
 * Formats a Date object to a YYYY-MM-DDTHH:mm string in the local timezone,
 * suitable for populating <input type="datetime-local">.
 */
export function getLocalIsoString(date: Date): string {
    const tzOffset = date.getTimezoneOffset() * 60 * 1000;
    const localDate = new Date(date.getTime() - tzOffset);
    return localDate.toISOString().slice(0, 16);
}

/**
 * Converts a local datetime-local picker string (YYYY-MM-DDTHH:mm) to UTC API string (yyyy-MM-dd HH:mm:ss).
 */
export function formatToUtcApiTime(localIsoStr: string): string {
    if (!localIsoStr) return '';
    const localDate = new Date(localIsoStr);
    const pad = (n: number) => n < 10 ? `0${n}` : String(n);
    return `${localDate.getUTCFullYear()}-${pad(localDate.getUTCMonth() + 1)}-${pad(localDate.getUTCDate())} ${pad(localDate.getUTCHours())}:${pad(localDate.getUTCMinutes())}:${pad(localDate.getUTCSeconds())}`;
}
/**
 * Converts a local datetime-local picker string (YYYY-MM-DDTHH:mm) to LOCAL API string (yyyy-MM-dd HH:mm:ss).
 * Use this for data time parameters (begin_time, end_time) in the Tracksolid API.
 * The Tracksolid API interprets these times in the ACCOUNT's local timezone, NOT UTC.
 * Only the signing `timestamp` field must be UTC (handled separately in api.ts).
 */
export function formatToLocalApiTime(localIsoStr: string): string {
    if (!localIsoStr) return '';
    // The datetime-local input value is already in local time — just reformat it
    const [datePart, timePart = '00:00'] = localIsoStr.split('T');
    const [hh, mm] = timePart.split(':');
    return `${datePart} ${hh}:${mm}:00`;
}
