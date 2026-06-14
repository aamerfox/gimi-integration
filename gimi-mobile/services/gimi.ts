import { api } from './api';

export const gimiService = {
    login: async (account: string, password_md5: string) => {
        return api.post('', {
            method: 'jimi.oauth.token.get',
            user_id: account,
            user_pwd_md5: password_md5,
            expires_in: 7200,
        });
    },

    getDeviceList: async (accessToken: string, targetAccount: string) => {
        return api.post('', {
            method: 'jimi.user.device.list',
            access_token: accessToken,
            target: targetAccount,
        });
    },

    getDevicesLocation: async (accessToken: string, targetAccount: string) => {
        return api.post('', {
            method: 'jimi.user.device.location.list',
            access_token: accessToken,
            target: targetAccount,
            map_type: 'GOOGLE',
        });
    },

    getDeviceLocation: async (accessToken: string, imei: string) => {
        return api.post('', {
            method: 'jimi.device.location.get',
            access_token: accessToken,
            imei,
            map_type: 'GOOGLE',
        });
    },

    getTrackHistory: async (
        accessToken: string,
        imei: string,
        beginTime: string,
        endTime: string
    ) => {
        return api.post('', {
            method: 'jimi.device.track.list',
            access_token: accessToken,
            imei,
            begin_time: beginTime,
            end_time: endTime,
            map_type: 'GOOGLE',
        });
    },

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

    // Trips Report (per-trip details — matches TrackSolid Pro)
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
            account,
            imeis,
            type: 'list',
            start_time: startTime,
            end_time: endTime,
            start_row: String(startRow),
            page_size: String(pageSize),
        });
    },

    getGeofences: async (accessToken: string, account: string) => {
        return api.post('', {
            method: 'jimi.open.platform.fence.list',
            access_token: accessToken,
            account,
        });
    },

    getDeviceFences: async (accessToken: string, imei: string) => {
        return api.post('', {
            method: 'jimi.open.device.fence.list',
            access_token: accessToken,
            imei,
        });
    },

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

    deleteDeviceFence: async (accessToken: string, imei: string, fenceSerialNo: string) => {
        return api.post('', {
            method: 'jimi.open.device.fence.delete',
            access_token: accessToken,
            imei,
            fence_serial_no: fenceSerialNo,
        });
    },

    getDeviceAlarms: async (
        accessToken: string,
        imei: string,
        beginTime: string,
        endTime: string,
        pageNo = 1,
        pageSize = 50
    ) => {
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

    updateDeviceName: async (accessToken: string, imei: string, newName: string) => {
        return api.post('', {
            method: 'jimi.open.device.update',
            access_token: accessToken,
            imei,
            device_name: newName,
        });
    },

    sendDeviceCommand: async (accessToken: string, imei: string, command: string) => {
        return api.post('', {
            method: 'jimi.open.instruction.send',
            access_token: accessToken,
            imei,
            cmd_val: command,
        });
    },
};
