import crypto from 'crypto';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';

const ENDPOINTS = [
    'https://eu-open.tracksolidpro.com/route/rest',
    'https://hk-open.tracksolidpro.com/route/rest',
    'https://us-open.tracksolidpro.com/route/rest',
];

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

async function testDirect(url, account, passwordMd5) {
    const ts = getUTCTimestamp();
    const params = {
        method: 'jimi.oauth.token.get',
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp: ts,
        v: '1.0',
        user_id: account,
        user_pwd_md5: passwordMd5,
        expires_in: 7200,
    };
    params.sign = generateSignature(params);

    const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');

    try {
        const res = await fetch(`${url}?${qs}`, { method: 'POST' });
        const text = await res.text();
        console.log(`Endpoint: ${url} | Account: ${account}`);
        console.log(`Status: ${res.status} | Body: ${text}`);
    } catch (err) {
        console.error(`Error for ${url}:`, err.message);
    }
}

async function main() {
    for (const ep of ENDPOINTS) {
        await testDirect(ep, 'saudiex', '4a026bcce174570b8b0411600017f2f2');
        await testDirect(ep, 'celorvx', 'f957a13a22549e419540196068eadbc7');
        await testDirect(ep, 'GBH2025', '4a026bcce174570b8b0411600017f2f2');
    }
}

main().catch(console.error);
