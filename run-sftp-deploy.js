const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const SERVER_IP = '68.183.73.150';
const PASSWORD = '+Dj_e8BG*xtBY3s';
const LOCAL_DIR = path.join(__dirname, 'gimi-tracking-app', 'dist');
const REMOTE_DIR = '/var/www/html';

// Walk directory recursively
function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

function uploadDirectory(sftp, localPath, remotePath) {
    return new Promise(async (resolve, reject) => {
        try {
            const files = [];
            walkDir(localPath, (filePath) => {
                files.push(filePath);
            });

            console.log(`Found ${files.length} files to upload.`);

            for (let i = 0; i < files.length; i++) {
                const lp = files[i];
                // Convert typical windows paths to posix remote path
                const relPath = path.relative(localPath, lp).replace(/\\/g, '/');
                const rp = remotePath + '/' + relPath;

                // Ensure remote dir exists
                const remoteDir = path.dirname(rp);
                if (remoteDir !== remotePath) {
                    // Primitive mkdir (ignore err if exists)
                    await new Promise(r => sftp.mkdir(remoteDir, r));
                }

                await new Promise((res, rej) => {
                    sftp.fastPut(lp, rp, (err) => {
                        if (err) return rej(err);
                        console.log(`[${i + 1}/${files.length}] Uploaded: ${relPath}`);
                        res();
                    });
                });
            }
            resolve();
        } catch (e) {
            reject(e);
        }
    });
}

console.log(`Connecting to ${SERVER_IP} via SFTP...`);

conn.on('ready', () => {
    console.log('✅ Connected securely.');
    conn.sftp(async (err, sftp) => {
        if (err) throw err;
        console.log('Started secure file transfer...');

        try {
            // Very hacky clear remote dir, won't delete deep files perfectly 
            // but enough for our Vite outputs which change hash
            await uploadDirectory(sftp, LOCAL_DIR, REMOTE_DIR);
            console.log('✅ ALL FILES UPLOADED SUCCESSFULLY!');
            conn.end();
            process.exit(0);
        } catch (e) {
            console.error('Upload error:', e);
            conn.end();
            process.exit(1);
        }
    });
}).on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
    if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) {
        finish([PASSWORD]);
    } else {
        finish([]);
    }
}).connect({
    host: SERVER_IP,
    port: 22,
    username: 'root',
    tryKeyboard: true,
    readyTimeout: 30000
});
