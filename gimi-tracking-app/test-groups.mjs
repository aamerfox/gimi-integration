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

async function callApi(method, extraParams = {}) {
    const params = {
        method,
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp: getUTCTimestamp(),
        v: '1.0',
        ...extraParams,
    };
    params.sign = generateSignature(params);

    const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');

    try {
        const res = await fetch(`${BASE_URL}?${qs}`);
        const text = await res.text();
        try { return JSON.parse(text); } catch { return { raw: text }; }
    } catch (err) {
        return { error: err.message };
    }
}

async function main() {
    const loginRes = await callApi('jimi.oauth.token.get', {
        user_id: ACCOUNT,
        user_pwd_md5: PASSWORD_MD5,
        expires_in: 7200,
    });

    const token = loginRes.result.accessToken || loginRes.result.access_token;

    // Try to get groups
    console.log("Checking for Group APIs...");

    const attempts = [
        { method: 'jimi.device.group.list', param: { access_token: token, account: ACCOUNT } },
        { method: 'jimi.user.group.list', param: { access_token: token, account: ACCOUNT } }
    ];

    for (const item of attempts) {
        const res = await callApi(item.method, item.param);
        console.log(`Method: ${item.method} - Code: ${res.code}, Msg: ${res.message}`);
        if (res.code === 0) {
            console.log("SUCCESS:", res.result);
        }
    }
}

main().catch(console.error);
