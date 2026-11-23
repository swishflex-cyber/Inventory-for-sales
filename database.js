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
        id INTEGER
