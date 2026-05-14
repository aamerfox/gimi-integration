/**
 * Gimi Time Utilities
 * Handles conversion from API UTC strings to local / GMT+3 time.
 */



export function formatGimiTime(utcString: string | undefined): string {
    if (!utcString) return '—';

    try {
        // Gimi format: YYYY-MM-DD HH:mm:ss (UTC)
        // We append 'Z' to treat it as UTC natively
        const date = new Date(utcString.replace(' ', 'T') + 'Z');
        
        if (isNaN(date.getTime())) return utcString; 

        // Use Intl.DateTimeFormat for robust local formatting
        // This ensures the browser's local timezone is used
        return new Intl.DateTimeFormat('en-GB', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).format(date).replace(',', '');
    } catch {
        return utcString;
    }
}

/**
 * Checks if a timestamp (UTC string) is within a certain minute threshold.
 * Used for more accurate Online status logic.
 */
export function isRecent(utcString: string | undefined, thresholdMins = 5): boolean {
    if (!utcString) return false;
    try {
        const date = new Date(utcString.replace(' ', 'T') + 'Z');
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        return diffMs < (thresholdMins * 60 * 1000);
    } catch {
        return false;
    }
}
