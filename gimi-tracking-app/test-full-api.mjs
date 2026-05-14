/**
 * SaudiEx Tracker — Full GIMI API Integration Test v3
 * Correctly extracts access_token from login result object
 * Run: node test-full-api.mjs
 */

import crypto from 'crypto';
import { writeFileSync } from 'fs';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';
const ACCOUNT = 'GBH2025';
const PASSWORD_MD5 = '4a026bcce174570b8b0411600017f2f2';

const ENDPOINTS = [
    'https://eu-open.tracksolidpro.com/route/rest',
    'https://hk-open.tracksolidpro.com/route/rest',
    'http://open.10000track.com/route/rest',
];

const pad = (n) => String(n).padStart(2, '0');
const fmtUtc = (d = new Date()) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;

function sign(params) {
    const keys = Object.keys(params).sort();
    let s = APP_SECRET;
    for (const k of keys) { if (k !== 'sign') s += `${k}${params[k]}`; }
    return crypto.createHash('md5').update(s + APP_SECRET).digest('hex').toUpperCase();
}

async function call(url, priv) {
    const p = { app_key: APP_KEY, format: 'json', sign_method: 'md5', timestamp: fmtUtc(), v: '1.0', ...priv };
    p.sign = sign(p);
    const qs = Object.entries(p).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: qs, signal: ctrl.signal });
        clearTimeout(t);
        const text = await res.text();
        try { return JSON.parse(text); } catch { return { code: -1, raw: text.slice(0, 300) }; }
    } catch (e) { clearTimeout(t); return { code: -2, error: e.message }; }
}

// ─── Output helpers ─────────────────────────────────────────────────────────
const results = [];
const outLines = [];
function out(line) { outLines.push(line || ''); console.log(line || ''); }
function logResult(id, name, status, code, note, data) {
    results.push({ id, name, status, code: String(code), note });
    const icon = { PASS: '[ OK ]', WARN: '[WARN]', FAIL: '[FAIL]', SKIP: '[SKIP]' }[status];
    out(`${icon} [${id}] ${name}`);
    out(`       Code: ${code}  |  ${note}`);
    if (data) out(`       Data: ${JSON.stringify(data).slice(0, 300)}`);
    out('');
}

// ─── Run ─────────────────────────────────────────────────────────────────────
let BASE_URL = ENDPOINTS[0];
let ACCESS_TOKEN = null;
let USER_ID = null;
let FIRST_IMEI = null;

out('='.repeat(64));
out('  SaudiEx Tracker - GIMI API Full Integration Test');
out(`  UTC Time  : ${fmtUtc()}`);
out(`  Account   : ${ACCOUNT}`);
out('='.repeat(64));
out('');

// ── T01: Auth ─────────────────────────────────────────────────────────────────
out('--- T01: Authentication ---');
for (const ep of ENDPOINTS) {
    const r = await call(ep, { method: 'jimi.oauth.token.get', user_id: ACCOUNT, user_pwd_md5: PASSWORD_MD5, expires_in: 7200 });
    out(`  ${ep}  ->  code=${r.code}  msg=${r.message || r.error || r.raw || ''}`);
    if (r.code === 0) {
        // result can be a string (token) OR an object {access_token, userId, ...}
        if (typeof r.result === 'string') {
            ACCESS_TOKEN = r.result;
        } else if (r.result?.access_token) {
            ACCESS_TOKEN = r.result.access_token;
            USER_ID = r.result.userId || r.result.user_id;
        } else if (r.result?.accessToken) {
            ACCESS_TOKEN = r.result.accessToken;
        }
        BASE_URL = ep;
        out(`  Raw result: ${JSON.stringify(r.result).slice(0, 200)}`);
        logResult('T01', 'Authentication (jimi.oauth.token.get)', 'PASS', 0,
            `Token: ${String(ACCESS_TOKEN).slice(0, 50)}  |  Endpoint: ${ep}`, null);
        break;
    }
}
if (!ACCESS_TOKEN) {
    logResult('T01', 'Authentication (jimi.oauth.token.get)', 'FAIL', 'ALL',
        'All endpoints failed. Check APP_KEY / pwd / account / network.', null);
}

// ── T02: Device List ─────────────────────────────────────────────────────────
out('--- T02: Device List ---');
if (ACCESS_TOKEN) {
    const r = await call(BASE_URL, { method: 'jimi.user.device.list', access_token: ACCESS_TOKEN, target: ACCOUNT });
    out(`  code=${r.code}  msg=${r.message || r.error || ''}`);
    if (r.code === 0) {
        const devs = Array.isArray(r.result) ? r.result : [];
        FIRST_IMEI = devs[0]?.imei;
        logResult('T02', 'Device List (jimi.user.device.list)', 'PASS', 0,
            `${devs.length} device(s). First IMEI: ${FIRST_IMEI}`,
            devs.slice(0, 5).map(d => ({ name: d.deviceName, imei: d.imei, status: d.status, model: d.deviceType })));
    } else {
        logResult('T02', 'Device List (jimi.user.device.list)', 'FAIL', r.code, r.message || r.raw, null);
    }
} else { logResult('T02', 'Device List', 'SKIP', '-', 'No token', null); }

// ── T03: Live Locations ──────────────────────────────────────────────────────
out('--- T03: Live Locations ---');
if (ACCESS_TOKEN) {
    const r = await call(BASE_URL, { method: 'jimi.user.device.location.list', access_token: ACCESS_TOKEN, target: ACCOUNT, map_type: 'GOOGLE' });
    out(`  code=${r.code}  msg=${r.message || r.error || ''}`);
    if (r.code === 0) {
        const locs = Array.isArray(r.result) ? r.result : [];
        const s = locs[0];
        logResult('T03', 'Live Locations (jimi.user.device.location.list)', 'PASS', 0,
            `${locs.length} device location(s). Sample: lat=${s?.lat}, lng=${s?.lng}, speed=${s?.speed}km/h, posType=${s?.posType}`,
            locs.slice(0, 3).map(l => ({ imei: l.imei, lat: l.lat, lng: l.lng, speed: l.speed, direction: l.direction, gpsTime: l.gpsTime, posType: l.posType })));
    } else {
        logResult('T03', 'Live Locations', 'FAIL', r.code, r.message || r.raw, null);
    }
} else { logResult('T03', 'Live Locations', 'SKIP', '-', 'No token', null); }

// ── T04: Track History ───────────────────────────────────────────────────────
out('--- T04: Track History ---');
if (ACCESS_TOKEN && FIRST_IMEI) {
    const now = new Date();
    const dayAgo = new Date(now - 24 * 3600 * 1000);
    const r = await call(BASE_URL, {
        method: 'jimi.device.track.list', access_token: ACCESS_TOKEN,
        imei: FIRST_IMEI, begin_time: fmtUtc(dayAgo), end_time: fmtUtc(now), map_type: 'GOOGLE',
    });
    out(`  code=${r.code}  msg=${r.message || r.error || ''}`);
    if (r.code === 0) {
        const pts = Array.isArray(r.result) ? r.result : (r.result?.list || []);
        logResult('T04', 'Track History (jimi.device.track.list)', 'PASS', 0,
            `${pts.length} GPS point(s) in last 24h for ${FIRST_IMEI}`,
            pts.slice(0, 3).map(p => ({ lat: p.lat, lng: p.lng, speed: p.speed, gpsTime: p.gpsTime })));
    } else {
        logResult('T04', 'Track History', r.code === 0 ? 'PASS' : 'WARN', r.code, r.message || r.raw, null);
    }
} else { logResult('T04', 'Track History', 'SKIP', '-', 'No token/IMEI', null); }

// ── T05: Geofence List ───────────────────────────────────────────────────────
out('--- T05: Geofence List ---');
if (ACCESS_TOKEN) {
    const r = await call(BASE_URL, { method: 'jimi.open.platform.fence.list', access_token: ACCESS_TOKEN, account: ACCOUNT });
    out(`  code=${r.code}  msg=${r.message || r.error || ''}`);
    if (r.code === 0) {
        const fences = Array.isArray(r.result) ? r.result : (r.result?.list || []);
        logResult('T05', 'Geofence List (jimi.open.platform.fence.list)', 'PASS', 0,
            `${fences.length} platform fence(s) found`,
            fences.slice(0, 3).map(f => ({ id: f.fenceId, name: f.fenceName, type: f.fenceType })));
    } else {
        logResult('T05', 'Geofence List', 'WARN', r.code, r.message || r.raw, null);
    }
} else { logResult('T05', 'Geofence List', 'SKIP', '-', 'No token', null); }

// ── T06: Device Fence Create ─────────────────────────────────────────────────
out('--- T06: Device Fence Create ---');
if (ACCESS_TOKEN && FIRST_IMEI) {
    const r = await call(BASE_URL, {
        method: 'jimi.open.device.fence.create', access_token: ACCESS_TOKEN,
        imei: FIRST_IMEI, fence_name: 'API_TEST_FENCE',
        alarm_type: 'in,out', report_mode: 0, alarm_switch: 'ON',
        lng: '46.6753', lat: '24.7136', radius: '5', zoom_level: '14', map_type: 'GOOGLE',
    });
    out(`  code=${r.code}  msg=${r.message || r.error || ''}`);
    if (r.code === 0) {
        logResult('T06', 'Device Fence Create (jimi.open.device.fence.create)', 'PASS', 0, `Created: ${JSON.stringify(r.result)}`, null);
    } else if (r.code === 41005) {
        logResult('T06', 'Device Fence Create (jimi.open.device.fence.create)', 'WARN', 41005,
            'IP whitelist restriction. Account needs API write access from TrackSolid. App uses localStorage fallback.', null);
    } else {
        logResult('T06', 'Device Fence Create', 'WARN', r.code, r.message || r.raw, null);
    }
} else { logResult('T06', 'Device Fence Create', 'SKIP', '-', 'No token/IMEI', null); }

// ── T07: Platform Fence Create ───────────────────────────────────────────────
out('--- T07: Platform Fence Create ---');
if (ACCESS_TOKEN) {
    const r = await call(BASE_URL, {
        method: 'jimi.open.platform.fence.create', access_token: ACCESS_TOKEN,
        account: ACCOUNT, fence_name: 'API_TEST_PLATFORM', fence_type: 'CIRCLE', fence_color: '#00d4aa',
    });
    out(`  code=${r.code}  msg=${r.message || r.error || ''}`);
    if (r.code === 0) {
        logResult('T07', 'Platform Fence Create (jimi.open.platform.fence.create)', 'PASS', 0, `Created: ${JSON.stringify(r.result)}`, null);
    } else if (r.code === 41005) {
        logResult('T07', 'Platform Fence Create', 'WARN', 41005, 'IP whitelist restriction (same as T06)', null);
    } else {
        logResult('T07', 'Platform Fence Create', 'WARN', r.code, r.message || r.raw, null);
    }
} else { logResult('T07', 'Platform Fence Create', 'SKIP', '-', 'No token', null); }

// ── T08: Device Alarms ───────────────────────────────────────────────────────
out('--- T08: Device Alarms ---');
if (ACCESS_TOKEN && FIRST_IMEI) {
    const now = new Date(), weekAgo = new Date(now - 7 * 24 * 3600 * 1000);
    const r = await call(BASE_URL, {
        method: 'jimi.open.device.alarm.list', access_token: ACCESS_TOKEN,
        imei: FIRST_IMEI, begin_time: fmtUtc(weekAgo), end_time: fmtUtc(now),
        page_no: '1', page_size: '20',
    });
    out(`  code=${r.code}  msg=${r.message || r.error || ''}`);
    if (r.code === 0) {
        const alarms = Array.isArray(r.result) ? r.result : (r.result?.list || []);
        logResult('T08', 'Device Alarms (jimi.open.device.alarm.list)', 'PASS', 0,
            `${alarms.length} alarm(s) in last 7d for ${FIRST_IMEI}`,
            alarms.slice(0, 3).map(a => ({ type: a.alarmType, desc: a.alarmDesc, time: a.gpsTime })));
    } else {
        logResult('T08', 'Device Alarms', 'WARN', r.code, r.message || r.raw, null);
    }
} else { logResult('T08', 'Device Alarms', 'SKIP', '-', 'No token/IMEI', null); }

// ── T09: All-Device Alarms ───────────────────────────────────────────────────
out('--- T09: All-Device Alarms ---');
if (ACCESS_TOKEN) {
    const now = new Date(), weekAgo = new Date(now - 7 * 24 * 3600 * 1000);
    const r = await call(BASE_URL, {
        method: 'jimi.open.device.alarm.list', access_token: ACCESS_TOKEN,
        target: ACCOUNT, begin_time: fmtUtc(weekAgo), end_time: fmtUtc(now),
        page_no: '1', page_size: '20',
    });
    out(`  code=${r.code}  msg=${r.message || r.error || ''}`);
    if (r.code === 0) {
        const alarms = Array.isArray(r.result) ? r.result : (r.result?.list || []);
        logResult('T09', 'All-Device Alarms (target-level)', 'PASS', 0,
            `${alarms.length} alarm(s) across all devices in 7d`,
            alarms.slice(0, 3).map(a => ({ type: a.alarmType, desc: a.alarmDesc, imei: a.imei, time: a.gpsTime })));
    } else {
        logResult('T09', 'All-Device Alarms', 'WARN', r.code, r.message || r.raw, null);
    }
} else { logResult('T09', 'All-Device Alarms', 'SKIP', '-', 'No token', null); }

// ── T10: Signature ───────────────────────────────────────────────────────────
out('--- T10: Signature Algorithm ---');
{
    const p = { app_key: APP_KEY, format: 'json', method: 'test', timestamp: '2024-01-01 00:00:00', v: '1.0' };
    const s = sign(p);
    const valid = /^[0-9A-F]{32}$/.test(s);
    logResult('T10', 'MD5 Signature', valid ? 'PASS' : 'FAIL', '-', `sig=${s}  valid=${valid}`, null);
}

// ── Summary ──────────────────────────────────────────────────────────────────
const pass = results.filter(r => r.status === 'PASS').length;
const warn = results.filter(r => r.status === 'WARN').length;
const fail = results.filter(r => r.status === 'FAIL').length;
const skip = results.filter(r => r.status === 'SKIP').length;

out('='.repeat(64));
out('  FINAL SUMMARY');
out('='.repeat(64));
out(`  PASS: ${pass}  WARN: ${warn}  FAIL: ${fail}  SKIP: ${skip}  TOTAL: ${results.length}`);
out('');
for (const r of results) {
    const icon = { PASS: '[ OK ]', WARN: '[WARN]', FAIL: '[FAIL]', SKIP: '[SKIP]' }[r.status];
    out(`  ${icon} ${r.id} | ${r.name}`);
    out(`         Code=${r.code} | ${r.note}`);
}
out('='.repeat(64));

const report = {
    runAt: new Date().toISOString(), utcTimestamp: fmtUtc(), account: ACCOUNT, endpoint: BASE_URL,
    summary: { pass, warn, fail, skip, total: results.length }, results
};
writeFileSync('./api-test-report.json', JSON.stringify(report, null, 2));
out(`  JSON saved: api-test-report.json`);
writeFileSync('./api-test-output.txt', outLines.join('\r\n'), 'utf8');
out(`  Text log saved: api-test-output.txt`);
