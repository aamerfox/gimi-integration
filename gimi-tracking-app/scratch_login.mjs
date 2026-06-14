import crypto from 'crypto';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';
const BASE_URL = 'https://eu-open.tracksolidpro.com/route/rest';
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

async function call(endpoint, method, extra = {}) {
    const params = { method, app_key: APP_KEY, format: 'json', sign_method: 'md5', timestamp: getUTCTimestamp(), v: '1.0', ...extra };
    params.sign = sign(params);
    const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const url = `${endpoint}?${qs}`;
    console.log(`Calling endpoint: ${endpoint}`);
    const res = await fetch(url);
    return res.json();
}

async function main() {
    const endpoints = [
        'https://hk-open.tracksolidpro.com/route/rest',
        'https://eu-open.tracksolidpro.com/route/rest',
        'https://us-open.tracksolidpro.com/route/rest'
    ];
    for (const ep of endpoints) {
        try {
            const login = await call(ep, 'jimi.oauth.token.get', { user_id: ACCOUNT, user_pwd_md5: PASSWORD_MD5, expires_in: 7200 });
            console.log(`Response from ${ep}:`, login);
        } catch (err) {
            console.error(`Error on ${ep}:`, err.message);
        }
    }
}
main().catch(console.error);
