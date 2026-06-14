import crypto from 'crypto';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';
const DIRECT_URL = 'https://eu-open.tracksolidpro.com/route/rest';
const PROXY_URL = 'https://saudiex-tracker-256825749353.europe-west10.run.app/token';

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

async function test(url, label) {
    console.log(`\n--- Test: ${label} (${url}) ---`);
    const params = {
        method: 'jimi.oauth.token.get',
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp: getUTCTimestamp(),
        v: '1.0',
        user_id: ACCOUNT,
        user_pwd_md5: PASSWORD_MD5,
        expires_in: 7200,
    };
    params.sign = sign(params);

    const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');

    try {
        const res = await fetch(`${url}?${qs}`, { method: 'POST' });
        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${text}`);
    } catch (err) {
        console.error(`Error: ${err.message}`);
    }
}

async function run() {
    await test(DIRECT_URL, 'Direct to TrackSolid');
    await test(PROXY_URL, 'Through Cloud Run Proxy');
}

run().catch(console.error);
