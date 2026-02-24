/**
 * GIMI/TrackSolid Pro - Comprehensive endpoint + auth test
 * Key fixes from documentation:
 * 1. Timestamp MUST be UTC (GMT+0), format: yyyy-MM-dd HH:mm:ss
 * 2. TrackSolid Pro uses regional endpoints: hk/eu/us-open.tracksolidpro.com
 * 3. Password MD5 must be lowercase
 */
import crypto from 'crypto';
import fs from 'fs';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';
const ACCOUNT = 'GBH2025';
const PASSWORD_RAW = '4a026bcce174570b8b0411600017f2f2';

const log = [];
function L(msg) { log.push(msg); }

// CRITICAL: Use UTC timestamp as per docs
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

// All known endpoints to test
const ENDPOINTS = [
    // TrackSolid Pro regional (official)
    'https://hk-open.tracksolidpro.com/route/rest',
    'https://eu-open.tracksolidpro.com/route/rest',
    'https://us-open.tracksolidpro.com/route/rest',
    // Non-HTTPS variants
    'http://hk-open.tracksolidpro.com/route/rest',
    'http://eu-open.tracksolidpro.com/route/rest',
    'http://us-open.tracksolidpro.com/route/rest',
    // Original 10000track with UTC timestamp (re-test)
    'http://open.10000track.com/route/rest',
    'https://open.10000track.com/route/rest',
];

async function testEndpoint(url, pwdLabel, pwd) {
    const ts = getUTCTimestamp();
    const params = {
        method: 'jimi.oauth.token.get',
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp: ts,
        v: '1.0',
        user_id: ACCOUNT,
        user_pwd_md5: pwd,
        expires_in: 7200,
    };
    params.sign = generateSignature(params);

    const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${url}?${qs}`, { signal: controller.signal });
        clearTimeout(timeout);
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); } catch { json = { raw: text.substring(0, 150) }; }

        const status = json.code === 0 ? 'PASS' : `FAIL(${json.code})`;
        L(`  ${status} | ${url} | pwd=${pwdLabel} | ts=${ts}`);
        L(`       msg: ${json.message || json.raw || 'N/A'}`);
        if (json.code === 0 && json.result) {
            L(`       TOKEN: ${JSON.stringify(json.result).substring(0, 120)}...`);
        }
        return json;
    } catch (err) {
        const reason = err.name === 'AbortError' ? 'TIMEOUT(10s)' : err.message?.substring(0, 80);
        L(`  SKIP | ${url} | ${reason}`);
        return null;
    }
}

async function main() {
    L('=== GIMI/TrackSolid Pro API Test (UTC + All Endpoints) ===');
    L(`Local time: ${new Date().toISOString()}`);
    L(`UTC timestamp: ${getUTCTimestamp()}`);
    L(`APP_KEY: ${APP_KEY} (length: ${APP_KEY.length})`);
    L(`APP_SECRET: ${APP_SECRET}`);
    L('');

    // Password variants
    const pwdVariants = [
        ['as-is', PASSWORD_RAW],
        ['md5(pwd)', crypto.createHash('md5').update(PASSWORD_RAW).digest('hex')],
    ];

    let found = false;

    for (const endpoint of ENDPOINTS) {
        for (const [label, pwd] of pwdVariants) {
            const result = await testEndpoint(endpoint, label, pwd);
            if (result?.code === 0) {
                L(`\n>>> SUCCESS! Endpoint: ${endpoint}, password: ${label} <<<`);
                found = true;
                break;
            }
        }
        if (found) break;
    }

    if (!found) {
        L('\n=== ALL ATTEMPTS FAILED ===');
        L('Possible causes:');
        L('  1. AppKey not yet activated on any TrackSolid Pro node');
        L('  2. AppKey belongs to a different platform (not TrackSolid Pro)');
        L('  3. AppKey/AppSecret pair is incorrect');
        L('  4. Account may be on a custom/private server');
    }

    const output = log.join('\n');
    fs.writeFileSync('test-tracksolid.txt', output, 'utf8');
    console.log('Done! Results in test-tracksolid.txt');
}

main().catch(console.error);
