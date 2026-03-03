const { Client } = require('node-scp');
const path = require('path');

const SERVER_IP = '68.183.73.150';
const PASSWORD = '+Dj_e8BG*xtBY3s';
const LOCAL_DIR = path.join(__dirname, 'gimi-tracking-app', 'dist');
const REMOTE_DIR = '/var/www/html';

async function upload() {
    console.log(`📡 Connecting to DigitalOcean (${SERVER_IP})...`);

    try {
        const client = await Client({
            host: SERVER_IP,
            port: 22,
            username: 'root',
            password: PASSWORD,
        });

        console.log('✅ Connected successfully!');
        console.log(`📤 Uploading files from ${LOCAL_DIR} to ${REMOTE_DIR}...`);

        // node-scp has a built in uploadDir method
        await client.uploadDir(LOCAL_DIR, REMOTE_DIR);

        console.log('🎉 Upload complete! The site is now live!');
        client.close();
        process.exit(0);

    } catch (e) {
        console.error('❌ Connection or Upload failed:', e.message);
        process.exit(1);
    }
}

upload();
