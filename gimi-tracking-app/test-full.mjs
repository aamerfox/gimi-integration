/**
 * GIMI/TrackSolid Pro - Full API Test (All 5 Endpoints)
 * WORKING ENDPOINT: https://eu-open.tracksolidpro.com/route/rest
 * TIMESTAMP: UTC
 * PASSWORD: as-is (already MD5)
 */
import crypto from 'crypto';
import fs from 'fs';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';
const BASE_URL = 'https://eu-open.tracksolidpro.com/route/rest';
const ACCOUNT = 'GBH2025';
const PASSWORD_MD5 = '4a026bcce174570b8b0411600017f2f2';

const log = [];
function L(msg) { log.push(msg); }

function getUTCTimestamp() {
    const now = new Date();
    const pad = (n) => n < 10 ? `0${n}` : n;
    return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

function generateSignature(params) {
    const sortedKeys = Object.keys(params).sort();
    let s = APP_SECRET;
    for (const key of sortedKeys) {
        if (key === 'sign') continue;
        s += `${key}${params[key]}`;
    }
    s += APP_SECRET;
    return crypto.createHash('md5').update(s).digest('hex').toUpperCase();
}

async function callApi(method, extraParams = {}) {
    const params = {
        method,
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp: getUTCTimestamp(),
        v: '1.0',
        ...extraParams,
    };
    params.sign = generateSignature(params);

    const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');

    try {
        const res = await fetch(`${BASE_URL}?${qs}`);
        const text = await res.text();
        try { return JSON.parse(text); } catch { return { raw: text }; }
    } catch (err) {
        return { error: err.message };
    }
}

async function main() {
    L('============================================================');
    L('  GIMI / TrackSolid Pro - Full API Integration Test');
    L('============================================================');
    L(`Time: ${new Date().toISOString()}`);
    L(`Endpoint: ${BASE_URL}`);
    L(`Account: ${ACCOUNT}`);
    L('');

    // ─── TEST 1: LOGIN ─────────────────────────────────────
    L('--- TEST 1: LOGIN ---');
    const loginRes = await callApi('jimi.oauth.token.get', {
        user_id: ACCOUNT,
        user_pwd_md5: PASSWORD_MD5,
        expires_in: 7200,
    });

    if (loginRes.code !== 0) {
        L(`  FAIL: code=${loginRes.code}, msg=${loginRes.message}`);
        L('Cannot proceed without login.');
        fs.writeFileSync('test-full-results.txt', log.join('\n'), 'utf8');
        console.log('Done (login failed). Results in test-full-results.txt');
        return;
    }

    const token = loginRes.result.accessToken || loginRes.result.access_token;
    L(`  PASS: Login successful!`);
    L(`  accessToken: ${token.substring(0, 30)}...`);
    L(`  expiresIn: ${loginRes.result.expiresIn || loginRes.result.expires_in} seconds`);
    L(`  refreshToken: ${(loginRes.result.refreshToken || loginRes.result.refresh_token || 'N/A').substring(0, 30)}...`);
    L('');

    // ─── TEST 2: DEVICE LIST ───────────────────────────────
    L('--- TEST 2: DEVICE LIST ---');
    const devRes = await callApi('jimi.user.device.list', {
        access_token: token,
        target: ACCOUNT,
    });

    let firstImei = null;
    if (devRes.code === 0 && devRes.result) {
        const devices = Array.isArray(devRes.result) ? devRes.result : [];
        L(`  PASS: ${devices.length} devices found`);
        devices.forEach((d, i) => {
            L(`    ${i + 1}. Name: ${d.deviceName || 'N/A'} | IMEI: ${d.imei} | Status: ${d.status || 'N/A'} | Model: ${d.deviceType || d.model || 'N/A'}`);
            if (!firstImei && d.imei) firstImei = d.imei;
        });
    } else {
        L(`  FAIL: code=${devRes.code}, msg=${devRes.message}`);
    }
    L('');

    // ─── TEST 3: DEVICE LOCATIONS ──────────────────────────
    L('--- TEST 3: DEVICE LOCATIONS ---');
    const locRes = await callApi('jimi.user.device.location.list', {
        access_token: token,
        target: ACCOUNT,
        map_type: 'GOOGLE',
    });

    if (locRes.code === 0 && locRes.result) {
        const locs = Array.isArray(locRes.result) ? locRes.result : [];
        L(`  PASS: ${locs.length} device locations`);
        locs.forEach((l, i) => {
            L(`    ${i + 1}. IMEI: ${l.imei} | Lat: ${l.lat} | Lng: ${l.lng} | Speed: ${l.speed} km/h | GPS: ${l.gpsTime} | Status: ${l.status || 'N/A'}`);
        });
    } else {
        L(`  FAIL: code=${locRes.code}, msg=${locRes.message}`);
    }
    L('');

    // ─── TEST 4: TRACK HISTORY ─────────────────────────────
    if (firstImei) {
        L(`--- TEST 4: TRACK HISTORY (IMEI: ${firstImei}, last 24h) ---`);
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const pad = (n) => n < 10 ? `0${n}` : n;
        const beginTime = `${yesterday.getUTCFullYear()}-${pad(yesterday.getUTCMonth() + 1)}-${pad(yesterday.getUTCDate())} ${pad(yesterday.getUTCHours())}:${pad(yesterday.getUTCMinutes())}:${pad(yesterday.getUTCSeconds())}`;
        const endTime = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;

        L(`  Range: ${beginTime} -> ${endTime}`);

        const trackRes = await callApi('jimi.device.track.list', {
            access_token: token,
            imei: firstImei,
            begin_time: beginTime,
            end_time: endTime,
            map_type: 'GOOGLE',
        });

        if (trackRes.code === 0 && trackRes.result) {
            const points = Array.isArray(trackRes.result) ? trackRes.result : [];
            L(`  PASS: ${points.length} track points`);
            if (points.length > 0) {
                L(`    First: Lat=${points[0].lat}, Lng=${points[0].lng}, Speed=${points[0].speed}, Time=${points[0].gpsTime}`);
                const last = points[points.length - 1];
                L(`    Last:  Lat=${last.lat}, Lng=${last.lng}, Speed=${last.speed}, Time=${last.gpsTime}`);
            }
        } else {
            L(`  RESULT: code=${trackRes.code}, msg=${trackRes.message} (may have no data in 24h)`);
        }
    } else {
        L('--- TEST 4: TRACK HISTORY --- SKIPPED (no devices)');
    }
    L('');

    // ─── TEST 5: GEOFENCES ─────────────────────────────────
    L('--- TEST 5: GEOFENCES ---');
    const fenceRes = await callApi('jimi.open.platform.fence.list', {
        access_token: token,
        account: ACCOUNT,
    });

    if (fenceRes.code === 0) {
        const fences = fenceRes.result ? (Array.isArray(fenceRes.result) ? fenceRes.result : []) : [];
        L(`  PASS: ${fences.length} geofences`);
        fences.forEach((f, i) => {
            L(`    ${i + 1}. Name: ${f.fenceName || f.name || 'N/A'} | Radius: ${f.radius || 'N/A'}m | Lat: ${f.lat || f.centerLat || 'N/A'} | Lng: ${f.lng || f.centerLng || 'N/A'}`);
        });
    } else {
        L(`  RESULT: code=${fenceRes.code}, msg=${fenceRes.message}`);
    }
    L('');

    // ─── SUMMARY ───────────────────────────────────────────
    L('============================================================');
    L('  TEST SUMMARY');
    L('============================================================');
    L(`  Login:      ${loginRes.code === 0 ? 'PASS' : 'FAIL'}`);
    L(`  Devices:    ${devRes.code === 0 ? 'PASS' : 'FAIL'} ${devRes.code === 0 ? `(${Array.isArray(devRes.result) ? devRes.result.length : 0} devices)` : ''}`);
    L(`  Locations:  ${locRes.code === 0 ? 'PASS' : 'FAIL'}`);
    L(`  History:    ${firstImei ? 'TESTED' : 'SKIPPED'}`);
    L(`  Geofences:  ${fenceRes.code === 0 ? 'PASS' : `code=${fenceRes.code}`}`);
    L('============================================================');

    const output = log.join('\n');
    fs.writeFileSync('test-full-results.txt', output, 'utf8');
    console.log('Done! Full results in test-full-results.txt');
}

main().catch(console.error);
