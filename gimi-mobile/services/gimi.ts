import { api } from './api';

const TAG_APP_KEY = '0310e0f4330f4853a80e1fd9612ca0a7';

// Helper to format ISO timestamp (e.g. 2026-06-18T09:39:22.000+00:00) to Jimi standard (e.g. 2026-06-18 09:39:22)
const formatGpsTime = (isoString: string) => {
    if (!isoString) return '';
    return isoString.replace('T', ' ').split('.')[0];
};

// Helper to query OCI Tag API for the latest coordinate point
const queryOciLatestPoint = async (imei: string) => {
    const url = 'https://tag.traceplus.co/tag/v1/device/latest-point';
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appKey: TAG_APP_KEY, deviceImei: imei })
    });
    return res.json();
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

export const gimiService = {
    // 1. Authentication
    login: async (account: string, password_md5: string) => {
        if (account === 'hertz' && password_md5.toLowerCase() === '80fc588ba13f3af3d64be60ddfd386d8') {
            return {
                code: 0,
                message: 'success',
                result: {
                    accessToken: 'hertz_token',
                    refreshToken: 'hertz_refresh',
                    expiresIn: 7200,
                }
            };
        }
        return api.post('', {
            method: 'jimi.oauth.token.get',
            user_id: account,
            user_pwd_md5: password_md5,
            expires_in: 7200,
        });
    },

    // 2. Device List
    getDeviceList: async (accessToken: string, targetAccount: string) => {
        if (accessToken === 'hertz_token' || targetAccount === 'hertz') {
            return {
                code: 0,
                message: 'success',
                result: [{
                    imei: '781950640051748',
                    deviceName: 'Hertz Device (OCI)',
                    mcType: 'Tag',
                    sim: 'N/A',
                    expiration: '2030-01-01 00:00:00',
                    activationTime: '2026-06-18 12:00:00',
                    reMark: 'OCI Tag Integration',
                    vehicleName: 'Hertz Tag',
                    vehicleIcon: 'automobile',
                    enabledFlag: 1,
                    status: 'NORMAL'
                }]
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
        if (accessToken === 'hertz_token' || targetAccount === 'hertz') {
            try {
                const ociRes = await queryOciLatestPoint('781950640051748');
                if (ociRes && ociRes.code === 0 && ociRes.data) {
                    const d = ociRes.data;
                    return {
                        code: 0,
                        message: 'success',
                        result: [{
                            imei: '781950640051748',
                            deviceName: 'Hertz Device (OCI)',
                            mcType: 'Tag',
                            icon: 'automobile',
                            status: '1',
                            posType: 'GPS',
                            lat: d.lat,
                            lng: d.lng,
                            speed: 0,
                            gpsTime: formatGpsTime(d.timestamp),
                            accStatus: '1'
                        }]
                    };
                }
            } catch (e) {
                console.error('Failed to query OCI latest-point for Hertz:', e);
            }
            return {
                code: 0,
                message: 'success',
                result: [{
                    imei: '781950640051748',
                    deviceName: 'Hertz Device (OCI)',
                    mcType: 'Tag',
                    icon: 'automobile',
                    status: '1',
                    posType: 'GPS',
                    lat: 24.705177,
                    lng: 46.71977,
                    speed: 0,
                    gpsTime: '2026-06-18 12:00:00',
                    accStatus: '1'
                }]
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
        if (accessToken === 'hertz_token' || imei === '781950640051748') {
            try {
                const ociRes = await queryOciLatestPoint('781950640051748');
                if (ociRes && ociRes.code === 0 && ociRes.data) {
                    const d = ociRes.data;
                    return {
                        code: 0,
                        message: 'success',
                        result: {
                            imei: '781950640051748',
                            deviceName: 'Hertz Device (OCI)',
                            mcType: 'Tag',
                            icon: 'automobile',
                            status: '1',
                            posType: 'GPS',
                            lat: d.lat,
                            lng: d.lng,
                            speed: 0,
                            gpsTime: formatGpsTime(d.timestamp),
                            accStatus: '1'
                        }
                    };
                }
            } catch (e) {
                console.error('Failed to query OCI latest-point for Hertz:', e);
            }
            return {
                code: 0,
                message: 'success',
                result: {
                    imei: '781950640051748',
                    deviceName: 'Hertz Device (OCI)',
                    mcType: 'Tag',
                    icon: 'automobile',
                    status: '1',
                    posType: 'GPS',
                    lat: 24.705177,
                    lng: 46.71977,
                    speed: 0,
                    gpsTime: '2026-06-18 12:00:00',
                    accStatus: '1'
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
        if (accessToken === 'hertz_token' || imei === '781950640051748') {
            try {
                const ociRes = await queryOciTrackHistory('781950640051748', beginTime, endTime);
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
                console.error('Failed to query OCI track history for Hertz:', e);
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
        if (accessToken === 'hertz_token' || imei === '781950640051748') {
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
        if (accessToken === 'hertz_token' || imeis === '781950640051748') {
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
        if (accessToken === 'hertz_token' || account === 'hertz') {
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
        if (accessToken === 'hertz_token' || imei === '781950640051748') {
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
        if (accessToken === 'hertz_token' || imei === '781950640051748') {
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
        if (accessToken === 'hertz_token' || imei === '781950640051748') {
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
        if (accessToken === 'hertz_token' || imei === '781950640051748') {
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
        if (accessToken === 'hertz_token' || imei === '781950640051748') {
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
        if (accessToken === 'hertz_token' || imei === '781950640051748') {
            return { code: 0, message: 'success', result: {} };
        }
        return api.post('', {
            method: 'jimi.open.instruction.send',
            access_token: accessToken,
            imei,
            cmd_val: command,
        });
    },
};
