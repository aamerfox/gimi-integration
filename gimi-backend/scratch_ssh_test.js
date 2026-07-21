const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(__dirname, '../docs/key.ppk');
const privateKey = fs.readFileSync(keyPath);

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected');
  
  const cmd = `cd /home/ubuntu/traceplus && git fetch --all && git reset --hard origin/master && sudo docker-compose build --no-cache tracking-app && sudo docker-compose up -d tracking-app`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host: '84.8.118.119',
  port: 22,
  username: 'ubuntu',
  privateKey: privateKey
});
