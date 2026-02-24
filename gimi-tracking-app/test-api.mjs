/**
 * GIMI IoT API Integration Test Script
 * Tests all 5 API endpoints with provided credentials
 */
import crypto from 'crypto';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';
const BASE_URL = 'http://open.10000track.com/route/rest';

const ACCOUNT = 'GBH2025';
// The provided password looks like an MD5 hash already (32 hex chars)
const PASSWORD_MD5 = '4a026bcce174570b8b0411600017f2f2';

// Helper: generate signature
function generateSignature(params) {
    const sortedKeys = Object.keys(params).sort();
    let paramString = APP_SECRET;
    for (const key of sortedKeys) {
        if (key === 'sign') continue;
        paramString += `${key}${params[key]}`;
    }
    paramString += APP_SECRET;
    return crypto.createHash('md5').update(paramString).digest('hex').toUpperCase();
}

// Helper: get current timestamp
function getTimestamp() {
    const now = new Date();
    const pad = (n) => n < 10 ? `0${n}` : n;
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

// Helper: make API call
async function callApi(method, extraParams = {}) {
    const commonParams = {
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp: getTimestamp(),
        v: '1.0',
        method: method,
    };

    const allParams = { ...commonParams, ...extraParams };
    allParams.sign = generateSignature(allParams);

    const queryString = Object.entries(allParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');

    const url = `${BASE_URL}?${queryString}`;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Calling: ${method}`);
    console.log(`URL: ${url.substring(0, 120)}...`);

    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(data, null, 2));
        return data;
    } catch (err) {
        console.error(`ERROR:`, err.message);
        return null;
    }
}

// ===================== TESTS =====================

async function main() {
    console.log('🚀 GIMI IoT API Integration Test');
    console.log(`Account: ${ACCOUNT}`);
    console.log(`Timestamp: ${getTimestamp()}`);
    console.log(`App Key: ${APP_KEY.substring(0, 12)}...`);

    // ────────────────────────────────────────────
    // TEST 1: Login (password as-is, assuming already MD5)
    // ────────────────────────────────────────────
    console.log('\n\n📌 TEST 1: Login (password as pre-hashed MD5)');
    let loginResult = await callApi('jimi.oauth.token.get', {
        user_id: ACCOUNT,
        user_pwd_md5: PASSWORD_MD5,
        expires_in: 7200,
    });

    // If login failed, try MD5-hashing the password (in case it's plaintext)
    if (!loginResult || loginResult.code !== 0) {
        console.log('\n⚠️  First attempt failed. Trying MD5-hashing the password...');
        const doubleHashed = crypto.createHash('md5').update(PASSWORD_MD5).digest('hex');
        loginResult = await callApi('jimi.oauth.token.get', {
            user_id: ACCOUNT,
            user_pwd_md5: doubleHashed,
            expires_in: 7200,
        });
    }

    if (!loginResult || loginResult.code !== 0) {
        console.log('\n❌ LOGIN FAILED — cannot proceed with further tests.');
        console.log('Possible causes:');
        console.log('  1. Wrong credentials');
        console.log('  2. Signature algorithm mismatch');
        console.log('  3. Account not active on GIMI platform');
        return;
    }

    const accessToken = loginResult.result?.accessToken || loginResult.result?.access_token;
    console.log(`\n✅ LOGIN SUCCESS! Token: ${accessToken?.substring(0, 20)}...`);

    // ────────────────────────────────────────────
    // TEST 2: Device List
    // ────────────────────────────────────────────
    console.log('\n\n📌 TEST 2: Device List');
    const devicesResult = await callApi('jimi.user.device.list', {
        access_token: accessToken,
        target: ACCOUNT,
    });

    let deviceCount = 0;
    let firstImei = null;
    if (devicesResult?.code === 0 && devicesResult?.result) {
        const devices = Array.isArray(devicesResult.result) ? devicesResult.result : [];
        deviceCount = devices.length;
        firstImei = devices[0]?.imei;
        console.log(`✅ Found ${deviceCount} devices`);
        devices.slice(0, 5).forEach((d, i) => {
            console.log(`   ${i + 1}. ${d.deviceName || d.imei} (IMEI: ${d.imei}, Status: ${d.status})`);
        });
        if (deviceCount > 5) console.log(`   ... and ${deviceCount - 5} more`);
    } else {
        console.log('⚠️  No devices returned or error');
    }

    // ────────────────────────────────────────────
    // TEST 3: Device Locations
    // ────────────────────────────────────────────
    console.log('\n\n📌 TEST 3: Device Locations');
    const locResult = await callApi('jimi.user.device.location.list', {
        access_token: accessToken,
        target: ACCOUNT,
        map_type: 'GOOGLE',
    });

    if (locResult?.code === 0 && locResult?.result) {
        const locs = Array.isArray(locResult.result) ? locResult.result : [];
        console.log(`✅ Got locations for ${locs.length} devices`);
        locs.slice(0, 5).forEach((l, i) => {
            console.log(`   ${i + 1}. IMEI: ${l.imei} → ${l.lat}, ${l.lng} (Speed: ${l.speed}, GPS: ${l.gpsTime})`);
        });
    } else {
        console.log('⚠️  No locations returned or error');
    }

    // ────────────────────────────────────────────
    // TEST 4: Track History (last 24 hours, first device)
    // ────────────────────────────────────────────
    if (firstImei) {
        console.log('\n\n📌 TEST 4: Track History (last 24h)');
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const pad = (n) => n < 10 ? `0${n}` : n;
        const beginTime = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())} ${pad(yesterday.getHours())}:${pad(yesterday.getMinutes())}:${pad(yesterday.getSeconds())}`;
        const endTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

        console.log(`   Device: ${firstImei}`);
        console.log(`   Range: ${beginTime} → ${endTime}`);

        const trackResult = await callApi('jimi.device.track.list', {
            access_token: accessToken,
            imei: firstImei,
            begin_time: beginTime,
            end_time: endTime,
            map_type: 'GOOGLE',
        });

        if (trackResult?.code === 0 && trackResult?.result) {
            const points = Array.isArray(trackResult.result) ? trackResult.result : [];
            console.log(`✅ Got ${points.length} track points`);
            if (points.length > 0) {
                console.log(`   First: ${points[0].lat}, ${points[0].lng} at ${points[0].gpsTime}`);
                console.log(`   Last:  ${points[points.length - 1].lat}, ${points[points.length - 1].lng} at ${points[points.length - 1].gpsTime}`);
            }
        } else {
            console.log('⚠️  No track data returned (device may not have moved in 24h)');
        }
    }

    // ────────────────────────────────────────────
    // TEST 5: Geofences
    // ────────────────────────────────────────────
    console.log('\n\n📌 TEST 5: Geofences');
    const fenceResult = await callApi('jimi.open.platform.fence.list', {
        access_token: accessToken,
        account: ACCOUNT,
    });

    if (fenceResult?.code === 0 && fenceResult?.result) {
        const fences = Array.isArray(fenceResult.result) ? fenceResult.result : [];
        console.log(`✅ Found ${fences.length} geofences`);
        fences.slice(0, 5).forEach((f, i) => {
            console.log(`   ${i + 1}. ${f.fenceName || f.name} (Radius: ${f.radius}m)`);
        });
    } else {
        console.log('⚠️  No geofences or error');
    }

    // ────────────────────────────────────────────
    // SUMMARY
    // ────────────────────────────────────────────
    console.log(`\n\n${'='.repeat(60)}`);
    console.log('📊 TEST SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Login:          ${loginResult?.code === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`${devicesResult?.code === 0 ? '✅' : '❌'} Device List:     ${devicesResult?.code === 0 ? `PASS (${deviceCount} devices)` : 'FAIL'}`);
    console.log(`${locResult?.code === 0 ? '✅' : '❌'} Locations:        ${locResult?.code === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`${fenceResult?.code === 0 ? '✅' : '❌'} Geofences:        ${fenceResult?.code === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`${'='.repeat(60)}\n`);
}

main().catch(console.error);
