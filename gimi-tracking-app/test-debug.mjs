/**
 * GIMI IoT API - Debug AppKey issue
 * The API returns code=1001 "Missing AppKey or invalid AppKey"
 * Testing different approaches
 */
import crypto from 'crypto';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';
const ACCOUNT = 'GBH2025';
const PASSWORD_RAW = '4a026bcce174570b8b0411600017f2f2';

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

async function testPost(label, baseUrl, params) {
    console.log(`\n--- ${label} ---`);
    const sign = generateSignature(params, APP_SECRET);
    params.sign = sign;

    const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');

    const url = `${baseUrl}?${qs}`;

    console.log(`  Full URL: ${url}`);
    console.log(`  app_key value: "${params.app_key}"`);
    console.log(`  app_key length: ${params.app_key.length}`);

    try {
        // Try GET  
        const res = await fetch(url);
        const text = await res.text();
        console.log(`  HTTP ${res.status}`);
        console.log(`  Response: ${text}`);
        return text;
    } catch (err) {
        console.error(`  Error: ${err.message}`);
        return null;
    }
}

async function main() {
    console.log('=== GIMI AppKey Debug ===');
    console.log(`APP_KEY: "${APP_KEY}"`);
    console.log(`APP_KEY length: ${APP_KEY.length}`);
    console.log(`APP_SECRET: "${APP_SECRET}"`);
    console.log(`APP_SECRET length: ${APP_SECRET.length}`);

    const ts = getTimestamp();

    // Test 1: Standard approach (as before)
    await testPost('Test 1: Standard GET /route/rest', 'http://open.10000track.com/route/rest', {
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

    // Test 2: Try POST with form data instead of query params
    console.log('\n--- Test 2: POST with form body ---');
    const params2 = {
        method: 'jimi.oauth.token.get',
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp: ts,
        v: '1.0',
        user_id: ACCOUNT,
        user_pwd_md5: PASSWORD_RAW,
        expires_in: 7200,
    };
    params2.sign = generateSignature(params2, APP_SECRET);

    const body = Object.entries(params2)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');

    try {
        const res = await fetch('http://open.10000track.com/route/rest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body,
        });
        const text = await res.text();
        console.log(`  HTTP ${res.status}`);
        console.log(`  Response: ${text}`);
    } catch (err) {
        console.error(`  Error: ${err.message}`);
    }

    // Test 3: Try lowercase app_key
    console.log('\n--- Test 3: Lowercase app_key ---');
    await testPost('Test 3: Lowercase key', 'http://open.10000track.com/route/rest', {
        method: 'jimi.oauth.token.get',
        app_key: APP_KEY.toLowerCase(),
        format: 'json',
        sign_method: 'md5',
        timestamp: getTimestamp(),
        v: '1.0',
        user_id: ACCOUNT,
        user_pwd_md5: PASSWORD_RAW,
        expires_in: 7200,
    });

    // Test 4: Try HTTPS
    console.log('\n--- Test 4: HTTPS endpoint ---');
    await testPost('Test 4: HTTPS', 'https://open.10000track.com/route/rest', {
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

    // Test 5: Try v=0.9
    console.log('\n--- Test 5: API version 0.9 ---');
    await testPost('Test 5: v=0.9', 'http://open.10000track.com/route/rest', {
        method: 'jimi.oauth.token.get',
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp: getTimestamp(),
        v: '0.9',
        user_id: ACCOUNT,
        user_pwd_md5: PASSWORD_RAW,
        expires_in: 7200,
    });
}

main().catch(console.error);
