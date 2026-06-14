import crypto from 'crypto';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';
const BASE_URL = 'https://eu-open.tracksolidpro.com/route/rest';
const ACCOUNT = 'GBH2025';
const PASSWORD_MD5 = '4a026bcce174570b8b0411600017f2f2';

const pad = (n) => String(n).padStart(2, '0');
const fmtUtc = (d = new Date()) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;

function sign(params) {
    const keys = Object.keys(params).sort();
    let s = APP_SECRET;
    for (const k of keys) { 
        if (k !== 'sign') s += `${k}${params[k]}`; 
    }
    return crypto.createHash('md5').update(s + APP_SECRET).digest('hex').toUpperCase();
}

async function call(method, extra = {}) {
    const params = { 
        method, 
        app_key: APP_KEY, 
        format: 'json', 
        sign_method: 'md5', 
        timestamp: fmtUtc(), 
        v: '1.0', 
        ...extra 
    };
    params.sign = sign(params);
    const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    
    const res = await fetch(BASE_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, 
        body: qs 
    });
    return res.json();
}

async function main() {
    console.log("Current System Time (Local):", new Date().toString());
    console.log("Current UTC Time:            ", new Date().toUTCString());
    
    // Login
    const login = await call('jimi.oauth.token.get', { user_id: ACCOUNT, user_pwd_md5: PASSWORD_MD5, expires_in: 7200 });
    if (!login.result) {
        console.error("Login failed:", login);
        return;
    }
    
    let token = null;
    if (typeof login.result === 'string') {
        token = login.result;
    } else if (login.result?.accessToken) {
        token = login.result.accessToken;
    } else if (login.result?.access_token) {
        token = login.result.access_token;
    }
    
    if (!token) {
        console.error("Could not extract token from login response:", login);
        return;
    }
    console.log("Login OK, Token acquired.");

    // Live locations
    const locs = await call('jimi.user.device.location.list', { access_token: token, target: ACCOUNT, map_type: 'GOOGLE' });
    console.log("\n=== Live Location Raw Result ===");
    console.log(JSON.stringify(locs, null, 2));

    // Get Track History (last few hours)
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const formatTime = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    
    const beginTimeStr = formatTime(sixHoursAgo);
    const endTimeStr = formatTime(now);
    
    console.log(`\nQuerying history from ${beginTimeStr} to ${endTimeStr}...`);
    
    // Let's get the target device imei
    if (locs.result && locs.result.length > 0) {
        const imei = locs.result[0].imei;
        const history = await call('jimi.device.track.list', {
            access_token: token,
            imei: imei,
            begin_time: beginTimeStr,
            end_time: endTimeStr,
            map_type: 'GOOGLE'
        });
        console.log("\n=== History Raw Result (Sample points) ===");
        if (history.result && history.result.length > 0) {
            console.log("Number of track points:", history.result.length);
            console.log("First point:", JSON.stringify(history.result[0]));
            console.log("Last point :", JSON.stringify(history.result[history.result.length - 1]));
        } else {
            console.log("No track history returned.");
            console.log(JSON.stringify(history, null, 2));
        }
    }
}

main().catch(console.error);
