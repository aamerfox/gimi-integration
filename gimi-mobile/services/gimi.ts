import { api, customApi } from './api';
import { useSimulationStore } from '../store/simulation';
import { TAG_APP_KEY } from '../config/constants';

// Helper to format ISO timestamp (e.g. 2026-06-18T09:39:22.000+00:00) to Jimi standard (e.g. 2026-06-18 09:39:22)
const formatGpsTime = (isoString: string) => {
    if (!isoString) return '';
    return isoString.replace('T', ' ').split('.')[0];
};

// Helper with retry logic for unstable networks
const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, delayMs = 1500) => {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            lastError = e;
            await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
        }
    }
    throw lastError;
};

// Helper to query OCI Tag API for the latest coordinate point
const queryOciLatestPoint = async (imei: string) => {
    // Fire a non-blocking background refresh to keep the adapter up-to-date
    const refreshUrl = 'https://tag.traceplus.co/tag/v1/device/refresh';
    fetch(refreshUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appKey: TAG_APP_KEY, deviceImei: imei })
    }).catch(e => console.error('Background refresh failed:', e));

    const url = 'https://tag.traceplus.co/tag/v1/device/latest-point';
    return fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appKey: TAG_APP_KEY, deviceImei: imei })
    });
};

// Helper to query OCI Tag API for track history coordinate path
const queryOciTrackHistory = async (imei: string, startTime: string, endTime: string) => {
    const url = 'https://tag.traceplus.co/tag/v1/device/track';
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appKey: TAG_APP_KEY, deviceImei: imei, startTime, endTime })
    });
    return res.json();
};

const isOciToken = (token: string) => token && token.startsWith('oci_token_');
const isOciImei = (imei: string) => {
    if (!imei) return false;
    const customAccounts = useSimulationStore.getState().simulatedChildAccounts;
    return customAccounts.some(acc => {
        if (!acc.deviceImei) return false;
        return acc.deviceImei.split(',').map(s => s.trim()).includes(imei);
    });
};

const getDeviceActivationTime = (imei: string, allImeisStr?: string, activationTimesStr?: string): string => {
    const defaultDate = '2026-06-18 12:00:00';
    if (!activationTimesStr || !allImeisStr) return defaultDate;

    const imeis = allImeisStr.split(',').map(s => s.trim()).filter(Boolean);
    const times = activationTimesStr.split(',').map(s => s.trim()).filter(Boolean);

    const index = imeis.indexOf(imei);
    if (index !== -1 && times[index]) {
        return times[index];
    }
    if (times.length === 1 && times[0]) {
        return times[0];
    }
    return defaultDate;
};

const calculateSimulatedBattery = (activationTimeStr: string): string => {
    try {
        const activationDate = new Date(activationTimeStr.replace(' ', 'T'));
        const currentDate = new Date();
        const diffMs = currentDate.getTime() - activationDate.getTime();
        const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        const totalLifespanDays = 3 * 365; // 1095 days

        if (diffDays >= totalLifespanDays) {
            return '0';
        }
        const percentage = 100 - (diffDays * (100 / totalLifespanDays));
        return Math.max(0, Math.min(100, Math.round(percentage))).toString();
    } catch (e) {
        console.error('Failed to calculate battery:', e);
        return 'N/A';
    }
};

export const gimiService = {
    // 1. Authentication
    // Three-stage login:
    //   Stage 1: Local Zustand store (instant, no network) — catches hertz + any cached OCI accounts
    //   Stage 2: Remote SQLite backend (tag.traceplus.co/custom-api) — syncs fresh OCI accounts
    //   Stage 3: TrackSolid Pro API (jimi.oauth.token.get) — for native GPS tracker accounts
    login: async (account: string, password_md5: string) => {
        const accountLower = account.trim().toLowerCase();

        // ── Stage 1: Check local Zustand store first (works offline) ──────────
        const localAccounts = useSimulationStore.getState().simulatedChildAccounts;
        const localMatch = localAccounts.find(
            (acc) => acc.accountId.toLowerCase() === accountLower
        );
        if (localMatch && localMatch.passwordMd5) {
            if (localMatch.passwordMd5.toLowerCase() === password_md5.toLowerCase()) {
                console.log(`[Auth] Stage 1: OCI local match for "${account}"`);
                return {
                    code: 0,
                    message: 'success',
                    result: {
                        accessToken: `oci_token_${localMatch.accountId}`,
                        refreshToken: `oci_refresh_${localMatch.accountId}`,
                        expiresIn: 7200,
                    }
                };
            } else {
                // Account IS in the OCI store but password is wrong.
                // Fail immediately — don't leak into TrackSolid.
                console.warn(`[Auth] Stage 1: OCI account found, wrong password for "${account}"`);
                throw new Error('Invalid account or password. Please try again.');
            }
        }

        // ── Stage 2: Try remote SQLite backend ────────────────────────────────
        let ociAccountExistsButWrongPassword = false;
        try {
            const res = await customApi.get(`/sub-accounts/${accountLower}`);
            if (res.data && res.data.code === 0 && res.data.result) {
                const acc = res.data.result;
                if (acc.passwordMd5?.toLowerCase() === password_md5.toLowerCase()) {
                    console.log(`[Auth] Stage 2: OCI backend match for "${account}"`);
                    // Sync the full account list into the local store
                    try {
                        const allRes = await customApi.get('/sub-accounts');
                        if (allRes.data && allRes.data.code === 0 && Array.isArray(allRes.data.result)) {
                            useSimulationStore.getState().setSimulatedChildAccounts(allRes.data.result);
                        }
                    } catch (syncErr) {
                        console.warn('[Auth] Backend sync failed (non-critical):', syncErr);
                    }
                    return {
                        code: 0,
                        message: 'success',
                        result: {
                            accessToken: `oci_token_${acc.accountId}`,
                            refreshToken: `oci_refresh_${acc.accountId}`,
                            expiresIn: 7200,
                        }
                    };
                } else {
                    // Account exists in OCI backend but password is wrong — flag it
                    console.warn(`[Auth] Stage 2: OCI backend account found, wrong password for "${account}"`);
                    ociAccountExistsButWrongPassword = true;
                }
            }
        } catch (err: any) {
            // 404 = account not in OCI DB → continue to TrackSolid
            // other errors = backend offline → continue to TrackSolid
            if (err?.response?.status === 404) {
                console.log(`[Auth] Stage 2: Account "${account}" not in OCI DB, trying TrackSolid...`);
            } else {
                console.warn('[Auth] Stage 2: Backend error, will try TrackSolid:', err?.message);
            }
        }

        // Fail fast if OCI backend found the account but password was wrong
        if (ociAccountExistsButWrongPassword) {
            throw new Error('Invalid account or password. Please try again.');
        }

        // ── Stage 3: TrackSolid Pro API (for native GPS tracker accounts) ─────
        console.log(`[Auth] Stage 3: Attempting TrackSolid login for "${account}"`);
        return api.post('', {
            method: 'jimi.oauth.token.get',
            user_id: account,
            user_pwd_md5: password_md5,
            expires_in: 7200,
        });
    },

    // 2. Device List
    getDeviceList: async (accessToken: string, targetAccount: string) => {
        // Sync custom sub-accounts from SQLite backend first to keep the Zustand store up to date
        try {
            const allRes = await customApi.get('/sub-accounts');
            if (allRes.data && allRes.data.code === 0 && Array.isArray(allRes.data.result)) {
                useSimulationStore.getState().setSimulatedChildAccounts(allRes.data.result);
            }
        } catch (e) {
            console.error('Failed to sync custom sub-accounts from backend:', e);
        }

        const customAccounts = useSimulationStore.getState().simulatedChildAccounts;
        const isCustomTarget = customAccounts.some(acc => acc.accountId.toLowerCase() === targetAccount.toLowerCase());

        if (isOciToken(accessToken) || targetAccount === 'hertz' || targetAccount.startsWith('oci_token_') || isCustomTarget) {
            const accountId = isOciToken(accessToken) ? accessToken.replace('oci_token_', '') : targetAccount;
            const matched = customAccounts.find(acc => acc.accountId.toLowerCase() === accountId.toLowerCase());
            const mappedImeisString = matched?.deviceImei || '781950640051748';
            const mappedImeis = mappedImeisString.split(',').map(s => s.trim()).filter(Boolean);

            const result = mappedImeis.map((imei, idx) => {
                const actTime = getDeviceActivationTime(imei, matched?.deviceImei, matched?.activationTime);
                return {
                    imei,
                    deviceName: matched ? (mappedImeis.length > 1 ? `${matched.nickName} - Unit ${idx + 1}` : `${matched.nickName} Device`) : 'Hertz Device (OCI)',
                    mcType: 'Tag',
                    sim: 'N/A',
                    expiration: '2030-01-01 00:00:00',
                    activationTime: actTime,
                    reMark: 'OCI Tag Integration',
                    vehicleName: matched ? (mappedImeis.length > 1 ? `${matched.nickName} - Unit ${idx + 1}` : matched.nickName) : 'Hertz Tag',
                    vehicleIcon: 'automobile',
                    enabledFlag: 1,
                    status: 'NORMAL'
                };
            });

            return {
                code: 0,
                message: 'success',
                result
            };
        }
        return api.post('', {
            method: 'jimi.user.device.list',
            access_token: accessToken,
            target: targetAccount,
        });
    },

    // 3. Live Location
    getDevicesLocation: async (accessToken: string, targetAccount: string) => {
        if (isOciToken(accessToken) || targetAccount === 'hertz' || targetAccount.startsWith('oci_token_')) {
            const accountId = accessToken.replace('oci_token_', '');
            const customAccounts = useSimulationStore.getState().simulatedChildAccounts;
            const matched = customAccounts.find(acc => acc.accountId === accountId);
            const mappedImeisString = matched?.deviceImei || '781950640051748';
            const mappedImeis = mappedImeisString.split(',').map(s => s.trim()).filter(Boolean);

            const result = [];
            const chunkSize = 15;
            for (let i = 0; i < mappedImeis.length; i += chunkSize) {
                const chunk = mappedImeis.slice(i, i + chunkSize);
                const chunkPromises = chunk.map(async (imei, chunkIdx) => {
                    const idx = i + chunkIdx;
                    const devName = matched ? (mappedImeis.length > 1 ? `${matched.nickName} - Unit ${idx + 1}` : `${matched.nickName} Device`) : 'Hertz Device (OCI)';
                    const actTime = getDeviceActivationTime(imei, matched?.deviceImei, matched?.activationTime);
                    const batVal = calculateSimulatedBattery(actTime);
                    try {
                        const ociRes = await queryOciLatestPoint(imei);
                        if (ociRes && ociRes.code === 0 && ociRes.data) {
                            const d = ociRes.data;
                            return {
                                imei,
                                deviceName: devName,
                                mcType: 'Tag',
                                icon: 'automobile',
                                status: '1',
                                posType: 'GPS',
                                lat: d.lat,
                                lng: d.lng,
                                speed: 0,
                                gpsTime: formatGpsTime(d.timestamp),
                                accStatus: '1',
                                batteryPowerVal: batVal
                            };
                        }
                    } catch (e) {
                        console.error(`Failed to query OCI latest-point for ${imei}:`, e);
                    }

                    // Fallback coordinate, slightly offset to avoid stacking
                    return {
                        imei,
                        deviceName: devName,
                        mcType: 'Tag',
                        icon: 'automobile',
                        status: '1',
                        posType: 'GPS',
                        lat: 24.705177 + (idx * 0.005),
                        lng: 46.71977 + (idx * 0.005),
                        speed: 0,
                        gpsTime: '2026-06-18 12:00:00',
                        accStatus: '1',
                        batteryPowerVal: batVal
                    };
                });
                
                const chunkResults = await Promise.all(chunkPromises);
                result.push(...chunkResults);
            }

            return {
                code: 0,
                message: 'success',
                result
            };
        }
        return api.post('', {
            method: 'jimi.user.device.location.list',
            access_token: accessToken,
            target: targetAccount,
            map_type: 'GOOGLE',
        });
    },

    // 3b. Device Location
    getDeviceLocation: async (accessToken: string, imei: string) => {
        if (isOciToken(accessToken) || isOciImei(imei)) {
            const customAccounts = useSimulationStore.getState().simulatedChildAccounts;
            const matched = customAccounts.find(acc => {
                if (accessToken === `oci_token_${acc.accountId}`) return true;
                if (!acc.deviceImei) return false;
                return acc.deviceImei.split(',').map(s => s.trim()).includes(imei);
            });
            
            let targetImei = imei;
            if (!targetImei && matched?.deviceImei) {
                targetImei = matched.deviceImei.split(',')[0].trim();
            }
            if (!targetImei) targetImei = '781950640051748';

            const actTime = getDeviceActivationTime(targetImei, matched?.deviceImei, matched?.activationTime);
            const batVal = calculateSimulatedBattery(actTime);
            try {
                const ociRes = await queryOciLatestPoint(targetImei);
                if (ociRes && ociRes.code === 0 && ociRes.data) {
                    const d = ociRes.data;
                    return {
                        code: 0,
                        message: 'success',
                        result: {
                            imei: targetImei,
                            deviceName: matched ? `${matched.nickName} Device` : 'OCI Device',
                            mcType: 'Tag',
                            icon: 'automobile',
                            status: '1',
                            posType: 'GPS',
                            lat: d.lat,
                            lng: d.lng,
                            speed: 0,
                            gpsTime: formatGpsTime(d.timestamp),
                            accStatus: '1',
                            batteryPowerVal: batVal
                        }
                    };
                }
            } catch (e) {
                console.error('Failed to query OCI latest-point:', e);
            }
            return {
                code: 0,
                message: 'success',
                result: {
                    imei: targetImei,
                    deviceName: matched ? `${matched.nickName} Device` : 'OCI Device',
                    mcType: 'Tag',
                    icon: 'automobile',
                    status: '1',
                    posType: 'GPS',
                    lat: 24.705177,
                    lng: 46.71977,
                    speed: 0,
                    gpsTime: '2026-06-18 12:00:00',
                    accStatus: '1',
                    batteryPowerVal: batVal
                }
            };
        }
        return api.post('', {
            method: 'jimi.device.location.get',
            access_token: accessToken,
            imei,
            map_type: 'GOOGLE',
        });
    },

    // 4. Track History
    getTrackHistory: async (
        accessToken: string,
        imei: string,
        beginTime: string,
        endTime: string
    ) => {
        if (isOciToken(accessToken) || isOciImei(imei)) {
            const customAccounts = useSimulationStore.getState().simulatedChildAccounts;
            const matched = customAccounts.find(acc => {
                if (accessToken === `oci_token_${acc.accountId}`) return true;
                if (!acc.deviceImei) return false;
                return acc.deviceImei.split(',').map(s => s.trim()).includes(imei);
            });
            
            let targetImei = imei;
            if (!targetImei && matched?.deviceImei) {
                targetImei = matched.deviceImei.split(',')[0].trim();
            }
            if (!targetImei) targetImei = '781950640051748';

            try {
                const ociRes = await queryOciTrackHistory(targetImei, beginTime, endTime);
                if (ociRes && ociRes.code === 0 && Array.isArray(ociRes.data)) {
                    const points = ociRes.data.map((pt: any) => ({
                        lat: pt.lat,
                        lng: pt.lng,
                        gpsTime: formatGpsTime(pt.timestamp),
                        speed: 0,
                        posType: 'GPS',
                        direction: 0,
                        confidence: pt.confidence !== undefined ? Number(pt.confidence) : undefined
                    }));
                    return {
                        code: 0,
                        message: 'success',
                        result: points
                    };
                }
            } catch (e) {
                console.error('Failed to query OCI track history:', e);
            }
            return {
                code: 0,
                message: 'success',
                result: []
            };
        }
        return api.post('', {
            method: 'jimi.device.track.list',
            access_token: accessToken,
            imei,
            begin_time: beginTime,
            end_time: endTime,
            map_type: 'GOOGLE',
        });
    },

    // 4b. Track Mileage
    getTrackMileage: async (
        accessToken: string,
        imei: string,
        beginTime: string,
        endTime: string
    ) => {
        if (isOciToken(accessToken) || isOciImei(imei)) {
            return { code: 0, message: 'success', result: [] };
        }
        return api.post('', {
            method: 'jimi.device.track.mileage',
            access_token: accessToken,
            imeis: imei,
            begin_time: beginTime,
            end_time: endTime,
        });
    },

    // 4c. Trips Report
    getTripsReport: async (
        accessToken: string,
        account: string,
        imeis: string,
        startTime: string,
        endTime: string,
        startRow = 1,
        pageSize = 100
    ) => {
        if (isOciToken(accessToken) || isOciImei(imeis)) {
            return { code: 0, message: 'success', result: [] };
        }
        return api.post('', {
            method: 'jimi.open.platform.report.trips',
            access_token: accessToken,
            account,
            imeis,
            type: 'list',
            start_time: startTime,
            end_time: endTime,
            start_row: String(startRow),
            page_size: String(pageSize),
        });
    },

    // 5. Geofences — List
    getGeofences: async (accessToken: string, account: string) => {
        if (isOciToken(accessToken) || account === 'hertz' || account.startsWith('oci_token_')) {
            return { code: 0, message: 'success', result: [] };
        }
        return api.post('', {
            method: 'jimi.open.platform.fence.list',
            access_token: accessToken,
            account,
        });
    },

    // 5b. Geofences — Device-level List
    getDeviceFences: async (accessToken: string, imei: string) => {
        if (isOciToken(accessToken) || isOciImei(imei)) {
            return { code: 0, message: 'success', result: [] };
        }
        return api.post('', {
            method: 'jimi.open.device.fence.list',
            access_token: accessToken,
            imei,
        });
    },

    // 6. Geofences — Create
    createDeviceFence: async (
        accessToken: string,
        imei: string,
        fenceName: string,
        lat: number,
        lng: number,
        radius: number,
        alarmType: 'in' | 'out' | 'in,out',
        alarmSwitch: 'ON' | 'OFF' = 'ON'
    ) => {
        if (isOciToken(accessToken) || isOciImei(imei)) {
            return { code: 0, message: 'success', result: {} };
        }
        return api.post('', {
            method: 'jimi.open.device.fence.create',
            access_token: accessToken,
            imei,
            fence_name: fenceName,
            alarm_type: alarmType,
            report_mode: 0,
            alarm_switch: alarmSwitch,
            lng: lng.toString(),
            lat: lat.toString(),
            radius: Math.max(1, Math.min(9999, Math.round(radius / 100))).toString(),
            zoom_level: '14',
            map_type: 'GOOGLE',
        });
    },

    // 7. Geofences — Delete
    deleteDeviceFence: async (accessToken: string, imei: string, fenceSerialNo: string) => {
        if (isOciToken(accessToken) || isOciImei(imei)) {
            return { code: 0, message: 'success', result: {} };
        }
        return api.post('', {
            method: 'jimi.open.device.fence.delete',
            access_token: accessToken,
            imei,
            fence_serial_no: fenceSerialNo,
        });
    },

    // 8. Device Alarms
    getDeviceAlarms: async (
        accessToken: string,
        imei: string,
        beginTime: string,
        endTime: string,
        pageNo = 1,
        pageSize = 50
    ) => {
        if (isOciToken(accessToken) || isOciImei(imei)) {
            return { code: 0, message: 'success', result: [] };
        }
        return api.post('', {
            method: 'jimi.device.alarm.list',
            access_token: accessToken,
            imei,
            begin_time: beginTime,
            end_time: endTime,
            page_no: pageNo.toString(),
            page_size: pageSize.toString(),
        });
    },

    // 9. Update Device Name
    updateDeviceName: async (accessToken: string, imei: string, newName: string) => {
        if (isOciToken(accessToken) || isOciImei(imei)) {
            return { code: 0, message: 'success', result: {} };
        }
        return api.post('', {
            method: 'jimi.open.device.update',
            access_token: accessToken,
            imei,
            device_name: newName,
        });
    },

    // 10. Send Device Command
    sendDeviceCommand: async (accessToken: string, imei: string, command: string) => {
        if (isOciToken(accessToken) || isOciImei(imei)) {
            return { code: 0, message: 'success', result: {} };
        }
        return api.post('', {
            method: 'jimi.open.instruction.send',
            access_token: accessToken,
            imei,
            inst_param_json: JSON.stringify({
                inst_id: '0',
                inst_template: command,
                params: []
            })
        });
    },
};
