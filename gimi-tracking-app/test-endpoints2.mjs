/**
 * Final batch - TrackSolid and other Jimi endpoints
 */
import crypto from 'crypto';
import fs from 'fs';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';
const ACCOUNT = 'GBH2025';
const PASSWORD_RAW = '4a026bcce174570b8b0411600017f2f2';

const log = [];
function L(msg) { log.push(msg); }

function getTimestamp() {
    const now = new Date();
    const pad = (n) => n < 10 ? `0${n}` : n;
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
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

const ENDPOINTS = [
    // TrackSolid Pro variants
    'http://open.tracksolidpro.com/route/rest',
    'https://open.tracksolidpro.com/route/rest',
    // TrackSolid (non-Pro)
    'http://open.tracksolid.com/route/rest',
    'https://open.tracksolid.com/route/rest',
    // Jimi direct
    'http://open.jimilab.com/route/rest',
    'https://open.jimilab.com/route/rest',
    'http://openapi.jimilab.com/route/rest',
    'https://openapi.jimilab.com/route/rest',
    // Jimi IoT
    'http://open.jimiiot.com/route/rest',
    'https://open.jimiiot.com/route/rest',
    // Region specific
    'http://open-hk.10000track.com/route/rest',
    'http://open-eu.10000track.com/route/rest',
    'http://open-sa.10000track.com/route/rest',
    'http://open-me.10000track.com/route/rest',
];

async function testEndpoint(url) {
    const params = {
        method: 'jimi.oauth.token.get',
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp: getTimestamp(),
        v: '1.0',
        user_id: ACCOUNT,
        user_pwd_md5: PASSWORD_RAW,
        expires_in: 7200,
    };
    params.sign = generateSignature(params);

    const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${url}?${qs}`, { signal: controller.signal });
        clearTimeout(timeout);
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); } catch { json = { raw: text.substring(0, 100) }; }

        const status = json.code === 0 ? 'PASS' : `FAIL(${json.code})`;
        L(`  ${status} | ${url} | ${json.message || json.raw || ''}`);
        if (json.code === 0) {
            L(`  >>> TOKEN: ${JSON.stringify(json.result).substring(0, 100)}`);
        }
        return json;
    } catch (err) {
        L(`  SKIP | ${url} | ${err.name === 'AbortError' ? 'TIMEOUT' : err.message?.substring(0, 50)}`);
        return null;
    }
}

async function main() {
    L('=== GIMI Endpoint Test (Batch 2) ===');
    L(`Time: ${new Date().toISOString()}\n`);

    for (const ep of ENDPOINTS) {
        const result = await testEndpoint(ep);
        if (result?.code === 0) {
            L(`\n*** SUCCESS: ${ep} ***`);
            break;
        }
    }

    const output = log.join('\n');
    fs.writeFileSync('test-endpoints2.txt', output, 'utf8');
    console.log('Done! Results in test-endpoints2.txt');
}

main().catch(console.error);
