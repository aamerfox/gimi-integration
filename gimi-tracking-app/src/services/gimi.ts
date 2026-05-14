import { api } from './api';

export const gimiService = {
    // 1. Authentication
    login: async (account: string, password_md5: string) => {
        return api.post('', {
            method: 'jimi.oauth.token.get',
            user_id: account,
            user_pwd_md5: password_md5,
            expires_in: 7200,
        });
    },

    // 2. Device List
    getDeviceList: async (accessToken: string, targetAccount: string) => {
        return api.post('', {
            method: 'jimi.user.device.list',
            access_token: accessToken,
            target: targetAccount,
        });
    },

    // 3. Live Location
    getDevicesLocation: async (accessToken: string, targetAccount: string) => {
        return api.post('', {
            method: 'jimi.user.device.location.list',
            access_token: accessToken,
            target: targetAccount,
            map_type: 'GOOGLE'
        });
    },

    // 4. Track History
    getTrackHistory: async (accessToken: string, imei: string, beginTime: string, endTime: string) => {
        return api.post('', {
            method: 'jimi.device.track.list',
            access_token: accessToken,
            imei: imei,
            begin_time: beginTime,
            end_time: endTime,
            map_type: 'GOOGLE'
        });
    },

    // 5. Geofences — List
    getGeofences: async (accessToken: string, account: string) => {
        return api.post('', {
            method: 'jimi.open.platform.fence.list',
            access_token: accessToken,
            account: account,
        });
    },

    // 6. Geofences — Create (device-level)
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
        return api.post('', {
            method: 'jimi.open.device.fence.create',
            access_token: accessToken,
            imei: imei,
            fence_name: fenceName,
            alarm_type: alarmType,
            report_mode: 0, // 0 = GPRS, 1 = SMS+GPRS
            alarm_switch: alarmSwitch,
            lng: lng.toString(),
            lat: lat.toString(),
            radius: Math.max(1, Math.min(9999, Math.round(radius / 100))).toString(), // units of 100m
            zoom_level: '14',
            map_type: 'GOOGLE',
        });
    },

    // 7. Geofences — Delete (device-level)
    deleteDeviceFence: async (accessToken: string, imei: string, fenceSerialNo: string) => {
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
        return api.post('', {
            method: 'jimi.open.platform.fence.create',
            access_token: accessToken,
            account: account,
            fence_name: fenceName,
            fence_type: fenceType,
            fence_color: fenceColor,
        });
    },

    // 9. Alerts / Alarms — Device alarm list
    getDeviceAlarms: async (
        accessToken: string,
        imei: string,
        beginTime: string,
        endTime: string,
        pageNo: number = 1,
        pageSize: number = 50
    ) => {
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

    // 10. Alerts — User-level alarm list (all devices)
    getUserAlarms: async (
        accessToken: string,
        account: string,
        beginTime: string,
        endTime: string,
        pageNo: number = 1,
        pageSize: number = 50
    ) => {
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
};
