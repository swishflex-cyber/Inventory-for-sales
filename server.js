const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const bcrypt = require('bcryptjs');
const { signToken, verifyToken } = require('./auth');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());

// --- MIDDLEWARE ---
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send('No token');
    try {
        const token = authHeader.split(' ')[1];
        req.user = verifyToken(token);
        next();
    } catch (err) { res.status(403).send('Invalid token'); }
}

function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).send('Insufficient permissions');
        }
        next();
    };
}

// --- DAILY REPORT GENERATOR FUNCTION ---
// UPDATED: Includes Stock Purchases in Labor/Expense calculation
function generateReportForDate(dateStr, callback) {
    db.all(`
        SELECT 
            COALESCE(SUM(verified_value_sold), 0) as revenue,
            (
                SELECT COALESCE(SUM(amount), 0) FROM payroll_logs WHERE date = ?
            ) + (
                SELECT COALESCE(SUM(amount), 0) FROM stock_purchases WHERE date = ?
            ) as labor
        FROM inventory_logs 
        WHERE date = ? AND status = 'verified'
    `, [dateStr, dateStr, dateStr], (err, financeRows) => {
        if (err) return callback ? callback(err) : console.error(err);
        
        const finance = financeRows[0] || { revenue: 0, labor: 0 };
        const revenue = parseFloat(f
