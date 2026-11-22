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
function generateReportForDate(dateStr, callback) {
    db.all(`
        SELECT 
            COALESCE(SUM(verified_value_sold), 0) as revenue,
            (SELECT COALESCE(SUM(amount), 0) FROM payroll_logs WHERE date = ?) as labor
        FROM inventory_logs 
        WHERE date = ? AND status = 'verified'
    `, [dateStr, dateStr], (err, financeRows) => {
        if (err) return callback ? callback(err) : console.error(err);
        
        const finance = financeRows[0] || { revenue: 0, labor: 0 };
        const revenue = parseFloat(finance.revenue) || 0;
        const labor = parseFloat(finance.labor) || 0;
        const netProfit = revenue - labor;

        db.all(`
            SELECT 
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified
            FROM inventory_logs WHERE date = ?
        `, [dateStr], (err, countRows) => {
            if (err) return callback ? callback(err) : console.error(err);
            const counts = countRows[0] || { pending: 0, verified: 0 };

            db.get(`
                SELECT i.name, SUM(il.qty_sold) as total_qty, MAX(i.unit_price * il.qty_sold) as total_revenue
                FROM inventory_logs il
                JOIN items i ON il.item_id = i.id
                WHERE il.date = ?
                GROUP BY i.id
                ORDER BY total_qty DESC
                LIMIT 1
            `, [dateStr], (err, topItem) => {
                if (err) return callback ? callback(err) : console.error(err);
                
                const reportData = {
                    report_date: dateStr,
                    total_revenue: revenue,
                    total_labor: labor,
                    net_profit: netProfit,
                    top_item_name: topItem ? topItem.name : 'N/A',
                    top_item_qty: topItem ? topItem.total_qty : 0,
                    top_item_revenue: topItem ? topItem.total_revenue : 0,
                    pending_count: counts.pending || 0,
                    verified_count: counts.verified || 0
                };

                db.run(`
                    INSERT INTO daily_reports (
                        report_date, total_revenue, total_labor, net_profit,
                        top_item_name, top_item_qty, top_item_revenue,
                        pending_count, verified_count
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(report_date) DO UPDATE SET
                        total_revenue = excluded.total_revenue,
                        total_labor = excluded.total_labor,
                        net_profit = excluded.net_profit,
                        top_item_name = excluded.top_item_name,
                        top_item_qty = excluded.top_item_qty,
                        top_item_revenue = excluded.top_item_revenue,
                        pending_count = excluded.pending_count,
                        verified_count = excluded.verified_count
                `, [
                    reportData.report_date,
                    reportData.total_revenue,
                    reportData.total_labor,
                    reportData.net_profit,
                    reportData.top_item_name,
                    reportData.top_item_qty,
                    reportData.top_item_revenue,
                    reportData.pending_count,
                    reportData.verified_count
                ], function(err) {
                    if (err) {
                        if (callback) callback(err);
                        else console.error('Report Error:', err);
                    } else {
                        console.log(`Report secured for ${dateStr}`);
                        if (callback) callback(null);
                    }
                });
            });
        });
    });
}

// --- CRON JOB (Midnight Daily) ---
cron.schedule('0 0 * * *', () => {
    console.log('Cron: Generating daily report for yesterday...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    generateReportForDate(dateStr, (err) => {
        if (err) console.error('Cron Execution Error:', err);
    });
});

// --- SERVER CATCH-UP LOGIC (On Startup) ---
console.log('Running catch-up for last 7 days...');
for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    generateReportForDate(dateStr, (err) => {
        if (err) console.error(`Catch-up error for ${dateStr}:`, err);
    });
}

// --- AUTH ROUTES ---
app.post('/api/auth/login', (req, res) => {
    const { pin, role } = req.body;
    db.all(`SELECT * FROM users WHERE role = ?`, [role], (err, users) => {
        if (err) return res.status(500).send(err);
        for (let user of users) {
            if (bcrypt.compareSync(pin, user.pin_hash)) return res.json({ token: signToken(user), user: { id: user.id, name: user.name, role: user.role } });
        }
        res.status(400).send('Invalid');
    });
});

app.post('/api/auth/create-user', authenticate, requireRole(['admin']), (req, res) => {
    const { name, role, pin } = req.body;
    db.run(`INSERT INTO users (name, role, pin_hash) VALUES (?, ?, ?)`, [name, role, bcrypt.hashSync(pin, 10)], function(err) {
        if (err) return res.status(500).send(err.message);
        res.json({ id: this.lastID });
    });
});

app.get('/api/auth/users', authenticate, requireRole(['admin', 'manager']), (req, res) => {
    db.all(`SELECT id, name, role FROM users`, [], (err, rows) => res.json(rows));
});

app.delete('/api/auth/users/:id', authenticate, requireRole(['admin']), (req, res) => {
    const targetId = parseInt(req.params.id);
    const requesterId = req.user.id;

    if (targetId === requesterId) {
        return res.status(400).send('You cannot delete your own account.');
    }

    db.get(`SELECT role, name FROM users WHERE id = ?`, [targetId], (err, targetUser) => {
        if (err) return res.status(500).send(err.message);
        if (!targetUser) return res.status(404).send('User not found');

        if (targetUser.role === 'admin') {
            return res.status(403).send('Cannot delete another Admin. Please demote them first.');
        }

        db.run(`DELETE FROM users WHERE id = ?`, [targetId], function(err) {
            if (err) return res.status(500).send('Error deleting user: ' + err.message);
            res.send(`Successfully deleted ${targetUser.name}`);
        });
    });
});

// --- ITEM ROUTES ---
app.post('/api/items', authenticate, (req, res) => {
    const { name, unit_cost, unit_price } = req.body;
    db.run(`INSERT INTO items (name, unit_cost, unit_price) VALUES (?, ?, ?)`, [name, unit_cost || 0, unit_price], function(err) {
        if (err) return res.status(500).send(err.message);
        res.send({ id: this.lastID });
    });
});

app.get('/api/items', authenticate, (req, res) => {
    db.all(`SELECT * FROM items ORDER BY id DESC`, [], (err, items) => res.json(items));
});

app.delete('/api/items/:id', authenticate, (req, res) => {
    db.serialize(() => {
        db.run(`DELETE FROM inventory_logs WHERE item_id = ?`, [req.params.id]);
        db.run(`DELETE FROM items WHERE id = ?`, [req.params.id], () => res.send('Deleted'));
    });
});

// --- INVENTORY ROUTES ---
app.post('/api/inventory', authenticate, (req, res) => {
    const { item_id, qty_sold, value_sold, notes, date } = req.body;
    db.run(`INSERT INTO inventory_logs (user_id, item_id, date, qty_sold, value_sold, notes_employee) VALUES (?, ?, ?, ?, ?, ?)`, 
        [req.user.id, item_id, date, qty_sold, value_sold, notes], function(err) {
            if (err) return res.status(500).send(err.message);
            res.send({ id: this.lastID });
        });
});

app.put('/api/inventory/:id/verify', authenticate, requireRole(['manager', 'admin']), (req, res) => {
    db.run(`UPDATE inventory_logs SET status = 'verified', verified_value_sold = ?, verified_by = ? WHERE id = ?`,
        [req.body.verified_value_sold, req.user.id, req.params.id], () => res.send('Verified'));
});

app.get('/api/inventory', authenticate, (req, res) => {
    db.all(`SELECT il.*, i.name as item_name, u.name as employee_name FROM inventory_logs il JOIN items i ON il.item_id = i.id JOIN users u ON il.user_id = u.id WHERE il.date = ?`, [req.query.date], (err, rows) => res.json(rows));
});

// --- PAYROLL ROUTES ---
app.post('/api/payroll', authenticate, requireRole(['manager', 'admin']), (req, res) => {
    db.run(`INSERT INTO payroll_logs (user_id, date, amount, notes, created_by) VALUES (?, ?, ?, ?, ?)`, 
        [req.body.user_id, req.body.date, req.body.amount, req.body.notes, req.user.id], () => res.send('Recorded'));
});

app.get('/api/payroll', authenticate, requireRole(['manager', 'admin']), (req, res) => {
    db.all(`SELECT pl.*, u.name as employee_name FROM payroll_logs pl JOIN users u ON pl.user_id = u.id ORDER BY date DESC`, [], (err, rows) => res.json(rows));
});

// --- FINANCE ROUTES ---
app.get('/api/finance/daily', authenticate, requireRole(['manager', 'admin']), (req, res) => {
    db.all(`SELECT (SELECT COALESCE(SUM(verified_value_sold), 0) FROM inventory_logs WHERE date = ? AND status='verified') as revenue, (SELECT COALESCE(SUM(amount), 0) FROM payroll_logs WHERE date = ?) as labor`, [req.query.date, req.query.date], (err, results) => {
        const r = results[0];
        res.json({ revenue: r.revenue, labor: r.labor, netProfit: r.revenue - r.labor });
    });
});

// --- REPORTS ROUTES ---
app.get('/api/reports/daily', authenticate, requireRole(['manager', 'admin']), (req, res) => {
    const date = req.query.date;
    if (!date) return res.status(400).send('Date required');
    db.get(`SELECT * FROM daily_reports WHERE report_date = ?`, [date], (err, row) => {
        if (err) return res.status(500).send(err.message);
        res.json(row || null);
    });
});

// --- SERVE FRONTEND (Vite/React Build) ---
app.use(express.static(path.join(__dirname, 'dist')));

// Send index.html for any non-API routes (handles page refr)
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(5000, () => console.log('VesPoint Server running on port 5000'));
