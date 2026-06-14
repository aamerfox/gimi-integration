/**
 * Gimi Time Utilities for Mobile
 * Handles conversion from API UTC strings to local time.
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

export function isRecent(utcString: string | undefined): boolean {
    if (!utcString) return false;
    try {
        const date = new Date(utcString.replace(' ', 'T') + (utcString.endsWith('Z') ? '' : 'Z'));
        if (isNaN(date.getTime())) return false;
        // Consider active if pinged within the last 5 minutes
        return (Date.now() - date.getTime()) < 5 * 60 * 1000;
    } catch {
        return false;
    }
}
