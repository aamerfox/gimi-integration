/**
 * GIMI IoT API - Try all known regional endpoints
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

// All known Jimi IoT / GIMI regional endpoints
const ENDPOINTS = [
    'http://open.10000track.com/route/rest',
    'https://open.10000track.com/route/rest',
    'http://open.jimicloud.com/route/rest',
    'https://open.jimicloud.com/route/rest',
    'http://hk.open.jimicloud.com/route/rest',
    'https://hk.open.jimicloud.com/route/rest',
    'http://eu.open.jimicloud.com/route/rest',
    'https://eu.open.jimicloud.com/route/rest',
    'http://us.open.jimicloud.com/route/rest',
    'https://us.open.jimicloud.com/route/rest',
    'http://sa.open.jimicloud.com/route/rest',
    'https://sa.open.jimicloud.com/route/rest',
    'http://open.atrack.com.tw/route/rest',
    'https://open.atrack.com.tw/route/rest',
    'http://open.tracksolidpro.com/route/rest',
    'https://open.tracksolidpro.com/route/rest',
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

    const fullUrl = `${url}?${qs}`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(fullUrl, { signal: controller.signal });
        clearTimeout(timeout);
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); } catch { json = { raw: text }; }

        const pass = json.code === 0;
        L(`  ${pass ? 'PASS' : 'FAIL'} | ${url}`);
        L(`       code=${json.code}, message=${json.message || json.raw?.substring(0, 50)}`);
        if (pass && json.result) {
            L(`       TOKEN: ${JSON.stringify(json.result).substring(0, 80)}...`);
        }
        return json;
    } catch (err) {
        L(`  SKIP | ${url}`);
        L(`       ${err.name === 'AbortError' ? 'TIMEOUT (8s)' : err.message}`);
        return null;
    }
}

async function main() {
    L('=== GIMI Regional Endpoint Test ===');
    L(`Time: ${new Date().toISOString()}`);
    L(`Testing ${ENDPOINTS.length} endpoints...\n`);

    for (const endpoint of ENDPOINTS) {
        const result = await testEndpoint(endpoint);
        if (result?.code === 0) {
            L(`\n*** SUCCESS! Working endpoint found: ${endpoint} ***`);
            break;
        }
    }

    const output = log.join('\n');
    fs.writeFileSync('test-endpoints.txt', output, 'utf8');
    console.log('Done! Results in test-endpoints.txt');
}

main().catch(console.error);
