import { useState, useEffect } from 'react';
import { db } from "./firebase";
import { 
  collection, query, where, orderBy, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, serverTimestamp 
} from 'firebase/firestore';
import bcrypt from 'bcryptjs';

function App() {
    const [user, setUser] = useState(null);
    const [view, setView] = useState('dashboard');
    const [historyTab, setHistoryTab] = useState('staff');
    const [pin, setPin] = useState('');
    const [role, setRole] = useState('employee');

    // --- REFRESH STATE ---
    const [refreshKey, setRefreshKey] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    // ---------------------

    const [logs, setLogs] = useState([]);
    const [allPayrollHistory, setAllPayrollHistory] = useState([]);
    const [expensesList, setExpensesList] = useState([]);
    const [items, setItems] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [finance, setFinance] = useState({ revenue: 0, cogs: 0, labor: 0, expenses: 0, netProfit: 0 });
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    
    const [report, setReport] = useState(null);
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

    const [tally, setTally] = useState({});

    const [itemName, setItemName] = useState('');
    const [unitPrice, setUnitPrice] = useState('');

    const [selectedUserPay, setSelectedUserPay] = useState('');
    const [salaryAmount, setSalaryAmount] = useState('');
    const [salaryDate, setSalaryDate] = useState(new Date().toISOString().split('T')[0]);

    const [expenseName, setExpenseName] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

    const [newStaffName, setNewStaffName] = useState('');
    const [newStaffRole, setNewStaffRole] = useState('employee');
    const [newStaffPin, setNewStaffPin] = useState('');

    const usersCollection = collection(db, 'users');
    const itemsCollection = collection(db, 'items');
    const inventoryLogsCollection = collection(db, 'inventory_logs');
    const payrollLogsCollection = collection(db, 'payroll_logs');
    const dailyReportsCollection = collection(db, 'daily_reports');
    const expensesCollection = collection(db, 'expenses');

    useEffect(() => {
        const saved = localStorage.getItem('vespoint_user');
        if (saved) setUser(JSON.parse(saved));
    }, []);

    // --- UPDATED: Added refreshKey to dependency array ---
    useEffect(() => {
        if (user) {
            loadItems();
            loadLogs();
            if (user.role !== 'employee') {
                loadPayroll();
                loadExpenses();
                loadFinance();
                loadUsers();
            }
        }
    }, [user, date, view, refreshKey]); // <-- refreshKey added

    // --- UPDATED: Added refreshKey to dependency array ---
    useEffect(() => {
        if (user && user.role !== 'employee' && view === 'reports') {
            loadReport(reportDate);
        }
    }, [view, reportDate, user, refreshKey]); // <-- refreshKey added

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

    // --- NEW: Refresh handler ---
    const handleRefresh = () => {
        setIsRefreshing(true);
        setRefreshKey(prev => prev + 1);
        // Reset the refreshing state after a short delay
        setTimeout(() => setIsRefreshing(false), 1000);
    };
    // ----------------------------

    const handleLogin = async () => {
        try {
            const q = query(usersCollection, where('role', '==', role));
            const snap = await getDocs(q);
            const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const found = users.find(u => bcrypt.compareSync(pin, u.pin_hash));
            
            if (found) {
                setUser(found);
                localStorage.setItem('vespoint_user', JSON.stringify(found));
            } else {
                alert('Invalid PIN or Role');
            }
        } catch (e) {
            alert('Connection Error: ' + e.message);
        }
    };

    const loadItems = async () => {
        try {
            const q = query(itemsCollection, orderBy('name'));
            const snap = await getDocs(q);
            setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
    };

    const loadUsers = async () => {
        try {
            const q = query(usersCollection, where('role', 'in', ['employee', 'manager']));
            const snap = await getDocs(q);
            setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
    };

    const loadLogs = async () => {
        try {
            const q = query(inventoryLogsCollection, where('date', '==', date), orderBy('date', 'desc'));
            const snap = await getDocs(q);
            setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
    };

    const loadPayroll = async () => {
        try {
            const snap = await getDocs(payrollLogsCollection);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            setAllPayrollHistory(data);
        } catch (e) { console.error(e); }
    };

    const loadExpenses = async () => {
        try {
            const snap = await getDocs(expensesCollection);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            setExpensesList(data);
        } catch (e) { console.error(e); }
    };

    const loadFinance = async () => {
        try {
            const logsQuery = query(inventoryLogsCollection, where('date', '==', date));
            const logsSnap = await getDocs(logsQuery);
            const logsData = logsSnap.docs.map(d => d.data());

            const payrollQuery = query(payrollLogsCollection, where('date', '==', date));
            const payrollSnap = await getDocs(payrollQuery);
            const payrollData = payrollSnap.docs.map(d => d.data());

            const expensesQuery = query(expensesCollection, where('date', '==', date));
            const expensesSnap = await getDocs(expensesQuery);
            const expensesData = expensesSnap.docs.map(d => d.data());

            const revenue = logsData.reduce((sum, l) => sum + (l.verified_value_sold || l.value_sold || 0), 0);
            const labor = payrollData.reduce((sum, p) => sum + p.amount, 0);
            const cogs = logsData.reduce((sum, l) => sum + ((l.unit_cost || 0) * (l.qty_sold || 0)), 0);
            const totalExpenses = expensesData.reduce((sum, e) => sum + e.amount, 0);
            
            const netProfit = revenue - cogs - labor - totalExpenses;

            setFinance({ revenue, cogs, labor, expenses: totalExpenses, netProfit });
        } catch (e) { console.error(e); }
    };

    const loadReport = async (d) => {
        try {
            const q = query(dailyReportsCollection, where('report_date', '==', d));
            const snap = await getDocs(q);
            if (!snap.empty) {
                setReport({ id: snap.docs[0].id, ...snap.docs[0].data() });
            } else {
                setReport(null);
            }
        } catch (e) { console.error(e); }
    };

    const formatPHP = (val) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0);

    const updateTally = (itemId, field, delta) => {
        setTally(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: Math.max(0, ((prev[itemId] && prev[itemId][field]) || 0) + delta)
            }
        }));
    };

    const handleBatchSubmit = async () => {
        const entries = Object.entries(tally).filter(([id, data]) => data.sold > 0);
        if (entries.length === 0) return alert('Nothing tallied yet!');
        
        try {
            for (const [itemId, data] of entries) {
                const item = items.find(i => i.id === itemId);
                if (!item) continue;
                
                await addDoc(inventoryLogsCollection, {
                    item_id: itemId,
                    item_name: item.name,
                    unit_cost: item.unit_cost || 0,
                    unit_price: item.unit_price,
                    qty_sold: data.sold,
                    value_sold: data.sold * item.unit_price,
                    notes: 'Batch Tally',
                    date,
                    user_id: user.id,
                    employee_name: user.name,
                    status: 'pending',
                    created_at: serverTimestamp()
                });
            }
            alert('All counts submitted!');
            loadLogs();
            loadFinance();
            const reset = {};
            items.forEach(i => { reset[i.id] = { sold: 0 }; });
            setTally(reset);
        } catch (e) { alert('Error submitting: ' + e.message); }
    };

    const handleCreateStaff = async (e) => {
        e.preventDefault();
        try {
            const pinHash = bcrypt.hashSync(newStaffPin, 10);
            await addDoc(usersCollection, {
                name: newStaffName,
                role: newStaffRole,
                pin_hash: pinHash,
                created_at: serverTimestamp()
            });
            alert(`Account created for ${newStaffName}!`);
            setNewStaffName('');
            setNewStaffPin('');
            loadUsers();
        } catch (err) { alert('Error: ' + err.message); }
    };

    const handleDeleteStaff = async (id) => {
        if (!window.confirm('Delete this staff account?')) return;
        try {
            await deleteDoc(doc(db, 'users', id));
            alert('Account deleted.');
            loadUsers();
            loadPayroll();
        } catch (err) { alert('Error: ' + err.message); }
    };

    const handleSalarySubmit = async (e) => {
        e.preventDefault();
        if (!selectedUserPay) return alert('Please select a staff member.');
        try {
            const emp = usersList.find(u => u.id === selectedUserPay);
            await addDoc(payrollLogsCollection, {
                user_id: selectedUserPay,
                employee_name: emp ? emp.name : 'Unknown',
                amount: parseFloat(salaryAmount),
                date: salaryDate,
                notes: 'Salary',
                created_at: serverTimestamp()
            });
            alert('Salary recorded!');
            setSalaryAmount('');
            loadPayroll();
            loadFinance();
        } catch (e) { alert('Error: ' + e.message); }
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!expenseName || !expenseAmount) return;
        try {
            await addDoc(expensesCollection, {
                item_name: expenseName,
                amount: parseFloat(expenseAmount),
                date: expenseDate,
                added_by: user.name,
                created_at: serverTimestamp()
            });
            alert('Expense recorded!');
            setExpenseName('');
            setExpenseAmount('');
            loadExpenses();
            loadFinance();
        } catch (e) { alert('Error: ' + e.message); }
    };

    const handleDeleteExpense = async (id) => {
        if (!window.confirm('Delete this expense?')) return;
        try {
            await deleteDoc(doc(db, 'expenses', id));
            alert('Expense deleted.');
            loadExpenses();
            loadFinance();
        } catch (e) { alert('Error deleting expense: ' + e.message); }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        if (!itemName || !unitPrice) return;
        try {
            await addDoc(itemsCollection, {
                name: itemName,
                unit_cost: 0,
                unit_price: parseFloat(unitPrice),
                created_at: serverTimestamp()
            });
            alert('Product registered!');
            setItemName('');
            setUnitPrice('');
            loadItems();
        } catch (e) { alert('Error: ' + e.message); }
    };

    const handleDeleteItem = async (id) => {
        if (!window.confirm('Delete this product?')) return;
        try {
            await deleteDoc(doc(db, 'items', id));
            setItems(prev => prev.filter(i => i.id !== id));
            setTally(prev => {
                const updated = { ...prev };
                delete updated[id];
                return updated;
            });
            loadLogs();
        } catch (err) { alert('Error: ' + err.message); }
    };

    const handleDeleteLog = async (logId) => {
        if (!window.confirm('Delete this log entry?')) return;
        try {
            await deleteDoc(doc(db, 'inventory_logs', logId));
            loadLogs();
            loadFinance();
        } catch (e) { alert('Error deleting log: ' + e.message); }
    };

    const handleDeletePayroll = async (payId) => {
        if (!window.confirm('Delete this payroll record? Profit for that date will be restored.')) return;
        try {
            const payRef = doc(db, 'payroll_logs', payId);
            const record = (await getDoc(payRef)).data();

            await deleteDoc(payRef);

            const q = query(dailyReportsCollection, where('report_date', '==', record.date));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const rep = snap.docs[0];
                const d = rep.data();
                await updateDoc(doc(db, 'daily_reports', rep.id), {
                    total_labor: Math.max(0, (d.total_labor || 0) - (record.amount || 0)),
                    net_profit: (d.net_profit || 0) + (record.amount || 0),
                });
                if (reportDate === record.date) loadReport(reportDate);
            }

            loadPayroll();
            loadFinance();
            alert('Payroll deleted. Profit restored.');
        } catch (e) { alert('Error deleting payroll: ' + e.message); }
    };

    const verifyLog = async (logId, value) => {
        try {
            await updateDoc(doc(db, 'inventory_logs', logId), {
                verified_value_sold: parseFloat(value),
                status: 'verified'
            });
            loadLogs();
            loadFinance();
        } catch (e) { alert('Error: ' + e.message); }
    };

    const styles = {
        container: { padding: '15px', paddingBottom: '100px', fontFamily: 'system-ui, sans-serif', background: '#121212', color: '#e0e0e0', minHeight: '100vh', fontSize: '18px' },
        card: { background: '#1e1e1e', padding: '20px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.4)' },
        input: { background: '#2c2c2c', border: '1px solid #444', color: '#fff', padding: '14px', borderRadius: '8px', fontSize: '18px', width: '100%', boxSizing: 'border-box' },
        btnPrimary: { background: '#007BFF', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: 'bold', fontSize: '18px', width: '100%', cursor: 'pointer' },
        btnDelete: { background: '#cf6679', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
        btnDeleteSmall: { background: '#cf6679', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
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
        reportCard: { background: '#252525', padding: '15px', borderRadius: '8px', textAlign: 'center', border: '1px solid #333' },
        subTabs: { display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto' }
    };

    const subTabStyle = (active, color) => ({
        flex: 1,
        minWidth: '100px',
        padding: '12px 10px',
        borderRadius: '8px',
        border: `1px solid ${active ? color : '#333'}`,
        background: active ? `${color}22` : '#1e1e1e',
        color: active ? color : '#888',
        fontWeight: 'bold',
        fontSize: '15px',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
    });

    const staffOnly = usersList.filter(u => u.role === 'employee' || u.role === 'manager');

    if (!user) return (
        <div style={{ ...styles.container, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ ...styles.card, width: '100%', maxWidth: '400px' }}>
                <h1 style={{ color: '#007BFF', textAlign: 'center' }}>VesPoint</h1>
                <input value={pin} onChange={e => setPin(e.target.value)} placeholder="Enter PIN" type="password" style={styles.input} />
                <select value={role} onChange={e => setRole(e.target.value)} style={{ ...styles.input, marginTop: '15px' }}>
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
            {/* --- UPDATED HEADER WITH REFRESH BUTTON --- */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div>
                    <h2 style={{ color: '#007BFF', margin: 0 }}>VesPoint</h2>
                    <small style={{ color: '#888' }}>{user.name} ({user.role.toUpperCase()})</small>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        onClick={handleRefresh} 
                        disabled={isRefreshing}
                        style={{ 
                            background: isRefreshing ? '#555' : '#007BFF', 
                            color: '#fff', 
                            border: 'none', 
                            borderRadius: '6px', 
                            padding: '8px 16px', 
                            cursor: isRefreshing ? 'not-allowed' : 'pointer',
                            opacity: isRefreshing ? 0.7 : 1
                        }}
                    >
                        {isRefreshing ? 'Refreshing…' : '🔄 Refresh'}
                    </button>
                    <button onClick={() => { setUser(null); localStorage.removeItem('vespoint_user'); }} style={{ background: '#cf6679', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer' }}>Exit</button>
                </div>
            </div>
            {/* ------------------------------------------- */}

            {view === 'dashboard' && (
                <>
                    <div style={{ ...styles.card, display: 'flex', gap: '10px' }}>
                        <button onClick={() => { let d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().split('T')[0]); }} style={{ flex: 1, background: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>◀</button>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...styles.input, flex: 3, textAlign: 'center' }} />
                        <button onClick={() => { let d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().split('T')[0]); }} style={{ flex: 1, background: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>▶</button>
                    </div>

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
                            <div style={styles.card}>
                                <span style={{ fontSize: '12px', color: '#888' }}>TOTAL EXPENSES ({date})</span>
                                <div style={{ color: '#cf6679', fontWeight: 'bold' }}>{formatPHP(finance?.expenses)}</div>
                            </div>
                            <div style={styles.card}>
                                <span style={{ fontSize: '12px', color: '#888' }}>TOTAL LABOR ({date})</span>
                                <div style={{ color: '#bb86fc', fontWeight: 'bold' }}>{formatPHP(finance?.labor)}</div>
                            </div>
                        </div>
                    )}

                    <div style={{ ...styles.card, border: '1px solid #007BFF' }}>
                        <h3 style={{ marginTop: 0, color: '#007BFF', textAlign: 'center', fontSize: '16px' }}>+ Register New Product</h3>
                        <form onSubmit={handleAddItem} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                            <input placeholder="Product Name" value={itemName} onChange={e => setItemName(e.target.value)} style={styles.input} required />
                            <input type="number" step="0.01" placeholder="Price ₱" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} style={styles.input} required />
                            <button type="submit" style={{ ...styles.btnPrimary, padding: '14px 20px', width: 'auto' }}>ADD</button>
                        </form>
                    </div>

                    <div style={{ ...styles.card, border: '1px solid #ffb74d', background: '#1a1810' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h3 style={{ marginTop: 0, color: '#ffb74d', margin: 0, fontSize: '18px' }}>Quick Tally Sheet</h3>
                            <button onClick={handleBatchSubmit} style={{ background: '#ffb74d', color: '#000', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>SUBMIT ALL</button>
                        </div>
                        {items.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#888' }}>No items registered. Use the form above to add one.</p>
                        ) : (
                            <div style={styles.tallyGrid}>
                                {items.map(item => (
                                    <div key={item.id} style={styles.tallyCard}>
                                        <div style={styles.tallyItemName}>{item.name.length > 15 ? item.name.slice(0, 15) + '...' : item.name}</div>
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

                    <div style={styles.card}>
                        <h3 style={{ marginTop: 0, textAlign: 'center', color: '#007BFF', fontSize: '18px' }}>Today's Logs ({date})</h3>
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
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                                                    {log.status === 'pending' && user.role !== 'employee' ? (
                                                        <button onClick={() => verifyLog(log.id, document.getElementById(`val-${log.id}`).value)} style={{ background: '#03dac6', border: 'none', borderRadius: '4px', padding: '6px 8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>OK</button>
                                                    ) : (
                                                        <span style={{ fontSize: '11px', color: log.status === 'verified' ? '#03dac6' : '#888' }}>{log.status.toUpperCase()}</span>
                                                    )}
                                                    {(user.role !== 'employee' || (log.user_id === user.id && log.status === 'pending')) && (
                                                        <button onClick={() => handleDeleteLog(log.id)} style={{ background: '#cf6679', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>DEL</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

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
                                                <button onClick={() => handleDeleteItem(i.id)} style={styles.btnDeleteSmall}>DEL</button>
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
                    {user.role === 'admin' && (
                        <div style={{ ...styles.card, border: '1px solid #007BFF' }}>
                            <h3 style={{ marginTop: 0, color: '#007BFF', fontSize: '18px' }}>Create Staff Account</h3>
                            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <input placeholder="Staff Full Name" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} style={styles.input} required />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <select value={newStaffRole} onChange={e => setNewStaffRole(e.target.value)} style={styles.input}>
                                        <option value="employee">Employee</option>
                                        <option value="manager">Manager</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                    <input type="password" placeholder="Assign PIN" value={newStaffPin} onChange={e => setNewStaffPin(e.target.value)} style={styles.input} required />
                                </div>
                                <button type="submit" style={styles.btnPrimary}>CREATE STAFF ACCOUNT</button>
                            </form>
                        </div>
                    )}

                    <div style={{ ...styles.card, border: '1px solid #bb86fc', background: '#18121e' }}>
                        <h4 style={{ color: '#bb86fc', marginTop: 0, fontSize: '16px' }}>Record Employee Salary</h4>
                        <form onSubmit={handleSalarySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <select value={selectedUserPay} onChange={e => setSelectedUserPay(e.target.value)} style={styles.input}>
                                {staffOnly.map(u => <option key={u.id} value={u.id} style={{ background: '#1e1e1e' }}>{u.name} ({u.role})</option>)}
                                {staffOnly.length === 0 && <option value="">No Staff</option>}
                            </select>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <input type="number" step="0.01" placeholder="Amount ₱" value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} style={styles.input} required />
                                <input type="date" value={salaryDate} onChange={e => setSalaryDate(e.target.value)} style={styles.input} required />
                            </div>
                            <button type="submit" style={{ ...styles.btnPrimary, background: '#bb86fc', color: '#000' }}>RECORD PAYMENT</button>
                        </form>
                    </div>

                    <div style={{ ...styles.card, border: '1px solid #cf6679', background: '#1e1414' }}>
                        <h4 style={{ color: '#cf6679', marginTop: 0, fontSize: '16px' }}>Record Expense / Purchase</h4>
                        <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <input placeholder="Item/Expense Name (e.g., Coffee Beans)" value={expenseName} onChange={e => setExpenseName(e.target.value)} style={styles.input} required />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <input type="number" step="0.01" placeholder="Amount ₱" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} style={styles.input} required />
                                <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} style={styles.input} required />
                            </div>
                            <button type="submit" style={{ ...styles.btnPrimary, background: '#cf6679', color: '#fff' }}>ADD EXPENSE</button>
                        </form>
                    </div>
                </>
            )}

            {view === 'history' && user.role !== 'employee' && (
                <div>
                    <h2 style={{ color: '#ff9800', marginBottom: '15px' }}>History & Records</h2>

                    <div style={styles.subTabs}>
                        <button onClick={() => setHistoryTab('staff')} style={subTabStyle(historyTab === 'staff', '#007BFF')}>👥 Staff</button>
                        <button onClick={() => setHistoryTab('payroll')} style={subTabStyle(historyTab === 'payroll', '#bb86fc')}>💸 Payroll</button>
                        <button onClick={() => setHistoryTab('expenses')} style={subTabStyle(historyTab === 'expenses', '#cf6679')}>🧾 Expenses</button>
                    </div>

                    {historyTab === 'staff' && (
                        <div style={styles.card}>
                            <h4 style={{ color: '#888', marginTop: 0, fontSize: '16px' }}>Active Staff</h4>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={{ ...styles.th, width: '40%' }}>Name</th>
                                        <th style={{ ...styles.th, width: '30%', textAlign: 'center' }}>Role</th>
                                        <th style={{ ...styles.th, width: '30%', textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffOnly.map(u => (
                                        <tr key={u.id}>
                                            <td style={styles.td}><b>{u.name}</b></td>
                                            <td style={{ ...styles.td, textAlign: 'center' }}>
                                                <span style={{ background: u.role === 'manager' ? '#bb86fc22' : '#444', color: u.role === 'manager' ? '#bb86fc' : '#aaa', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                                                    {u.role.toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ ...styles.td, textAlign: 'right' }}>
                                                {user.role === 'admin' && (
                                                    <button onClick={() => handleDeleteStaff(u.id)} style={styles.btnDeleteSmall}>DEL</button>
                                                )}
                                                {user.role === 'manager' && <span style={{ color: '#666', fontSize: '12px' }}>—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                    {staffOnly.length === 0 && (
                                        <tr><td colSpan="3" style={{ ...styles.td, textAlign: 'center', color: '#777' }}>No active staff found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {historyTab === 'payroll' && (
                        <div style={{ ...styles.card, background: '#18121e' }}>
                            <h4 style={{ color: '#bb86fc', marginTop: 0, fontSize: '16px' }}>Payroll History</h4>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={{ ...styles.th, width: '35%' }}>Date</th>
                                        <th style={{ ...styles.th, width: '35%' }}>Employee</th>
                                        <th style={{ ...styles.th, width: '20%', textAlign: 'right' }}>Paid</th>
                                        <th style={{ ...styles.th, width: '10%', textAlign: 'center' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allPayrollHistory.length === 0 ? (
                                        <tr><td colSpan="4" style={{ ...styles.td, textAlign: 'center', color: '#777' }}>No payroll records yet.</td></tr>
                                    ) : (
                                        allPayrollHistory.map(p => (
                                            <tr key={p.id}>
                                                <td style={styles.td}>{p.date}</td>
                                                <td style={styles.td}><b>{p.employee_name || 'Staff'}</b></td>
                                                <td style={{ ...styles.td, textAlign: 'right', color: '#bb86fc', fontWeight: 'bold' }}>{formatPHP(p.amount)}</td>
                                                <td style={{ ...styles.td, textAlign: 'center' }}>
                                                    {user.role === 'admin' && (
                                                        <button onClick={() => handleDeletePayroll(p.id)} style={styles.btnDeleteSmall}>DEL</button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {historyTab === 'expenses' && (
                        <div style={{ ...styles.card, background: '#1e1414' }}>
                            <h4 style={{ color: '#cf6679', marginTop: 0, fontSize: '16px' }}>Expenses History</h4>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={{ ...styles.th, width: '30%' }}>Date</th>
                                        <th style={{ ...styles.th, width: '35%' }}>Item</th>
                                        <th style={{ ...styles.th, width: '25%', textAlign: 'right' }}>Amount</th>
                                        <th style={{ ...styles.th, width: '10%', textAlign: 'center' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expensesList.length === 0 ? (
                                        <tr><td colSpan="4" style={{ ...styles.td, textAlign: 'center', color: '#777' }}>No expenses recorded.</td></tr>
                                    ) : (
                                        expensesList.map(exp => (
                                            <tr key={exp.id}>
                                                <td style={styles.td}>{exp.date}</td>
                                                <td style={styles.td}><b>{exp.item_name}</b></td>
                                                <td style={{ ...styles.td, textAlign: 'right', color: '#cf6679', fontWeight: 'bold' }}>{formatPHP(exp.amount)}</td>
                                                <td style={{ ...styles.td, textAlign: 'center' }}>
                                                    <button onClick={() => handleDeleteExpense(exp.id)} style={styles.btnDeleteSmall}>DEL</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {view === 'reports' && user.role !== 'employee' && (
                <div>
                    <div style={{ ...styles.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, color: '#007BFF', fontSize: '18px' }}>Daily Report Summary</h3>
                        <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} style={{ ...styles.input, width: '150px', padding: '8px' }} />
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
                    <div onClick={() => setView('history')} style={{ ...styles.navItem, color: view === 'history' ? '#ff9800' : '#888' }}>
                        <div style={{ fontSize: '24px' }}>📜</div>
                        <div>History</div>
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
