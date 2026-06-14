import axios from 'axios';
import MD5 from 'crypto-js/md5';
import { useAuthStore } from '../store/auth';

// TrackSolid Pro Open API (EU node)
// In development (npm run dev), use Vite's proxy (/api) to bypass CORS.
const BASE_URL = import.meta.env.DEV ? '/api' : '/token';

// App Credentials from Documentation
const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';

export const api = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
});

// Helper to generate signature
export const generateSignature = (params: Record<string, string | number | boolean>): string => {
    const sortedKeys = Object.keys(params).sort();

    let paramString = APP_SECRET;
    for (const key of sortedKeys) {
        if (key === 'sign') continue;
        paramString += `${key}${params[key]}`;
    }
    paramString += APP_SECRET;

    return MD5(paramString).toString().toUpperCase();
};

api.interceptors.request.use((config) => {
    const pad = (n: number) => n < 10 ? `0${n}` : n;
    const now = new Date();
    // CRITICAL: GIMI/TrackSolid Pro requires UTC timestamp (GMT+0)
    const timestamp = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;

    const commonParams: Record<string, string | number | boolean> = {
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp: timestamp,
        v: '1.0',
    };

    const privateParams = config.data || config.params || {};
    const allParams = { ...commonParams, ...privateParams };

    const sign = generateSignature(allParams);
    allParams.sign = sign;

    // Send everything as query params (Gimi IoT API pattern)
    config.params = allParams;
    config.data = undefined; 

    return config;
});

api.interceptors.response.use(
    (response) => {
        const data = response.data;
        console.log('[GIMI API Response]', data);

        if (data.code !== undefined && data.code !== 0) {
            if (data.code === 1004) {
                console.error('[GIMI API] Token exception detected (1004), forcing logout...');
                useAuthStore.getState().logout();

                if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            }
            return Promise.reject(new Error(data.message || `API Error (code: ${data.code})`));
        }

        return data;
    },
    (error) => {
        console.error('[GIMI API Error]', error);

        if (error.response?.status === 401) {
            console.error('[GIMI API] 401 Unauthorized detected, forcing logout...');
            useAuthStore.getState().logout();

            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);
