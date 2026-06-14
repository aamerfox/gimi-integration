import { format } from 'util';

// 1. Existing conversion function in the web/mobile app
function formatGimiTime(utcString) {
    if (!utcString) return '—';
    try {
        // Appends 'Z' to treat it as UTC natively
        const date = new Date(utcString.replace(' ', 'T') + 'Z');
        if (isNaN(date.getTime())) return utcString;

        const pad = (n) => n.toString().padStart(2, '0');
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

// 2. Simulating the Default Inputs Date Picker Bug
function simulateDefaultDates() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // This is how the web/mobile app currently calculates defaults
    const currentWebDefaultEnd = now.toISOString().slice(0, 16);
    const currentWebDefaultStart = dayAgo.toISOString().slice(0, 16);
    
    // Correct way to get local time strings for inputs:
    const tzOffset = now.getTimezoneOffset() * 60 * 1000;
    const localNow = new Date(now.getTime() - tzOffset);
    const localDayAgo = new Date(dayAgo.getTime() - tzOffset);
    const correctedDefaultEnd = localNow.toISOString().slice(0, 16);
    const correctedDefaultStart = localDayAgo.toISOString().slice(0, 16);

    return {
        current: { start: currentWebDefaultStart, end: currentWebDefaultEnd },
        corrected: { start: correctedDefaultStart, end: correctedDefaultEnd }
    };
}

async function main() {
    console.log("=================================================");
    console.log("     TIMEZONE & TIMESTAMP PARSING TEST RUN");
    console.log("=================================================");
    
    // System Time details
    const localDate = new Date();
    console.log("Current System Time (Local):", localDate.toString());
    console.log("Current UTC Time:            ", localDate.toUTCString());
    console.log("System Timezone Offset:      ", localDate.getTimezoneOffset(), "minutes");
    
    // Test Case A: If API returns a UTC timestamp string
    const sampleRawTime = '2026-06-03 15:30:25';
    console.log(`\n--- Test A: Parsing raw API timestamp: "${sampleRawTime}" ---`);
    const formatted = formatGimiTime(sampleRawTime);
    console.log("Raw from API:         ", sampleRawTime);
    console.log("Formatted by Our App: ", formatted);
    
    const parsedAsUTC = new Date(sampleRawTime.replace(' ', 'T') + 'Z');
    console.log("Parsed internally as: ", parsedAsUTC.toString());
    
    // Test Case B: Date Range Picker defaults
    console.log(`\n--- Test B: Date Range Input Defaults ---`);
    const dates = simulateDefaultDates();
    console.log("Current defaults set in Web/Mobile inputs (uses toISOString directly):");
    console.log("  FROM:", dates.current.start.replace('T', ' '));
    console.log("  TO:  ", dates.current.end.replace('T', ' '));
    console.log("Corrected defaults (representing actual local time):");
    console.log("  FROM:", dates.corrected.start.replace('T', ' '));
    console.log("  TO:  ", dates.corrected.end.replace('T', ' '));
    
    const diffHours = (new Date(dates.corrected.end) - new Date(dates.current.end)) / 3600000;
    console.log(`Difference in default values: ${diffHours} hours`);
}

main().catch(console.error);
