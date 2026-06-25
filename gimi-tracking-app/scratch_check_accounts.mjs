import crypto from 'crypto';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';
const PROXY_URL = 'http://84.8.118.119/token';

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

async function testLogin(account, passwordMd5) {
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
        const res = await fetch(`${PROXY_URL}?${qs}`, { method: 'GET' });
        const text = await res.text();
        console.log(`Account: ${account} | pwdMd5: ${passwordMd5}`);
        console.log(`Status: ${res.status}`);
        console.log(`Body: ${text}\n`);
        return JSON.parse(text);
    } catch (err) {
        console.error(`Error for ${account}:`, err.message);
        return null;
    }
}

async function main() {
    const combinations = [
        { account: 'saudiex', pwd: '4a026bcce174570b8b0411600017f2f2' },
        { account: 'saudiex', pwd: crypto.createHash('md5').update('4a026bcce174570b8b0411600017f2f2').digest('hex') },
        { account: 'celorvx', pwd: 'f957a13a22549e419540196068eadbc7' },
        { account: 'GBH2025', pwd: '4a026bcce174570b8b0411600017f2f2' }
    ];

    for (const comb of combinations) {
        await testLogin(comb.account, comb.pwd);
    }
}

main().catch(console.error);
