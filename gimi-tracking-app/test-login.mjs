/**
 * GIMI IoT API - Minimal Login Test
 * Tests authentication with verbose output
 */
import crypto from 'crypto';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';
const BASE_URL = 'http://open.10000track.com/route/rest';

const ACCOUNT = 'GBH2025';
const PASSWORD_RAW = '4a026bcce174570b8b0411600017f2f2';

function generateSignature(params) {
    const sortedKeys = Object.keys(params).sort();
    let paramString = APP_SECRET;
    for (const key of sortedKeys) {
        if (key === 'sign') continue;
        paramString += `${key}${params[key]}`;
    }
    paramString += APP_SECRET;
    const sig = crypto.createHash('md5').update(paramString).digest('hex').toUpperCase();
    console.log('  Signature input:', paramString.substring(0, 80) + '...');
    console.log('  Signature:', sig);
    return sig;
}

function getTimestamp() {
    const now = new Date();
    const pad = (n) => n < 10 ? `0${n}` : n;
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

async function testLogin(label, pwdMd5) {
    console.log(`\n--- ${label} ---`);
    console.log(`  user_pwd_md5: ${pwdMd5}`);

    const params = {
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp: getTimestamp(),
        v: '1.0',
        method: 'jimi.oauth.token.get',
        user_id: ACCOUNT,
        user_pwd_md5: pwdMd5,
        expires_in: 7200,
    };

    params.sign = generateSignature(params);

    const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');

    const url = `${BASE_URL}?${qs}`;
    console.log(`  URL length: ${url.length}`);

    try {
        const res = await fetch(url);
        const text = await res.text();
        console.log(`  HTTP Status: ${res.status}`);
        console.log(`  Raw response: ${text}`);

        try {
            const json = JSON.parse(text);
            console.log(`  code: ${json.code}`);
            console.log(`  message: ${json.message}`);
            if (json.result) {
                console.log(`  result:`, JSON.stringify(json.result, null, 2));
            }
            return json;
        } catch (e) {
            console.log('  (not JSON)');
            return null;
        }
    } catch (err) {
        console.error(`  Fetch error: ${err.message}`);
        return null;
    }
}

async function main() {
    console.log('=== GIMI API Login Test ===');
    console.log(`Account: ${ACCOUNT}`);
    console.log(`App Key: ${APP_KEY}`);
    console.log(`App Secret: ${APP_SECRET}`);

    // Attempt 1: Password as-is (already MD5)
    const r1 = await testLogin('Attempt 1: Password as-is (already MD5)', PASSWORD_RAW);

    // Attempt 2: MD5 of the password
    const md5pwd = crypto.createHash('md5').update(PASSWORD_RAW).digest('hex');
    const r2 = await testLogin('Attempt 2: MD5(password)', md5pwd);

    // Attempt 3: Lowercase of password as-is
    const r3 = await testLogin('Attempt 3: Password lowercase', PASSWORD_RAW.toLowerCase());

    console.log('\n=== Summary ===');
    console.log(`Attempt 1 (as-is):    code=${r1?.code}, msg=${r1?.message}`);
    console.log(`Attempt 2 (md5):      code=${r2?.code}, msg=${r2?.message}`);
    console.log(`Attempt 3 (lower):    code=${r3?.code}, msg=${r3?.message}`);
}

main().catch(console.error);
