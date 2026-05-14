import MD5 from 'crypto-js/md5.js';
import axios from 'axios';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';

const generateSign = (params) => {
    const sortedKeys = Object.keys(params).sort();
    let paramString = APP_SECRET;
    for (const key of sortedKeys) {
        if (key === 'sign') continue;
        paramString += `${key}${params[key]}`;
    }
    paramString += APP_SECRET;
    return MD5(paramString).toString().toUpperCase();
};

const fetchGimiApi = async (method, extraParams) => {
    const pad = (n) => n < 10 ? `0${n}` : n;
    const now = new Date();
    const timestamp = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;

    const params = {
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp,
        v: '1.0',
        method,
        ...extraParams
    };
    params.sign = generateSign(params);

    const queryString = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');

    const res = await axios.get(`https://eu-open.tracksolidpro.com/route/rest?${queryString}`);
    return res.data;
};

async function test() {
    const res = await fetchGimiApi('jimi.device.location.get', {
        access_token: 'e5e37faab6daf21811aac3d3c65c82e6', // From the user's URL
        imeis: '780901807618889',
        map_type: 'GOOGLE'
    });
    console.log("Location result:", JSON.stringify(res, null, 2));

    let lat = 0; let lng = 0;
    if (res && res.code === 0 && Array.isArray(res.result) && res.result.length > 0) {
        lat = parseFloat(res.result[0].lat);
        lng = parseFloat(res.result[0].lng);
    }
    console.log("Parsed Lat:", lat, "Lng:", lng);
}

test();
