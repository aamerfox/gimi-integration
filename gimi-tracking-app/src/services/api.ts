import axios from 'axios';
import MD5 from 'crypto-js/md5';
import { useAuthStore } from '../store/auth';

// TrackSolid Pro Open API (EU node)
// In development (npm run dev), use Vite's proxy (/api) to bypass CORS.
// In production (built to /var/www/html), point to the Nginx reverse proxy (/token).
import { Capacitor } from '@capacitor/core';

let BASE_URL = import.meta.env.DEV ? '/api' : '/token';
if (Capacitor.isNativePlatform()) {
    BASE_URL = 'https://saudiex-tracker-256825749353.europe-west10.run.app/token';
}

// App Credentials from Documentation
const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';

export const api = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
});

// Helper to generate signature
// Sign = MD5(app_secret + sorted(key+value) + app_secret).toUpperCase()
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

// Request Interceptor to add common params and signature
api.interceptors.request.use((config) => {
    const pad = (n: number) => n < 10 ? `0${n}` : n;
    const now = new Date();
    // CRITICAL: GIMI/TrackSolid Pro requires UTC timestamp (GMT+0)
    const timestamp = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;

    // Common parameters
    const commonParams: Record<string, string | number | boolean> = {
        app_key: APP_KEY,
        format: 'json',
        sign_method: 'md5',
        timestamp: timestamp,
        v: '1.0',
    };

    // The Gimi API sends everything as query params for both GET and POST
    // We merge common params + the data object passed via api.post('', { ... })
    const privateParams = config.data || config.params || {};
    const allParams = { ...commonParams, ...privateParams };

    // Generate signature
    const sign = generateSignature(allParams);
    allParams.sign = sign;

    // Send everything as query params (Gimi IoT API pattern)
    config.params = allParams;
    config.data = undefined; // Clear body — everything goes in URL

    return config;
});

// Response Interceptor
api.interceptors.response.use(
    (response) => {
        const data = response.data;

        // Debug: Log every response
        console.log('[GIMI API Response]', data);

        // Gimi returns { code: 0, message: 'success', result: {...} } on success
        // On error: { code: <number>, message: 'error message' }
        if (data.code !== undefined && data.code !== 0) {
            // Handle token expiration / illegal access (TrackSolid Pro pattern: returns 200 with code 1004)
            if (data.code === 1004) {
                console.error('[GIMI API] Token exception detected (1004), forcing logout...');
                useAuthStore.getState().logout();

                // If in browser environment, redirect to login
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

        // Handle 401 Unauthorized status code (Vite proxy or Gimi might return this)
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
