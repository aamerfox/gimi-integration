const { Client } = require('ssh2');

const conn = new Client();
const SERVER_IP = '68.183.73.150';
const PASSWORD = '+Dj_e8BG*xtBY3s';

console.log('Connecting to', SERVER_IP, 'via Keyboard-Interactive Shell...');

conn.on('ready', () => {
    console.log('✅ Connected securely via SSH.');

    conn.shell((err, stream) => {
        if (err) throw err;

        stream.on('close', () => {
            console.log('Connection closed.');
            conn.end();
            process.exit(0);
        }).on('data', (data) => {
            const output = data.toString();
            process.stdout.write(output);

            if (output.includes('DEPLOYMENT_COMPLETE_MARKER')) {
                console.log('\n\n✅ Deployment successful. Closing connection.');
                stream.end('exit\n');
            }
        });

        // --- 1. First, apply the Nginx proxy we originally wanted ---
        stream.write("cat << 'EOF' > /root/update_nginx.js\n");
        stream.write("const fs = require('fs');\n");
        stream.write("const path = '/etc/nginx/sites-available/default';\n");
        stream.write("const config = fs.readFileSync(path, 'utf8');\n");
        stream.write("if (!config.includes('location /token')) {\n");
        stream.write("    const tokenBlock = `\n");
        stream.write("    location /token {\n");
        stream.write("        rewrite ^/token/?(.*) /route/rest/$1 break;\n");
        stream.write("        proxy_pass https://eu-open.tracksolidpro.com;\n");
        stream.write("        proxy_ssl_server_name on;\n");
        stream.write("        add_header 'Access-Control-Allow-Origin' '*' always;\n");
        stream.write("        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;\n");
        stream.write("        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;\n");
        stream.write("        if ($request_method = 'OPTIONS') {return 204;}\n");
        stream.write("    }`;\n");
        stream.write("    const parts = config.split('location / {');\n");
        stream.write("    const newConfig = parts[0] + tokenBlock + '\\n    location / {' + parts.slice(1).join('location / {');\n");
        stream.write("    fs.writeFileSync(path, newConfig);\n");
        stream.write("    console.log('Nginx config updated!');\n");
        stream.write("}\n");
        stream.write("EOF\n");
        stream.write("node /root/update_nginx.js\n");
        stream.write("nginx -t && systemctl reload nginx\n");

        // --- 2. Second, clone and build the tracking app ---
        const buildCommand = `
        cd /var/www && rm -rf gimi-integration && \\
        git clone https://github.com/aamerfox/gimi-integration.git && \\
        cd gimi-integration/gimi-tracking-app && \\
        npm install && npm run build && \\
        rm -rf /var/www/html/* && cp -r dist/* /var/www/html/ && \\
        echo 'DEPLOYMENT_COMPLETE_MARKER'
        `;
        stream.write(buildCommand + '\n');
    });

}).on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
    // Specifically handle the keyboard-interactive prompt
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
    tryKeyboard: true, // Force fallback to keyboard authentication
    readyTimeout: 30000
});
