const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Ensure database directory exists
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to SQLite Database
const dbPath = path.join(dbDir, 'subaccounts.db');
console.log(`Connecting to database at: ${dbPath}`);
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Failed to connect to SQLite database:', err.message);
        process.exit(1);
    }
    console.log('Connected to SQLite subaccounts database.');
});

// Initialize database tables
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS sub_accounts (
            accountId TEXT PRIMARY KEY,
            nickName TEXT NOT NULL,
            email TEXT NOT NULL,
            telephone TEXT,
            roleName TEXT NOT NULL DEFAULT 'End User (Read-Only)',
            passwordMd5 TEXT NOT NULL,
            deviceImei TEXT
        )
    `, (err) => {
        if (err) {
            console.error('Failed to create sub_accounts table:', err.message);
        } else {
            console.log('Initialized sub_accounts database schema.');
            
            // Seed default hertz account if table is empty
            db.get("SELECT COUNT(*) as count FROM sub_accounts", (err, row) => {
                if (!err && row.count === 0) {
                    const stmt = db.prepare(`
                        INSERT INTO sub_accounts (accountId, nickName, email, telephone, roleName, passwordMd5, deviceImei)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `);
                    stmt.run(
                        'hertz',
                        'Hertz OCI Sub-Account',
                        'hertz@saudiex.com',
                        '0500000000',
                        'End User (Read-Only)',
                        '80fc588ba13f3af3d64be60ddfd386d8', // md5 of hertz08642
                        '781950640051748'
                    );
                    stmt.finalize();
                    console.log('Seeded default Hertz sub-account.');
                }
            });
        }
    });
});

// --- REST API ENDPOINTS ---

// 1. GET: Fetch all sub-accounts
app.get('/api/sub-accounts', (req, res) => {
    db.all("SELECT * FROM sub_accounts", [], (err, rows) => {
        if (err) {
            console.error('GET /api/sub-accounts error:', err.message);
            return res.status(500).json({ code: 500, message: err.message });
        }
        res.json({ code: 0, message: 'success', result: rows });
    });
});

// 2. GET: Fetch a single sub-account by accountId (case-insensitive)
app.get('/api/sub-accounts/:accountId', (req, res) => {
    const accountId = req.params.accountId.toLowerCase();
    db.get("SELECT * FROM sub_accounts WHERE LOWER(accountId) = ?", [accountId], (err, row) => {
        if (err) {
            console.error(`GET /api/sub-accounts/${accountId} error:`, err.message);
            return res.status(500).json({ code: 500, message: err.message });
        }
        if (!row) {
            return res.status(404).json({ code: 404, message: 'Account not found' });
        }
        res.json({ code: 0, message: 'success', result: row });
    });
});

// Helper middleware to check for admin authorization headers
const requireAdmin = (req, res, next) => {
    const userToken = req.headers['x-user-token'];
    const userId = req.headers['x-user-id'];
    const u = userId?.toLowerCase();
    
    if (!userToken || userToken.startsWith('oci_token_') || !(u === 'saudiextest' || u === 'saudiextest1')) {
        console.warn(`Unauthorized sub-account modification attempt: userToken=${userToken}, userId=${userId}`);
        return res.status(403).json({ code: 403, message: 'Forbidden: Only admin accounts can modify sub-accounts.' });
    }
    next();
};

// 3. POST: Create or update a sub-account mapping
app.post('/api/sub-accounts', requireAdmin, (req, res) => {
    const { accountId, nickName, email, telephone, roleName, passwordMd5, deviceImei } = req.body;
    
    if (!accountId || !nickName || !email || !passwordMd5) {
        return res.status(400).json({ code: 400, message: 'Missing required fields (accountId, nickName, email, passwordMd5)' });
    }

    const role = roleName || 'End User (Read-Only)';

    db.run(`
        INSERT INTO sub_accounts (accountId, nickName, email, telephone, roleName, passwordMd5, deviceImei)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(accountId) DO UPDATE SET
            nickName=excluded.nickName,
            email=excluded.email,
            telephone=excluded.telephone,
            roleName=excluded.roleName,
            passwordMd5=excluded.passwordMd5,
            deviceImei=excluded.deviceImei
    `, [accountId, nickName, email, telephone || null, role, passwordMd5, deviceImei || null], function(err) {
        if (err) {
            console.error('POST /api/sub-accounts error:', err.message);
            return res.status(500).json({ code: 500, message: err.message });
        }
        res.json({ code: 0, message: 'success', result: { accountId, nickName, email, telephone, roleName: role, deviceImei } });
    });
});

// 4. DELETE: Remove a sub-account
app.delete('/api/sub-accounts/:accountId', requireAdmin, (req, res) => {
    const accountId = req.params.accountId;
    db.run("DELETE FROM sub_accounts WHERE accountId = ?", [accountId], function(err) {
        if (err) {
            console.error(`DELETE /api/sub-accounts/${accountId} error:`, err.message);
            return res.status(500).json({ code: 500, message: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ code: 404, message: 'Account not found' });
        }
        res.json({ code: 0, message: 'success' });
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gimi Sub-Account Backend running on http://0.0.0.0:${PORT}`);
});
