import crypto from 'crypto';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';
const PROXY_URL = 'https://saudiex-tracker-256825749353.europe-west10.run.app/token';

const ACCOUNT = 'celorvx';
const PASSWORD_RAW = '4a026bcce174570b8b0411600017f2f2';

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

async function runTest() {
    const ts = getUTCTimestamp();
    const loginParams = {
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
    loginParams.sign = generateSignature(loginParams);

    console.log('--- Test 1: POST with Query Parameters in URL (Web Pattern) ---');
    const loginQs = Object.entries(loginParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');

    try {
        const res = await fetch(`${PROXY_URL}?${loginQs}`, { method: 'POST' });
        const text = await res.text();
        console.log('Query Params Response Status:', res.status);
        console.log('Query Params Response Body:', text);
    } catch (err) {
        console.error('Query Params Error:', err.message);
    }

    console.log('\n--- Test 2: POST with URL-Encoded Body (Mobile Pattern) ---');
    const bodyString = Object.entries(loginParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');

    try {
        const res = await fetch(PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: bodyString,
        });
        const text = await res.text();
        console.log('URL-Encoded Body Response Status:', res.status);
        console.log('URL-Encoded Body Response Body:', text);
    } catch (err) {
        console.error('URL-Encoded Body Error:', err.message);
    }
}

runTest().catch(console.error);
