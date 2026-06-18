import axios from 'axios';
import CryptoJS from 'crypto-js';
import { useAuthStore } from '../store/auth';
import { router } from 'expo-router';
import { Platform } from 'react-native';

// All environments must connect through the Cloud Run proxy to bypass TrackSolid Pro IP Whitelisting
const API_BASE = 'https://tag.traceplus.co/token';

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';

export const api = axios.create({
    baseURL: API_BASE,
    timeout: 15000,
});

export const generateSignature = (params: Record<string, string | number | boolean>): string => {
    const sortedKeys = Object.keys(params).sort();
    let paramString = APP_SECRET;
    for (const key of sortedKeys) {
        if (key === 'sign') continue;
        paramString += key + String(params[key]);
    }
    paramString += APP_SECRET;
    return CryptoJS.MD5(paramString).toString().toUpperCase();
};

const pad = (n: number) => String(n).padStart(2, '0');

api.interceptors.request.use((config) => {
    const now = new Date();
    const timestamp = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;

    const commonParams: Record<string, string | number | boolean> = {
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp,
        v: '1.0',
    };

    const privateParams = config.data || config.params || {};
    const allParams = { ...commonParams, ...privateParams };

    allParams.sign = generateSignature(allParams);

    // Send everything as query params in the URL (consistent with web app and regional proxy rules)
    config.params = allParams;
    config.data = undefined;

    return config;
});

api.interceptors.response.use(
    (response) => {
        const data = response.data;
        console.log('[GIMI API Response]', JSON.stringify(data));

        if (data.code !== undefined && data.code !== 0 && data.code !== 200) {
            if (data.code === 1004) {
                console.error('[GIMI API] Token exception detected (1004), forcing logout...');
                useAuthStore.getState().logout();
                if (Platform.OS !== 'web') {
                    router.replace('/login');
                }
            }
            return Promise.reject(new Error(data.message || data.msg || `API Error (code: ${data.code})`));
        }
        return data; // Return the full wrapper
    },
    (error) => {
        console.error('[GIMI API Error]', error);
        if (error.response?.status === 401) {
            console.error('[GIMI API] 401 Unauthorized detected, forcing logout...');
            useAuthStore.getState().logout();
            if (Platform.OS !== 'web') {
                router.replace('/login');
            }
        }
        return Promise.reject(error);
    }
);
