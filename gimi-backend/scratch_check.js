const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'subaccounts.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT * FROM sub_accounts", [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log("=== Subaccounts Mapping inside SQLite Database ===");
    rows.forEach(row => {
        console.log(`Account ID: ${row.accountId}`);
        console.log(`NickName:   ${row.nickName}`);
        console.log(`IMEIs:      ${row.deviceImei}`);
        console.log("-".repeat(50));
    });
    db.close();
});
