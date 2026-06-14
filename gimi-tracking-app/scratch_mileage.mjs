import crypto from 'crypto';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';
const BASE_URL = 'https://eu-open.tracksolidpro.com/route/rest';
const TOKEN = 'e5e37faab6daf21811aac3d3c65c82e6';
const IMEI = '780901703187639';

function getUTCTimestamp() {
    const now = new Date();
    const pad = (n) => n < 10 ? `0${n}` : n;
    return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

function sign(params) {
    const sorted = Object.keys(params).sort();
    let s = APP_SECRET;
    for (const k of sorted) { if (k !== 'sign') s += `${k}${params[k]}`; }
    s += APP_SECRET;
    return crypto.createHash('md5').update(s).digest('hex').toUpperCase();
}

async function call(method, extra = {}) {
    const params = { method, app_key: APP_KEY, format: 'json', sign_method: 'md5', timestamp: getUTCTimestamp(), v: '1.0', ...extra };
    params.sign = sign(params);
    const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const url = `${BASE_URL}?${qs}`;
    const res = await fetch(url);
    return res.json();
}

async function main() {
    // 1. Test device list to verify token
    const devList = await call('jimi.user.device.list', { access_token: TOKEN, target: 'saudiex' });
    console.log("Device List response:", devList);

    if (devList.code === 1004) {
        console.log("Token expired or invalid.");
        return;
    }

    // 2. Query mileage with different time ranges
    const ranges = [
        { label: "Local Time June 7 00:00:00 to 23:59:59", begin: "2026-06-07 00:00:00", end: "2026-06-07 23:59:59" },
        { label: "UTC June 7 00:00:00 to 23:59:59 (shifted local)", begin: "2026-06-06 21:00:00", end: "2026-06-07 20:59:59" },
        { label: "Full day June 6 to June 7", begin: "2026-06-06 00:00:00", end: "2026-06-07 23:59:59" }
    ];

    for (const r of ranges) {
        const res = await call('jimi.device.track.mileage', {
            access_token: TOKEN,
            imeis: IMEI,
            begin_time: r.begin,
            end_time: r.end
        });
        console.log(`\nRange: ${r.label} (${r.begin} to ${r.end})`);
        console.log("Response:", res);
    }
}

main().catch(console.error);
