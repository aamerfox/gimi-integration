import axios from 'axios';
import CryptoJS from 'crypto-js';

const PROXY_URL = 'https://saudiex-tracker-256825749353.europe-west10.run.app/token';
const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';

const ACCOUNT = 'celorvx';
const PASSWORD_RAW = 'Tracksolid@2024';
const PASSWORD_MD5 = CryptoJS.MD5(PASSWORD_RAW).toString();

const api = axios.create({
    baseURL: PROXY_URL,
    timeout: 15000,
});

const generateSignature = (params) => {
    const sortedKeys = Object.keys(params).sort();
    let paramString = APP_SECRET;
    for (const key of sortedKeys) {
        if (key === 'sign') continue;
        paramString += key + String(params[key]);
    }
    paramString += APP_SECRET;
    return CryptoJS.MD5(paramString).toString().toUpperCase();
};

const pad = (n) => String(n).padStart(2, '0');

api.interceptors.request.use((config) => {
    const now = new Date();
    const timestamp = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;

    const commonParams = {
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp,
        v: '1.0',
    };

    const privateParams = config.data || config.params || {};
    const allParams = { ...commonParams, ...privateParams };

    allParams.sign = generateSignature(allParams);

    config.params = allParams;
    config.data = undefined;

    return config;
});

async function main() {
    try {
        console.log("Attempting login via Axios + Cloud Run Proxy...");
        const res = await api.post('', {
            method: 'jimi.oauth.token.get',
            user_id: ACCOUNT,
            user_pwd_md5: PASSWORD_MD5,
            expires_in: 7200,
        });
        console.log("SUCCESS!", JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error("FAILED!", err.message);
        if (err.response) {
            console.error("Response Status:", err.response.status);
            console.error("Response Body:", JSON.stringify(err.response.data));
        }
    }
}

main().catch(console.error);
