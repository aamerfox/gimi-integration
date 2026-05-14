/**
 * GIMI IoT API - Clean output test  
 * Write results to file to avoid encoding issues in terminal
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

function generateSignature(params, secret) {
    const sortedKeys = Object.keys(params).sort();
    let s = secret;
    for (const key of sortedKeys) {
        if (key === 'sign') continue;
        s += `${key}${params[key]}`;
    }
    s += secret;
    return crypto.createHash('md5').update(s).digest('hex').toUpperCase();
}

async function callApi(label, baseUrl, params, method = 'GET') {
    L(`\n--- ${label} ---`);
    const sign = generateSignature(params, APP_SECRET);
    params.sign = sign;

    const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');

    try {
        let res;
        if (method === 'POST') {
            res = await fetch(baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: qs,
            });
        } else {
            res = await fetch(`${baseUrl}?${qs}`);
        }
        const text = await res.text();
        L(`  HTTP ${res.status}`);
        L(`  Response: ${text}`);
        try { return JSON.parse(text); } catch { return { raw: text }; }
    } catch (err) {
        L(`  Error: ${err.message}`);
        return { error: err.message };
    }
}

async function main() {
    L('=== GIMI API Integration Test ===');
    L(`Time: ${new Date().toISOString()}`);
    L(`APP_KEY: ${APP_KEY}`);
    L(`APP_KEY length: ${APP_KEY.length}`);
    L(`APP_SECRET: ${APP_SECRET}`);

    const ts = getTimestamp();
    L(`Timestamp: ${ts}`);

    // Test 1: GET with query params (standard)
    const r1 = await callApi('Test 1: GET /route/rest', 'http://open.10000track.com/route/rest', {
        method: 'jimi.oauth.token.get',
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp: ts,
        v: '1.0',
        user_id: ACCOUNT,
        user_pwd_md5: PASSWORD_RAW,
        expires_in: 7200,
    });

    // Test 2: POST with form body
    const r2 = await callApi('Test 2: POST /route/rest', 'http://open.10000track.com/route/rest', {
        method: 'jimi.oauth.token.get',
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp: getTimestamp(),
        v: '1.0',
        user_id: ACCOUNT,
        user_pwd_md5: PASSWORD_RAW,
        expires_in: 7200,
    }, 'POST');

    // Test 3: HTTPS
    const r3 = await callApi('Test 3: HTTPS GET', 'https://open.10000track.com/route/rest', {
        method: 'jimi.oauth.token.get',
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp: getTimestamp(),
        v: '1.0',
        user_id: ACCOUNT,
        user_pwd_md5: PASSWORD_RAW,
        expires_in: 7200,
    });

    L('\n=== SUMMARY ===');
    L(`Test 1 (GET):  code=${r1?.code}, message=${r1?.message}`);
    L(`Test 2 (POST): code=${r2?.code}, message=${r2?.message}`);
    L(`Test 3 (HTTPS): code=${r3?.code}, message=${r3?.message}`);

    // If all failed with 1001, the APP_KEY is invalid
    if (r1?.code === 1001 || r2?.code === 1001) {
        L('\n=== DIAGNOSIS ===');
        L('All attempts returned code 1001 (Invalid AppKey).');
        L('This means the APP_KEY is not recognized by the GIMI platform.');
        L('Possible solutions:');
        L('  1. Verify the APP_KEY is correct (no extra/missing characters)');
        L('  2. Check if the app is activated on the GIMI developer portal');
        L('  3. Contact GIMI support to verify the app credentials');
    }

    // Write results  
    const output = log.join('\n');
    fs.writeFileSync('test-results.txt', output, 'utf8');
    console.log('Results written to test-results.txt');
}

main().catch(console.error);
