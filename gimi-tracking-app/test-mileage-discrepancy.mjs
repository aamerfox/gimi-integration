/**
 * SaudiEx Tracker - Mileage Discrepancy & Verification Script
 * 
 * This script connects to the TrackSolid Pro API, downloads raw GPS history,
 * and calculates distance using all three modes ('all', 'optimized', 'precise')
 * to verify the mileage values shown in Trace+.
 * 
 * Usage:
 *   node test-mileage-discrepancy.mjs <ACCOUNT> <PASSWORD> [IMEI] [BEGIN_TIME] [END_TIME]
 * 
 * Example:
 *   node test-mileage-discrepancy.mjs GBH2025 4a026bcce174570b8b0411600017f2f2 990901807744356 "2026-06-16 18:07:00" "2026-06-17 18:07:00"
 */

import crypto from 'crypto';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';
const PROXY_URL = 'https://saudiex-tracker-256825749353.europe-west10.run.app/token';

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

async function callApi(method, extraParams) {
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

    const res = await fetch(`${PROXY_URL}?${qs}`, { method: 'POST' });
    const json = await res.json();
    if (json.code !== 0) {
        throw new Error(`API Error (code: ${json.code}): ${json.message || json.msg}`);
    }
    return json;
}

// Distance between coordinates in km (Haversine formula)
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Group stationary coordinates where speed < 2 km/h for >= 3 minutes
function detectStops(points, thresholdMinutes = 3) {
    const stops = [];
    if (points.length < 2) return stops;

    let stopStartIdx = -1;
    const thresholdMs = thresholdMinutes * 60 * 1000;

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const isStationary = p.speed < 2;

        if (isStationary) {
            if (stopStartIdx === -1) {
                stopStartIdx = i;
            }
        } else {
            if (stopStartIdx !== -1) {
                const startPoint = points[stopStartIdx];
                const endPoint = points[i - 1];
                const startTimeMs = new Date(startPoint.gpsTime.replace(' ', 'T') + 'Z').getTime();
                const endTimeMs = new Date(p.gpsTime.replace(' ', 'T') + 'Z').getTime();
                const durationMs = endTimeMs - startTimeMs;

                if (durationMs >= thresholdMs) {
                    stops.push({
                        lat: startPoint.lat,
                        lng: startPoint.lng,
                        startTime: startPoint.gpsTime,
                        endTime: endPoint.gpsTime,
                        durationMs,
                    });
                }
                stopStartIdx = -1;
            }
        }
    }
    return stops;
}

function filterTrackPoints(points, mode) {
    if (points.length === 0) return [];
    if (mode === 'all') return points;

    const filtered = [];
    const MAX_SPEED_KMH = mode === 'precise' ? 100 : 150;

    let prevPoint = null;
    let prevMs = 0;

    for (const pt of points) {
        if (!pt || pt.lat === undefined || pt.lng === undefined) continue;
        const lat = Number(pt.lat);
        const lng = Number(pt.lng);
        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

        if (mode === 'precise') {
            const posType = String(pt.posType || pt.positionType || 'GPS').toUpperCase();
            const isGps = 
                posType.includes('GPS') || 
                posType.includes('BDS') || 
                posType.includes('GLONASS') || 
                posType.includes('GLO') || 
                posType.includes('GALILEO') || 
                posType.includes('GNSS') || 
                posType === '0' || 
                posType === '4' || 
                posType === '5' || 
                posType === '6';
            if (!isGps) {
                continue;
            }
        }

        const s = pt.gpsTime || '';
        const currMs = s
            ? (() => { const d = new Date(s.replace(' ', 'T') + 'Z'); return isNaN(d.getTime()) ? 0 : d.getTime(); })()
            : 0;

        if (prevPoint) {
            const distKm = getDistance(prevPoint.lat, prevPoint.lng, lat, lng);
            const timeSec = currMs > 0 && prevMs > 0 ? (currMs - prevMs) / 1000 : 0;
            const speedKmh = timeSec > 0 ? (distKm / (timeSec / 3600)) : 0;

            if (timeSec > 0 && speedKmh > MAX_SPEED_KMH) {
                continue;
            }
        }

        filtered.push(pt);
        prevPoint = pt;
        prevMs = currMs;
    }

    return filtered;
}

function calculateTotalDistance(points) {
    let total = 0;
    let prevPoint = null;
    for (const pt of points) {
        if (!pt || pt.lat === undefined || pt.lng === undefined) continue;
        const lat = Number(pt.lat);
        const lng = Number(pt.lng);
        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;
        if (prevPoint) {
            total += getDistance(prevPoint.lat, prevPoint.lng, lat, lng);
        }
        prevPoint = pt;
    }
    return total;
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log("Usage: node test-mileage-discrepancy.mjs <ACCOUNT> <PASSWORD> [IMEI] [BEGIN_TIME] [END_TIME]");
        process.exit(1);
    }

    const account = args[0];
    const passwordRaw = args[1];
    const isMd5 = /^[a-f0-9]{32}$/i.test(passwordRaw);
    const passwordMd5 = isMd5 ? passwordRaw.toLowerCase() : crypto.createHash('md5').update(passwordRaw).digest('hex');

    const imei = args[2] || '990901807744356';
    const beginTime = args[3] || '2026-06-16 18:07:00';
    const endTime = args[4] || '2026-06-17 18:07:00';

    console.log(`=== SaudiEx Tracker Mileage Discrepancy Test ===`);
    console.log(`Account:    ${account}`);
    console.log(`IMEI:       ${imei}`);
    console.log(`Begin Time: ${beginTime}`);
    console.log(`End Time:   ${endTime}`);
    console.log(`Connecting to TrackSolid Pro proxy...`);

    // 1. Authenticate
    const loginRes = await callApi('jimi.oauth.token.get', {
        user_id: account,
        user_pwd_md5: passwordMd5,
        expires_in: 7200
    });
    const token = loginRes.result?.accessToken || loginRes.result?.access_token;
    console.log(`✔ Login successful! Token: ${token.substring(0, 16)}...`);

    // 2. Fetch Track History (UTC is recommended for track list API, but history.tsx converts it)
    console.log(`Fetching track history from server...`);
    const historyRes = await callApi('jimi.device.track.list', {
        access_token: token,
        imei: imei,
        begin_time: beginTime,
        end_time: endTime,
        map_type: 'GOOGLE'
    });

    const pts = historyRes.result || [];
    console.log(`✔ Fetched ${pts.length} raw points.`);

    // 3. Fetch Server-side Mileage
    console.log(`Fetching server-side mileage...`);
    const mileageRes = await callApi('jimi.device.track.mileage', {
        access_token: token,
        imeis: imei,
        begin_time: beginTime,
        end_time: endTime
    });

    let apiMileageVal = 0;
    if (Array.isArray(mileageRes.result) && mileageRes.result.length > 0) {
        apiMileageVal = mileageRes.result[0].mileage;
    } else if (mileageRes.result?.mileage !== undefined) {
        apiMileageVal = mileageRes.result.mileage;
    } else if (mileageRes.data && Array.isArray(mileageRes.data) && mileageRes.data.length > 0) {
        apiMileageVal = mileageRes.data[0].mileage;
    }
    const apiMileageKm = Number(apiMileageVal || 0) / 1000;
    console.log(`✔ TrackSolid Server Mileage: ${apiMileageKm.toFixed(2)} km (${apiMileageVal} meters)\n`);

    // 4. Calculate client-side distances for each positioning mode
    const modes = ['all', 'optimized', 'precise'];
    console.log(`=== CALCULATED DISTANCES IN TRACE+ ===`);
    for (const mode of modes) {
        const filtered = filterTrackPoints(pts, mode);
        const stops = detectStops(filtered);
        
        let distanceKm = 0;
        if (mode === 'all' && apiMileageKm > 0) {
            distanceKm = apiMileageKm;
        } else {
            distanceKm = calculateTotalDistance(filtered);
        }

        console.log(`Mode: [${mode.toUpperCase()}]`);
        console.log(`  Filtered Points: ${filtered.length}/${pts.length}`);
        console.log(`  Stops Detected:  ${stops.length}`);
        console.log(`  Total Distance:  ${distanceKm.toFixed(2)} km`);
        console.log(``);
    }
}

main().catch(err => {
    console.error("❌ Test failed:", err.message);
});
