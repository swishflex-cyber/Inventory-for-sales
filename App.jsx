import { useState, useEffect } from 'react';

function App() {
    const [user, setUser] = useState(null);
    const [view, setView] = useState('dashboard'); // 'dashboard', 'management', 'reports'
    const [pin, setPin] = useState('');
    const [role, setRole] = useState('employee');

    const [logs, setLogs] = useState([]);
    const [allPayrollHistory, setAllPayrollHistory] = useState([]);
    const [items, setItems] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [finance, setFinance] = useState({ revenue: 0, cogs: 0, labor: 0, netProfit: 0 });
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    
    // New State for Reports
    const [report, setReport] = useState(null);
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

    // Fast Tally State
    const [tally, setTally] = useState({});

    // Forms: Admin New Product
    const [itemName, setItemName] = useState('');
    const [unitPrice, setUnitPrice] = useState('');

    // Forms: Record Salary
    const [selectedUserPay, setSelectedUserPay] = useState('');
    const [salaryAmount, setSalaryAmount] = useState('');
    const [salaryDate, setSalaryDate] = useState(new Date().toISOString().split('T')[0]);

    // Forms: Admin Create Employee Account
    const [newStaffName, setNewStaffName] = useState('');
    const [newStaffRole, setNewStaffRole] = useState('employee');
    const [newStaffPin, setNewStaffPin] = useState('');

    const token = localStorage.getItem('vespoint_token');

    useEffect(() => {
        if (user) {
            loadItems();
            loadLogs();
            if (user.role !== 'employee') {
                loadPayroll();
                loadFinance();
                loadUsers();
            }
        }
    }, [user, date, view]);

    useEffect(() => {
        if (user && user.role !== 'employee' && view === 'reports') {
            loadReport(reportDate);
        }
    }, [view, reportDate, user]);

    useEffect(() => {
        setTally(prev => {
            const nextTally = {};
            items.forEach(item => {
                nextTally[item.id] = prev[item.id] || { sold: 0 };
            });
            return nextTally;
        });
    }, [items]);

    useEffect(() => {
        if (usersList.length > 0 && !selectedUserPay) {
            const firstEmp = usersList.find(u => u.role === 'employee');
            if (firstEmp) setSelectedUserPay(firstEmp.id);
            else setSelectedUserPay(usersList[0].id);
        }
    }, [usersList]);

    const handleLogin = async () => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin, role })
            });
            const data = await res.json();
            if (res.ok && data.token) {
                localStorage.setItem('vespoint_token', data.token);
                setUser(data.user);
            } else {
                alert(data || 'Invalid PIN or Role');
            }
        } catch (e) {
            alert('Connection Error: ' + e.message);
        }
    };

    const loadItems = async () => {
        const res = await fetch('/api/items', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setItems(await res.json());
    };

    const loadUsers = async () => {
        const res = await fetch('/api/auth/users', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setUsersList(await res.json());
    };

    const loadLogs = async () => {
        const res = await fetch(`/api/inventory?date=${date}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setLogs(await res.json());
    };

    const loadPayroll = async () => {
        const res = await fetch('/api/payroll', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setAllPayrollHistory(await res.json() || []);
    };

    const loadFinance = async () => {
        const res = await fetch(`/api/finance/daily?date=${date}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setFinance(await res.json());
    };

    const loadReport = async (d) => {
        try {
            const res = await fetch(`/api/reports/daily?date=${d}`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            if (res.ok) {
                const data = await res.json();
                setReport(data);
            } else {
                setReport(null);
            }
        } catch (e) {
            setReport(null);
        }
    };

    const formatPHP = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0);

    const updateTally = (itemId, field, delta) => {
        setTally(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: Math.max(0, (prev[itemId]?.[field] || 0) + delta)
            }
        }));
    };

    const handleBatchSubmit = async () => {
        const entries = Object.entries(tally).filter(([id, data]) => data.sold > 0);
        if (entries.length === 0) return alert('Nothing tallied yet!');
        for (const [itemId, data] of entries) {
            const item = items.find(i => i.id == itemId);
            if (!item) continue;
            await fetch('/api/inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ item_id: itemId, qty_sold: data.sold, value_sold: data.sold * item.unit_price, notes: 'Batch Tally', date })
            });
        }
        alert('All counts submitted!');
        loadLogs();
        loadFinance();
        const resetTally = {};
        items.forEach(i => { resetTally[i.id] = { sold: 0 }; });
        setTally(resetTally);
    };

    const handleCreateStaff = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/auth/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name: newStaffName, role: newStaffRole, pin: newStaffPin })
            });
            if (res.ok) {
                alert(`Account created for ${newStaffName}!`);
                setNewStaffName('');
                setNewStaffPin('');
                loadUsers();
            } else {
                const errText = await res.text();
                alert('Error creating account: ' + errText);
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const handleDeleteStaff = async (id) => {
        if (!window.confirm('Are you sure you want to delete this staff account?')) return;
        try {
            const res = await fetch(`/api/auth/users/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                alert('Account deleted successfully.');
                loadUsers();
                loadPayroll();
            } else {
                const errText = await res.text();
                alert('Error: ' + errText);
            }
        } catch (err) {
            alert('Network Error: ' + err.message);
        }
    };

    const handleSalarySubmit = async (e) => {
        e.preventDefault();
        const res = await fetch('/api/payroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ user_id: selectedUserPay, amount: parseFloat(salaryAmount), date: salaryDate, notes: 'Salary' })
        });
        if (res.ok) {
            alert('Salary recorded!');
            setSalaryAmount('');
            loadPayroll();
            loadFinance();
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        if (!itemName || !unitPrice) return;
        const res = await fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name: itemName, unit_cost: 0, unit_price: parseFloat(unitPrice) })
        });
        if (res.ok) {
            alert('Product Registered!');
            setItemName('');
            setUnitPrice('');
            loadItems();
        }
    };

    const handleDeleteItem = async (id) => {
        if (!window.confirm('Delete this product?')) return;
        try {
            const res = await fetch(`/api/items/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setItems(prev => prev.filter(item => item.id !== id));
                setTally(prev => {
                    const updated = { ...prev };
                    delete updated[id];
                    return updated;
                });
                loadLogs();
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    // NEW: HANDLE DELETE LOG
    const handleDeleteLog = async (logId, logDate) => {
        if (!window.confirm(`Are you sure you want to delete this log entry?\nThis will remove it from Revenue and clear the Report for ${logDate}.`)) return;

        try {
            const res = await fetch(`/api/inventory/${logId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.ok) {
                alert('Log deleted. Revenue and Reports updated.');
                // Refresh current views
                loadLogs();       // Refresh the table
                loadFinance();     // Refresh the Revenue/Profit cards
                // If the user is on Reports tab, they will need to switch tabs to refresh, 
                // but since we are deleting the cache, next time they view Reports it will be null.
            } else {
                const errText = await res.text();
                alert('Error: ' + errText);
            }
        } catch (err) {
            alert('Network Error: ' + err.message);
        }
    };

    const verifyLog = (logId, value) => {
        fetch(`/api/inventory/${logId}/verify`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ verified_value_sold: parseFloat(value) })
        }).then(() => { loadLogs(); loadFinance(); });
    };

    const styles = {
        container: { padding: '15px', paddingBottom: '100px', fontFamily: 'system-ui, sans-serif', background: '#121212', color: '#e0e0e0', minHeight: '100vh', fontSize: '18px' },
        card: { background: '#1e1e1e', padding: '20px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.4)' },
        input: { background: '#2c2c2c', border: '1px solid #444', color: '#fff', padding: '14px', borderRadius: '8px', fontSize: '18px', width: '100%', boxSizing: 'border-box' },
        btnPrimary: { background: '#007BFF', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: 'bold', fontSize: '18px', width: '100%', cursor: 'pointer' },
        btnDelete: { background: '#cf6679', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
        tallyGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginTop: '10px' },
        tallyCard: { background: '#252525', border: '1px solid #333', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '110px', justifyContent: 'space-between' },
        tallyItemName: { fontSize: '14px', fontWeight: 'bold', textAlign: 'center', marginBottom: '5px', height: '35px', overflow: 'hidden', display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center' },
        tallyPrice: { fontSize: '12px', color: '#888', marginBottom: '8px' },
        tallyControls: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'center' },
        tallyBtn: { width: '40px', height: '40px', fontSize: '20px', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        tallyCount: { fontSize: '24px', fontWeight: 'bold', minWidth: '40px', textAlign: 'center' },
        nav: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1e1e1e', display: 'flex', borderTop: '1px solid #333', height: '70px', zIndex: 100 },
        navItem: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', fontSize: '14px' },
        table: { width: '100%', borderCollapse: 'collapse' },
        th: { color: '#888', fontSize: '14px', padding: '12px 5px', borderBottom: '2px solid #333', textAlign: 'left' },
        td: { padding: '14px 5px', borderBottom: '1px solid #222', fontSize: '16px', verticalAlign: 'middle' },
        reportCard: { background: '#252525', padding: '15px', borderRadius: '8px', textAlign: 'center', border: '1px solid #333' }
    };

    if (!user) return (
        <div style={{ ...styles.container, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ ...styles.card, width: '100%', maxWidth: '400px' }}>
                <h1 style={{ color: '#007BFF', textAlign: 'center' }}>VesPoint</h1>
                <input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter PIN" type="password" style={styles.input} />
                <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...styles.input, marginTop: '15px' }}>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                </select>
                <button onClick={handleLogin} style={{ ...styles.btnPrimary, marginTop: '20px' }}>LOG IN</button>
            </div>
        </div>
    );

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div>
                    <h2 style={{ color: '#007BFF', margin: 0 }}>VesPoint</h2>
                    <small style={{ color: '#888' }}>{user.name} ({user.role.toUpperCase()})</small>
                </div>
                <button onClick={() => { setUser(null); localStorage.removeItem('vespoint_token'); }} style={{ background: '#cf6679', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer' }}>Exit</button>
            </div>

            {view === 'dashboard' && (
                <>
                    {/* Date Selector */}
                    <div style={{ ...styles.card, display: 'flex', gap: '10px' }}>
                        <button onClick={() => { let d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().split('T')[0]); }} style={{ flex: 1, background: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>◀</button>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...styles.input, flex: 3, textAlign: 'center' }} />
                        <button onClick={() => { let d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().split('T')[0]); }} style={{ flex: 1, background: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>▶</button>
                    </div>

                    {/* Financial Stats (Manager & Admin only) */}
                    {user.role !== 'employee' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                            <div style={styles.card}>
                                <span style={{ fontSize: '12px', color: '#888' }}>REVENUE ({date})</span>
                                <div style={{ color: '#03dac6', fontWeight: 'bold' }}>{formatPHP(finance?.revenue)}</div>
                            </div>
                            <div style={styles.card}>
                                <span style={{ fontSize: '12px', color: '#888' }}>NET PROFIT ({date})</span>
                                <div style={{ fontWeight: 'bold', color: (finance?.netProfit || 0) >= 0 ? '#03dac6' : '#cf6679' }}>{formatPHP(finance?.netProfit)}</div>
                            </div>
                        </div>
                    )}

                    {/* QUICK ADD PRODUCT FORM */}
                    <div style={{ ...styles.card, border: '1px solid #007BFF' }}>
                        <h3 style={{ marginTop: 0, color: '#007BFF', textAlign: 'center', fontSize: '16px' }}>+ Register New Product</h3>
                        <form onSubmit={handleAddItem} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                            <input placeholder="Product Name" value={itemName} onChange={e => setItemName(e.target.value)} style={styles.input} required />
                            <input type="number" step="0.01" placeholder="Price ₱" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} style={styles.input} required />
                            <button type="submit" style={{ ...styles.btnPrimary, padding: '14px 20px', width: 'auto' }}>ADD</button>
                        </form>
                    </div>

                    {/* PROFESSIONAL TALLY GRID */}
                    <div style={{ ...styles.card, border: '1px solid #ffb74d', background: '#1a1810' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h3 style={{ marginTop: 0, color: '#ffb74d', margin: 0, fontSize: '18px' }}>Quick Tally Sheet</h3>
                            <button onClick={handleBatchSubmit} style={{ background: '#ffb74d', color: '#000', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
                                SUBMIT ALL
                            </button>
                        </div>
                        
                        {items.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#888' }}>No items registered. Use the form above to add one.</p>
                        ) : (
                            <div style={styles.tallyGrid}>
                                {items.map(item => (
                                    <div key={item.id} style={styles.tallyCard}>
                                        <div style={styles.tallyItemName}>
                                            {item.name.length > 15 ? item.name.slice(0, 15) + '...' : item.name}
                                        </div>
                                        <div style={styles.tallyPrice}>{formatPHP(item.unit_price)}</div>
                                        <div style={styles.tallyControls}>
                                            <button onClick={() => updateTally(item.id, 'sold', -1)} style={{ ...styles.tallyBtn, background: '#333', color: '#fff' }}>-</button>
                                            <span style={styles.tallyCount}>{tally[item.id]?.sold || 0}</span>
                                            <button onClick={() => updateTally(item.id, 'sold', 1)} style={{ ...styles.tallyBtn, background: '#007BFF', color: '#fff' }}>+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* DAILY LOGS TABLE */}
                    <div style={styles.card}>
                        <h3 style={{ marginTop: 0, textAlign: 'center', color: '#007BFF', fontSize: '18px' }}>Daily Logs ({date})</h3>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={{ ...styles.th, width: '40%' }}>Item / Date</th>
                                    <th style={{ ...styles.th, width: '15%', textAlign: 'center' }}>Qty</th>
                                    <th style={{ ...styles.th, width: '25%', textAlign: 'right' }}>Value</th>
                                    <th style={{ ...styles.th, width: '20%', textAlign: 'center' }}>Stat</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr><td colSpan="4" style={{ ...styles.td, textAlign: 'center', color: '#666' }}>No logs for this date.</td></tr>
                                ) : (
                                    logs.map(log => (
                                        <tr key={log.id}>
                                            <td style={styles.td}>
                                                <div style={{ fontWeight: 'bold' }}>{log.item_name}</div>
                                                <div style={{ fontSize: '11px', color: '#777' }}>{log.date} · {log.employee_name}</div>
                                            </td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>{log.qty_sold}</td>
                                            <td style={{ ...styles.td, textAlign: 'right' }}>
                                                {user.role !== 'employee' ? (
                                                    <input type="number" defaultValue={log.verified_value_sold || log.value_sold} id={`val-${log.id}`} style={{ width: '65px', background: '#333', color: '#fff', border: '1px solid #444', padding: '6px', textAlign: 'right', borderRadius: '4px' }} />
                                                ) : (
                                                    formatPHP(log.value_sold)
                                                )}
                                            </td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                                                    {/* Verify Button (Only if Pending & Not Employee) */}
                                                    {log.status === 'pending' && user.role !== 'employee' && (
                                                        <button 
                                                            onClick={() => verifyLog(log.id, document.getElementById(`val-${log.id}`).value)} 
                                                            style={{ background: '#03dac6', border: 'none', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                                                        >
                                                            OK
                                                        </button>
                                                    )}
                                                    
                                                    {/* Status Display */}
                                                    <span style={{ fontSize: '11px', color: log.status === 'verified' ? '#03dac6' : '#888' }}>
                                                        {log.status.toUpperCase()}
                                                    </span>

                                                    {/* Delete Button (Only for Manager/Admin) */}
                                                    {user.role !== 'employee' && (
                                                        <button 
                                                            onClick={() => handleDeleteLog(log.id, log.date)} 
                                                            style={{ background: '#cf6679', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                                            title="Delete Log"
                                                        >
                                                            DEL
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* PRODUCT MASTER LIST (MOVED TO DASHBOARD FOR EMPLOYEE ACCESS) */}
                    <div style={styles.card}>
                        <h4 style={{ color: '#888', marginTop: 0, fontSize: '16px' }}>Product Master List</h4>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={{ ...styles.th, width: '50%' }}>Product</th>
                                    <th style={{ ...styles.th, width: '30%', textAlign: 'right' }}>Price</th>
                                    <th style={{ ...styles.th, width: '20%', textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 ? (
                                    <tr><td colSpan="3" style={{ ...styles.td, textAlign: 'center', color: '#777' }}>No products registered.</td></tr>
                                ) : (
                                    items.map(i => (
                                        <tr key={i.id}>
                                            <td style={styles.td}><b>{i.name}</b></td>
                                            <td style={{ ...styles.td, textAlign: 'right' }}>{formatPHP(i.unit_price)}</td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>
                                                {/* ALL AUTHENTICATED USERS CAN DELETE */}
                                                <button onClick={() => handleDeleteItem(i.id)} style={styles.btnDelete}>DEL</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {view === 'management' && user.role !== 'employee' && (
                <>
                    {/* ADMIN ONLY: CREATE EMPLOYEE / MANAGER ACCOUNT */}
                    {user.role === 'admin' && (
                        <div style={{ ...styles.card, border: '1px solid #007BFF' }}>
                            <h3 style={{ marginTop: 0, color: '#007BFF', fontSize: '18px' }}>Create Staff Account</h3>
                            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <input 
                                    placeholder="Staff Full Name" 
                                    value={newStaffName} 
                                    onChange={e => setNewStaffName(e.target.value)} 
                                    style={styles.input} 
                                    required 
                                />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <select value={newStaffRole} onChange={e => setNewStaffRole(e.target.value)} style={styles.input}>
                                        <option value="employee">Employee</option>
                                        <option value="manager">Manager</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                    <input 
                                        type="password" 
                                        placeholder="Assign PIN" 
                                        value={newStaffPin} 
                                        onChange={e => setNewStaffPin(e.target.value)} 
                                        style={styles.input} 
                                        required 
                                    />
                                </div>
                                <button type="submit" style={styles.btnPrimary}>CREATE STAFF ACCOUNT</button>
                            </form>
                        </div>
                    )}

                    {/* UPDATED: ACTIVE STAFF (Employees & Managers) WITH DELETE OPTION */}
                    <div style={styles.card}>
                        <h4 style={{ color: '#888', marginTop: 0, fontSize: '16px' }}>Active Staff (Employees & Managers)</h4>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={{ ...styles.th, width: '40%' }}>Name</th>
                                    <th style={{ ...styles.th, width: '30%', textAlign: 'center' }}>Role</th>
                                    <th style={{ ...styles.th, width: '30%', textAlign: 'right' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usersList.filter(u => u.role === 'employee' || u.role === 'manager').map(u => (
                                    <tr key={u.id}>
                                        <td style={styles.td}><b>{u.name}</b></td>
                                        <td style={{ ...styles.td, textAlign: 'center' }}>
                                            <span style={{ 
                                                background: u.role === 'manager' ? '#bb86fc22' : '#444', 
                                                color: u.role === 'manager' ? '#bb86fc' : '#aaa',
                                                padding: '4px 8px', 
                                                borderRadius: '4px', 
                                                fontSize: '12px', 
                                                fontWeight: 'bold'
                                            }}>
                                                {u.role.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ ...styles.td, textAlign: 'right' }}>
                                            {user.role === 'admin' && (
                                                <button 
                                                    onClick={() => handleDeleteStaff(u.id)} 
                                                    style={{ 
                                                        background: '#cf6679', 
                                                        color: 'white', 
                                                        border: 'none', 
                                                        padding: '6px 10px', 
                                                        borderRadius: '4px', 
                                                        fontSize: '12px', 
                                                        fontWeight: 'bold', 
                                                        cursor: 'pointer' 
                                                    }}
                                                >
                                                    DEL
                                                </button>
                                            )}
                                            {user.role === 'manager' && <span style={{ color: '#666', fontSize: '12px' }}>—</span>}
                                        </td>
                                    </tr>
                                ))}
                                {usersList.filter(u => u.role === 'employee' || u.role === 'manager').length === 0 && (
                                    <tr><td colSpan="3" style={{ ...styles.td, textAlign: 'center', color: '#777' }}>No active staff found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* RECORD SALARY */}
                    <div style={{ ...styles.card, border: '1px solid #bb86fc', background: '#18121e' }}>
                        <h4 style={{ color: '#bb86fc', marginTop: 0, fontSize: '16px' }}>Record Employee Salary</h4>
                        <form onSubmit={handleSalarySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <select value={selectedUserPay} onChange={e => setSelectedUserPay(e.target.value)} style={styles.input}>
                                {usersList.filter(u => u.role === 'employee' || u.role === 'manager').map(u => <option key={u.id} value={u.id} style={{ background: '#1e1e1e' }}>{u.name} ({u.role})</option>)}
                                {usersList.filter(u => u.role === 'employee' || u.role === 'manager').length === 0 && <option value="">No Staff</option>}
                            </select>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <input type="number" step="0.01" placeholder="Amount ₱" value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} style={styles.input} required />
                                <input type="date" value={salaryDate} onChange={e => setSalaryDate(e.target.value)} style={styles.input} required />
                            </div>
                            <button type="submit" style={{ ...styles.btnPrimary, background: '#bb86fc', color: '#000' }}>RECORD PAYMENT</button>
                        </form>
                    </div>

                    {/* FULL PAYROLL HISTORY TABLE */}
                    <div style={{ ...styles.card, background: '#18121e' }}>
                        <h4 style={{ color: '#bb86fc', marginTop: 0, fontSize: '16px' }}>Payroll History</h4>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={{ ...styles.th, width: '35%' }}>Date</th>
                                    <th style={{ ...styles.th, width: '35%' }}>Employee</th>
                                    <th style={{ ...styles.th, width: '30%', textAlign: 'right' }}>Paid</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allPayrollHistory.length === 0 ? (
                                    <tr><td colSpan="3" style={{ ...styles.td, textAlign: 'center', color: '#777' }}>No payroll records yet.</td></tr>
                                ) : (
                                    allPayrollHistory.map(p => (
                                        <tr key={p.id}>
                                            <td style={styles.td}>{p.date}</td>
                                            <td style={styles.td}><b>{p.employee_name}</b></td>
                                            <td style={{ ...styles.td, textAlign: 'right', color: '#bb86fc', fontWeight: 'bold' }}>{formatPHP(p.amount)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* NEW: REPORTS TAB (Admin/Manager Only) */}
            {view === 'reports' && user.role !== 'employee' && (
                <div>
                    <div style={{ ...styles.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, color: '#007BFF', fontSize: '18px' }}>Daily Report Summary</h3>
                        <input 
                            type="date" 
                            value={reportDate} 
                            onChange={(e) => setReportDate(e.target.value)} 
                            style={{ ...styles.input, width: '150px', padding: '8px' }} 
                        />
                    </div>

                    {report ? (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                                <div style={styles.reportCard}>
                                    <div style={{ color: '#888', fontSize: '12px', marginBottom: '5px' }}>TOTAL REVENUE</div>
                                    <div style={{ color: '#03dac6', fontWeight: 'bold', fontSize: '24px' }}>{formatPHP(report.total_revenue)}</div>
                                </div>
                                <div style={styles.reportCard}>
                                    <div style={{ color: '#888', fontSize: '12px', marginBottom: '5px' }}>NET PROFIT</div>
                                    <div style={{ color: report.net_profit >= 0 ? '#03dac6' : '#cf6679', fontWeight: 'bold', fontSize: '24px' }}>{formatPHP(report.net_profit)}</div>
                                </div>
                                <div style={styles.reportCard}>
                                    <div style={{ color: '#888', fontSize: '12px', marginBottom: '5px' }}>TOTAL LABOR</div>
                                    <div style={{ color: '#bb86fc', fontWeight: 'bold', fontSize: '24px' }}>{formatPHP(report.total_labor)}</div>
                                </div>
                                <div style={styles.reportCard}>
                                    <div style={{ color: '#888', fontSize: '12px', marginBottom: '5px' }}>STATUS</div>
                                    <div style={{ fontSize: '16px', marginTop: '5px' }}>
                                        <span style={{ color: '#ffb74d' }}>{report.pending_count} Pending</span> / <span style={{ color: '#03dac6' }}>{report.verified_count} Verified</span>
                                    </div>
                                </div>
                            </div>

                            <div style={styles.card}>
                                <h4 style={{ color: '#ffb74d', margin: '0 0 10px 0', fontSize: '16px' }}>🏆 Top Selling Item</h4>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{report.top_item_name}</div>
                                        <div style={{ color: '#888', fontSize: '14px' }}>Qty Sold: {report.top_item_qty}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ color: '#03dac6', fontWeight: 'bold' }}>{formatPHP(report.top_item_revenue)}</div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={styles.card}>
                            <p style={{ color: '#888', textAlign: 'center' }}>
                                No report generated for {reportDate} yet.<br/>
                                <small>(Reports are auto-generated at midnight for the previous day)</small>
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Bottom Navigation */}
            <div style={styles.nav}>
                <div onClick={() => setView('dashboard')} style={{ ...styles.navItem, color: view === 'dashboard' ? '#007BFF' : '#888' }}>
                    <div style={{ fontSize: '24px' }}>📊</div>
                    <div>Dashboard</div>
                </div>
                {user.role !== 'employee' && (
                    <div onClick={() => setView('management')} style={{ ...styles.navItem, color: view === 'management' ? '#bb86fc' : '#888' }}>
                        <div style={{ fontSize: '24px' }}>⚙️</div>
                        <div>Manage</div>
                    </div>
                )}
                {user.role !== 'employee' && (
                    <div onClick={() => setView('reports')} style={{ ...styles.navItem, color: view === 'reports' ? '#ffb74d' : '#888' }}>
                        <div style={{ fontSize: '24px' }}>📈</div>
                        <div>Reports</div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
