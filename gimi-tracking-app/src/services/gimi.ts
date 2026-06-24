import { api, customApi } from './api';
import { useSimulationStore } from '../store/simulation';

const TAG_APP_KEY = '0310e0f4330f4853a80e1fd9612ca0a7';

// Helper to determine the correct URL route for OCI Tag service API
const getTagUrl = (path: string) => {
    if (typeof window !== 'undefined' && (window as any).Capacitor && (window as any).Capacitor.isNative) {
        return `https://tag.traceplus.co${path}`;
    }
    return path;
};

// Helper to format ISO timestamp to Jimi standard YYYY-MM-DD HH:mm:ss
const formatGpsTime = (isoString: string) => {
    if (!isoString) return '';
    return isoString.replace('T', ' ').split('.')[0];
};

// Helper to query OCI Tag API for the latest coordinate point
const queryOciLatestPoint = async (imei: string) => {
    // Fire a non-blocking background refresh to keep the adapter up-to-date
    const refreshUrl = getTagUrl('/tag/v1/device/refresh');
    fetch(refreshUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appKey: TAG_APP_KEY, deviceImei: imei })
    }).catch(e => console.error('Background refresh failed:', e));

    const url = getTagUrl('/tag/v1/device/latest-point');
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appKey: TAG_APP_KEY, deviceImei: imei })
    });
    return res.json();
};

// Helper to query OCI Tag API for track history coordinate path
const queryOciTrackHistory = async (imei: string, startTime: string, endTime: string) => {
    const url = getTagUrl('/tag/v1/device/track');
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appKey: TAG_APP_KEY, deviceImei: imei, startTime, endTime })
    });
    return res.json();
};

// Helpers to check OCI bypass states
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
    login: async (account: string, password_md5: string) => {
        // Query custom backend first
        try {
            const res = await customApi.get(`/sub-accounts/${account}`);
            if (res.data && res.data.code === 0 && res.data.result) {
                const acc = res.data.result;
                if (acc.passwordMd5?.toLowerCase() === password_md5.toLowerCase()) {
                    // Populate local store with SQLite data
                    try {
                        const allRes = await customApi.get('/sub-accounts');
                        if (allRes.data && allRes.data.code === 0 && Array.isArray(allRes.data.result)) {
                            useSimulationStore.setState({ simulatedChildAccounts: allRes.data.result });
                        }
                    } catch (e) {
                        console.error('Failed to sync custom sub-accounts from backend:', e);
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
                }
            }
        } catch (err) {
            console.log('Account not in custom database or backend offline, checking TrackSolid...', err);
        }

        // Fallback to standard TrackSolid API
        return api.post('', {
            method: 'jimi.oauth.token.get',
            user_id: account,
            user_pwd_md5: password_md5,
            expires_in: 7200,
        });
    },

    // 2. Device List
    getDeviceList: async (accessToken: string, targetAccount: string) => {
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
            for (let idx = 0; idx < mappedImeis.length; idx++) {
                const imei = mappedImeis[idx];
                const devName = matched ? (mappedImeis.length > 1 ? `${matched.nickName} - Unit ${idx + 1}` : `${matched.nickName} Device`) : 'Hertz Device (OCI)';
                const actTime = getDeviceActivationTime(imei, matched?.deviceImei, matched?.activationTime);
                const batVal = calculateSimulatedBattery(actTime);
                try {
                    const ociRes = await queryOciLatestPoint(imei);
                    if (ociRes && ociRes.code === 0 && ociRes.data) {
                        const d = ociRes.data;
                        result.push({
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
                        });
                        continue;
                    }
                } catch (e) {
                    console.error(`Failed to query OCI latest-point for ${imei}:`, e);
                }
                
                // Fallback coordinate, slightly offset to avoid stacking
                result.push({
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
                });
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
            map_type: 'GOOGLE'
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
            imei: imei,
            map_type: 'GOOGLE',
        });
    },

    // 4. Track History
    getTrackHistory: async (accessToken: string, imei: string, beginTime: string, endTime: string) => {
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
                        direction: 0
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
            imei: imei,
            begin_time: beginTime,
            end_time: endTime,
            map_type: 'GOOGLE'
        });
    },

    // 4b. Parking Report
    getParkingReport: async (
        accessToken: string,
        account: string,
        imei: string,
        startTime: string,
        endTime: string,
        accType: 'on' | 'off' = 'off',
        startRow = 1,
        pageSize = 100
    ) => {
        if (isOciToken(accessToken) || isOciImei(imei)) {
            return { code: 0, message: 'success', result: [] };
        }
        return api.post('', {
            method: 'jimi.open.platform.report.parking',
            access_token: accessToken,
            account: account,
            imeis: imei,
            start_time: startTime,
            end_time: endTime,
            acc_type: accType,
            start_row: String(startRow),
            page_size: String(pageSize),
        });
    },

    // 4c. Track Mileage
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

    // 4d. Trips Report
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
            account: account,
            imeis: imeis,
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
            account: account,
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
            imei: imei,
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
            imei: imei,
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
            imei: imei,
            fence_serial_no: fenceSerialNo,
        });
    },

    // 8. Geofences — Create (platform-level)
    createPlatformFence: async (
        accessToken: string,
        account: string,
        fenceName: string,
        fenceType: 'CIRCLE' | 'POLYGON' = 'CIRCLE',
        fenceColor: string = '#00d4aa'
    ) => {
        if (isOciToken(accessToken) || account === 'hertz' || account.startsWith('oci_token_')) {
            return { code: 0, message: 'success', result: {} };
        }
        return api.post('', {
            method: 'jimi.open.platform.fence.create',
            access_token: accessToken,
            account: account,
            fence_name: fenceName,
            fence_type: fenceType,
            fence_color: fenceColor,
        });
    },

    // 9. Alerts / Alarms
    getDeviceAlarms: async (
        accessToken: string,
        imei: string,
        beginTime: string,
        endTime: string,
        pageNo: number = 1,
        pageSize: number = 50
    ) => {
        if (isOciToken(accessToken) || isOciImei(imei)) {
            return { code: 0, message: 'success', result: [] };
        }
        return api.post('', {
            method: 'jimi.device.alarm.list',
            access_token: accessToken,
            imei: imei,
            begin_time: beginTime,
            end_time: endTime,
            page_no: pageNo.toString(),
            page_size: pageSize.toString(),
        });
    },

    // 10. Alerts — User-level alarms
    getUserAlarms: async (
        accessToken: string,
        account: string,
        beginTime: string,
        endTime: string,
        pageNo: number = 1,
        pageSize: number = 50
    ) => {
        if (isOciToken(accessToken) || account === 'hertz' || account.startsWith('oci_token_')) {
            return { code: 0, message: 'success', result: [] };
        }
        return api.post('', {
            method: 'jimi.device.alarm.list',
            access_token: accessToken,
            target: account,
            begin_time: beginTime,
            end_time: endTime,
            page_no: pageNo.toString(),
            page_size: pageSize.toString(),
        });
    },

    // 11. Update Device Name
    updateDeviceName: async (
        accessToken: string,
        imei: string,
        deviceName: string
    ) => {
        if (isOciToken(accessToken) || isOciImei(imei)) {
            return { code: 0, message: 'success', result: {} };
        }
        return api.post('', {
            method: 'jimi.open.device.update',
            access_token: accessToken,
            imei: imei,
            device_name: deviceName,
        });
    },

    // 12. Create Child Account
    createChildAccount: async (
        accessToken: string,
        accountId: string,
        nickName: string,
        accountType: number,
        passwordMd5: string,
        email: string,
        telephone?: string
    ) => {
        return api.post('', {
            method: 'jimi.user.child.create',
            access_token: accessToken,
            account_id: accountId,
            nick_name: nickName,
            account_type: accountType,
            password: passwordMd5,
            email: email,
            telephone: telephone,
        });
    },

    // 13. List Child Accounts
    getChildAccounts: async (accessToken: string, targetAccount: string) => {
        // Sync custom sub-accounts from SQLite backend first to keep the Zustand store up to date
        try {
            const allRes = await customApi.get('/sub-accounts');
            if (allRes.data && allRes.data.code === 0 && Array.isArray(allRes.data.result)) {
                useSimulationStore.setState({ simulatedChildAccounts: allRes.data.result });
            }
        } catch (e) {
            console.error('Failed to sync custom sub-accounts from backend:', e);
        }

        let response: any;
        try {
            response = (await api.post('', {
                method: 'jimi.user.child.list',
                access_token: accessToken,
                target: targetAccount,
            })) as any;
        } catch (apiErr) {
            console.warn('Jimi API child list rate-limited or failed, using local/custom sub-accounts:', apiErr);
            response = {
                code: 0,
                message: 'success (local fallback)',
                result: []
            };
        }
        
        // Inject all custom sub-accounts from the store if target is saudiextest
        if (targetAccount === 'saudiextest' && response && response.code === 0 && Array.isArray(response.result)) {
            const customAccounts = useSimulationStore.getState().simulatedChildAccounts;
            for (const acc of customAccounts) {
                const exists = response.result.some((item: any) => item.account === acc.accountId);
                if (!exists) {
                    response.result.push({
                        account: acc.accountId,
                        name: acc.nickName,
                        type: 9,
                        displayFlag: 1,
                        address: null,
                        birth: null,
                        companyName: 'Custom Mapping',
                        email: acc.email,
                        phone: acc.telephone || '',
                        language: 'en',
                        sex: 0,
                        enabledFlag: 1,
                        remark: acc.deviceImei ? `OCI Mapped (IMEI: ${acc.deviceImei})` : 'Simulated Sub-Account',
                        userId: `oci_uid_${acc.accountId}`,
                        parentId: '14547407'
                    });
                }
            }
        }
        return response;
    },

    // 14. Get Operation Logs
    getOperationLogs: async (
        accessToken: string,
        targetAccount: string,
        beginTime: string,
        endTime: string,
        pageNo = 1,
        pageSize = 50
    ) => {
        if (isOciToken(accessToken) || targetAccount === 'hertz' || targetAccount.startsWith('oci_token_')) {
            return { code: 0, message: 'success', result: [] };
        }
        return api.post('', {
            method: 'jimi.user.log.list',
            access_token: accessToken,
            target: targetAccount,
            begin_time: beginTime,
            end_time: endTime,
            page_no: String(pageNo),
            page_size: String(pageSize),
        });
    },

    // 15. Send Command / Ring Tag
    sendDeviceCommand: async (accessToken: string, imei: string, command: string) => {
        if (isOciToken(accessToken) || isOciImei(imei)) {
            return { code: 0, message: 'success', result: {} };
        }
        return api.post('', {
            method: 'jimi.open.instruction.send',
            access_token: accessToken,
            imei: imei,
            cmd_val: command,
        });
    },
};
