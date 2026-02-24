const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
const SERVER_IP = '68.183.73.150';
const PASSWORD = '+Dj_e8BG*xtBY3s';

console.log('Connecting to', SERVER_IP, '...');

conn.on('ready', () => {
    console.log('✅ Connected securely via SSH.');

    // The command to run on the server
    const remoteCommand = `
node -e "
const fs = require('fs');
const path = '/etc/nginx/sites-available/default';

try {
    const config = fs.readFileSync(path, 'utf8');
    if (config.includes('location /token')) {
        console.log('✅ Proxy is already configured in Nginx.');
        process.exit(0);
    }

    const tokenBlock = \\\`
    location /token {
        rewrite ^/token/?(.*) /route/rest/\\$1 break;
        proxy_pass https://eu-open.tracksolidpro.com;
        proxy_ssl_server_name on;

        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;

        if (\\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }
    \\\`;

    const parts = config.split('location / {');
    if(parts.length < 2) {
        console.log('❌ Could not locate location / block in Nginx config.');
        process.exit(1);
    }

    const newConfig = parts[0] + tokenBlock + '\\n    location / {' + parts.slice(1).join('location / {');
    fs.writeFileSync(path + '.bak', config);
    fs.writeFileSync(path, newConfig);
    console.log('✅ Nginx configuration successfully updated on the server!');
} catch(e) {
    console.error('❌ Error modifying config:', e);
}
" && nginx -t && systemctl reload nginx
`;

    conn.exec(remoteCommand, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}).on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
    // Respond to the password prompt with our password
    if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) {
        finish([PASSWORD]);
    } else {
        finish([]);
    }
}).connect({
    host: SERVER_IP,
    port: 22,
    username: 'root',
    password: PASSWORD,
    tryKeyboard: true,
    readyTimeout: 20000
});
