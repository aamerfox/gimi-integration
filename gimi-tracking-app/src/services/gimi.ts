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

    // 3b. Device Location
    getDeviceLocation: async (accessToken: string, imei: string) => {
        return api.post('', {
            method: 'jimi.device.location.get',
            access_token: accessToken,
            imei: imei,
            map_type: 'GOOGLE',
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

    // 4b. Parking Report (Stops)
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

    // 4c. Track Mileage (Trip Distance)
    getTrackMileage: async (
        accessToken: string,
        imei: string,
        beginTime: string,
        endTime: string
    ) => {
        return api.post('', {
            method: 'jimi.device.track.mileage',
            access_token: accessToken,
            imeis: imei,
            begin_time: beginTime,
            end_time: endTime,
        });
    },

    // 4d. Trips Report (per-trip details — matches TrackSolid Pro)
    getTripsReport: async (
        accessToken: string,
        account: string,
        imeis: string,
        startTime: string,
        endTime: string,
        startRow = 1,
        pageSize = 100
    ) => {
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
        return api.post('', {
            method: 'jimi.open.platform.fence.list',
            access_token: accessToken,
            account: account,
        });
    },

    // 5b. Geofences — Device-level List
    getDeviceFences: async (accessToken: string, imei: string) => {
        return api.post('', {
            method: 'jimi.open.device.fence.list',
            access_token: accessToken,
            imei: imei,
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

    // 11. Update Device Name
    updateDeviceName: async (
        accessToken: string,
        imei: string,
        deviceName: string
    ) => {
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
        return api.post('', {
            method: 'jimi.user.child.list',
            access_token: accessToken,
            target: targetAccount,
        });
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
        return api.post('', {
            method: 'jimi.open.instruction.send',
            access_token: accessToken,
            imei: imei,
            cmd_val: command,
        });
    },
};
