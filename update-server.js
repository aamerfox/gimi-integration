const fs = require('fs');
const path = '/etc/nginx/sites-available/default';

try {
    const config = fs.readFileSync(path, 'utf8');
    if (config.includes('location /token')) {
        console.log('✅ Proxy is already configured in Nginx.');
        process.exit(0);
    }

    const tokenBlock = `
    location /token {
        rewrite ^/token/?(.*) /route/rest/$1 break;
        proxy_pass https://eu-open.tracksolidpro.com;
        proxy_ssl_server_name on;

        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;

        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }
`;

    const parts = config.split('location / {');
    if (parts.length < 2) {
        console.log("❌ Could not locate 'location / {' block in Nginx config.");
        process.exit(1);
    }

    const newConfig = parts[0] + tokenBlock + '\n    location / {' + parts.slice(1).join('location / {');
    fs.writeFileSync(path + '.bak', config); // Backup just in case
    fs.writeFileSync(path, newConfig);
    console.log('✅ Nginx configuration successfully updated!');
} catch (e) {
    console.error('❌ Error modifying config:', e);
}
