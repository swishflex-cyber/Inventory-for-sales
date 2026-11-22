const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// On Render, the persistent disk is mounted at /data
const dbPath = process.env.DB_PATH || path.join(__dirname, 'vespoint.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Could not connect to database', err);
    else console.log('Connected to database:', dbPath);
});

db.serialize(() => {
    // --- Create Tables ---
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        pin_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        unit_cost REAL NOT NULL,
        unit_price REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS inventory_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        item_id INTEGER,
        date DATE DEFAULT (DATE('now')),
        qty_sold INTEGER DEFAULT 0,
        qty_waste INTEGER DEFAULT 0,
        value_sold REAL DEFAULT 0,
        notes_employee TEXT,
        status TEXT DEFAULT 'pending',
        verified_qty_sold INTEGER,
        verified_qty_waste INTEGER,
        verified_value_sold REAL,
        notes_manager TEXT,
        verified_by INTEGER,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (item_id) REFERENCES items (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS attendance_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        date DATE DEFAULT (DATE('now')),
        status TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS payroll_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        date DATE NOT NULL,
        amount REAL NOT NULL,
        notes TEXT,
        created_by INTEGER,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (created_by) REFERENCES users (id)
    )`);

    // NEW: Daily Reports Table
    db.run(`CREATE TABLE IF NOT EXISTS daily_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_date TEXT UNIQUE NOT NULL,
        total_revenue REAL DEFAULT 0,
        total_labor REAL DEFAULT 0,
        net_profit REAL DEFAULT 0,
        top_item_name TEXT,
        top_item_qty INTEGER DEFAULT 0,
        top_item_revenue REAL DEFAULT 0,
        pending_count INTEGER DEFAULT 0,
        verified_count INTEGER DEFAULT 0,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // --- Admin PIN Logic ---
    const adminPin = bcrypt.hashSync('4545', 10);

    // Check if admin exists
    db.get(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`, (err, user) => {
        if (err) throw err;

        if (user) {
            // Update existing admin PIN
            db.run(`UPDATE users SET pin_hash = ? WHERE role = 'admin'`, [adminPin], (err) => {
                if (err) console.error('Update Admin PIN failed:', err);
                else console.log('Admin PIN updated to 4545');
            });
        } else {
            // Create new admin if not found
            db.run(`INSERT INTO users (name, role, pin_hash) VALUES ('VesPoint Admin', 'admin', ?)`, [adminPin], (err) => {
                if (err) console.error('Insert Admin failed:', err);
                else console.log('Admin created with PIN 4545');
            });
        }
    });
});

module.exports = db;