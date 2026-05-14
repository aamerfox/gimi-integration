import crypto from 'crypto';
import fs from 'fs';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';
const BASE_URL = 'https://eu-open.tracksolidpro.com/route/rest';
const ACCOUNT = 'GBH2025';
const PASSWORD_MD5 = '4a026bcce174570b8b0411600017f2f2';

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
    const res = await fetch(`${BASE_URL}?${qs}`);
    return res.json();
}

async function main() {
    const log = [];
    const L = (m) => { log.push(m); };

    // Login
    const login = await call('jimi.oauth.token.get', { user_id: ACCOUNT, user_pwd_md5: PASSWORD_MD5, expires_in: 7200 });
    const token = login.result.accessToken;
    L(`Login: OK (token received)`);

    // Device list with full details
    const devs = await call('jimi.user.device.list', { access_token: token, target: ACCOUNT });
    L(`\n=== DEVICES (${devs.result?.length || 0}) ===`);
    (devs.result || []).forEach((d, i) => {
        L(`  Device ${i + 1}:`);
        L(`    Name:   ${d.deviceName}`);
        L(`    IMEI:   ${d.imei}`);
        L(`    Status: ${d.status}`);
        L(`    Model:  ${d.deviceType || d.model || 'N/A'}`);
        L(`    All fields: ${JSON.stringify(d)}`);
    });

    // Live locations
    const locs = await call('jimi.user.device.location.list', { access_token: token, target: ACCOUNT, map_type: 'GOOGLE' });
    L(`\n=== LIVE LOCATIONS (${locs.result?.length || 0}) ===`);
    (locs.result || []).forEach((l, i) => {
        L(`  Device ${i + 1}:`);
        L(`    IMEI:      ${l.imei}`);
        L(`    Lat/Lng:   ${l.lat}, ${l.lng}`);
        L(`    Speed:     ${l.speed} km/h`);
        L(`    GPS Time:  ${l.gpsTime}`);
        L(`    Status:    ${l.status}`);
        L(`    Online:    ${l.positionType || l.online || 'N/A'}`);
        L(`    All fields: ${JSON.stringify(l)}`);
    });

    const output = log.join('\n');
    fs.writeFileSync('check-devices-result.txt', output, 'utf8');
    console.log('Done! Results in check-devices-result.txt');
}
main().catch(console.error);
