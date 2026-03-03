const Client = require('ssh2-sftp-client');
const path = require('path');

const SERVER_IP = '68.183.73.150';
const PASSWORD = '+Dj_e8BG*xtBY3s';
const LOCAL_DIR = path.join(__dirname, 'gimi-tracking-app', 'dist');
const REMOTE_DIR = '/var/www/html';

async function upload() {
    const sftp = new Client();

    console.log(`📡 Connecting to DigitalOcean (${SERVER_IP})...`);

    try {
        await sftp.connect({
            host: SERVER_IP,
            port: 22,
            username: 'root',
            password: PASSWORD,
            tryKeyboard: true,
            readyTimeout: 30000,
            // intercept the keyboard interactive prompt explicitly
            onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) => {
                if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) {
                    finish([PASSWORD]);
                } else {
                    finish([]);
                }
            }
        });

        console.log('✅ Connected successfully!');
        console.log(`📤 Uploading files from ${LOCAL_DIR} to ${REMOTE_DIR}...`);

        await sftp.uploadDir(LOCAL_DIR, REMOTE_DIR);

        console.log('🎉 Upload complete! The site is now live!');
        await sftp.end();
        process.exit(0);

    } catch (e) {
        console.error('❌ Connection or Upload failed:', e.message);
        try { await sftp.end(); } catch (_) { }
        process.exit(1);
    }
}

upload();
