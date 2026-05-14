import CryptoJS from 'crypto-js';

const SHARE_SECRET = 'AFF6D2C054844194BC1C9A93B8B9C3AA';
const url = "https://saudiex-tracker-256825749353.europe-west10.run.app/share?imei=780901807618889&name=PB708PRO-18889&exp=1772493711&tok=e5e37faab6daf21811aac3d3c65c82e6&sig=0e3a937381181bacada52136cda7385f48275a6df727eb3846e5c91cca732eca";

const p = new URLSearchParams(url.split('?')[1]);
const imei = p.get('imei');
const name = p.get('name');
const exp = Number(p.get('exp'));
const tok = p.get('tok');
const sig = p.get('sig');

const payload = `${imei}|${exp}|${tok}`;
const expected = CryptoJS.HmacSHA256(payload, SHARE_SECRET).toString();

console.log("Input sig: ", sig);
console.log("Expected : ", expected);
console.log("Matches? : ", sig === expected);
