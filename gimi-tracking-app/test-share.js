const crypto = require('crypto');
const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';

const pad = (n) => n < 10 ? '0' + n : n;
const now = new Date();
const timestamp = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;

const params = {
    app_key: APP_KEY,
    format: 'json',
    sign_method: 'md5',
    timestamp,
    v: '1.0',
    method: 'jimi.device.location.get',
    imei: '780901703177539', // From user
    access_token: 'e17b9f71e54ae4adc227dc32fc86af8c', // From user screenshot
    map_type: 'GOOGLE'
};

const generateSign = (p) => {
    const sortedKeys = Object.keys(p).sort();
    let paramString = APP_SECRET;
    for (const key of sortedKeys) {
        if (key === 'sign') continue;
        paramString += `${key}${p[key]}`;
    }
    paramString += APP_SECRET;
    return crypto.createHash('md5').update(paramString).digest('hex').toUpperCase();
};

params.sign = generateSign(params);

const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

console.log('Fetching:', `http://34.32.43.112/token?${queryString}`);

fetch(`http://34.32.43.112/token?${queryString}`, { method: 'GET' })
    .then(async (r) => {
        console.log('Status:', r.status);
        console.log('Headers:', Object.fromEntries(r.headers.entries()));
        console.log('Body:', await r.text());
    })
    .catch(console.error);
