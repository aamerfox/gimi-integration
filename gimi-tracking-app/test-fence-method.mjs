import crypto from 'crypto';
const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';
const APP_SECRET = 'd1bf0654370a4a148abacd02abe8146e';
const TOKEN = '19bd4ae61d61150a0cb3995baabdb934';
const ACCOUNT = 'GBH2025';
const BASE = 'https://eu-open.tracksolidpro.com/route/rest';
const pad = (n) => String(n).padStart(2, '0');
function ts() { const d = new Date(); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()); }
function sign(p) { const s = Object.keys(p).sort(); let str = APP_SECRET; for (const k of s) { if (k !== 'sign') str += k + p[k]; } return crypto.createHash('md5').update(str + APP_SECRET).digest('hex').toUpperCase(); }
async function t(method) {
    const p = { app_key: APP_KEY, format: 'json', sign_method: 'md5', timestamp: ts(), v: '1.0', method, access_token: TOKEN, account: ACCOUNT };
    p.sign = sign(p);
    const qs = Object.entries(p).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
    try { const r = await fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: qs }); const txt = await r.text(); console.log(method + ' -> ' + txt.slice(0, 150)); } catch (e) { console.log(method + ' -> ERROR: ' + e.message); }
}
await t('jimi.open.platform.fence.list');
await t('jimi.open.device.fence.list');
