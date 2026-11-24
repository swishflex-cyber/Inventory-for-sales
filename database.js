// database.js - Updated to use Firebase Firestore instead of SQLite
import { db } from "./firebase";
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import bcrypt from 'bcryptjs';

// Collections
const usersCollection = collection(db, 'users');
const itemsCollection = collection(db, 'items');
const inventoryLogsCollection = collection(db, 'inventory_logs');
const attendanceLogsCollection = collection(db, 'attendance_logs');
const payrollLogsCollection = collection(db, 'payroll_logs');
const dailyReportsCollection = collection(db, 'daily_reports');

// --- User Functions ---
export async function addUser(userData) {
  const docRef = await addDoc(usersCollection, {
    ...userData,
    pin_hash: bcrypt.hashSync(userData.pin, 10),
    created_at: serverTimestamp()
  });
  return docRef.id;
}

export async function getUserById(id) {
  const docRef = doc(db, 'users', id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

export async function getUserByPin(pin) {
  const q = query(usersCollection, where('pin_hash', '==', bcrypt.hashSync(pin, 10)));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateUser(id, updates) {
  const docRef = doc(db, 'users', id);
  await updateDoc(docRef, updates);
}

export async function deleteUser(id) {
  const docRef = doc(db, 'users', id);
  await deleteDoc(docRef);
}

// --- Items Functions ---
export async function addItem(itemData) {
  const docRef = await addDoc(itemsCollection, {
    ...itemData,
    created_at: serverTimestamp()
  });
  return docRef.id;
}

export async function getAllItems() {
  const q = query(itemsCollection, orderBy('name'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getItemById(id) {
  const docRef = doc(db, 'items', id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

// --- Inventory Logs Functions ---
export async function addInventoryLog(logData) {
  const docRef = await addDoc(inventoryLogsCollection, {
    ...logData,
    date: new Date().toISOString().split('T')[0],
    created_at: serverTimestamp()
  });
  return docRef.id;
}

export async function getInventoryLogs(userId = null, date = null) {
  let q = inventoryLogsCollection;
  
  if (userId) {
    q = query(q, where('user_id', '==', userId));
  }
  if (date) {
    q = query(q, where('date', '==', date));
  }
  
  q = query(q, orderBy('date', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- Attendance Logs Functions ---
export async function addAttendanceLog(logData) {
  const docRef = await addDoc(attendanceLogsCollection, {
    ...logData,
    date: new Date().toISOString().split('T')[0],
    created_at: serverTimestamp()
  });
  return docRef.id;
}

export async function getAttendanceLogs(userId, date) {
  const q = query(
    attendanceLogsCollection, 
    where('user_id', '==', userId),
    where('date', '==', date)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- Payroll Logs Functions ---
export async function addPayrollLog(logData) {
  const docRef = await addDoc(payrollLogsCollection, {
    ...logData,
    created_at: serverTimestamp()
  });
  return docRef.id;
}

export async function getPayrollLogs(userId) {
  const q = query(payrollLogsCollection, where('user_id', '==', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- Daily Reports Functions ---
export async function addDailyReport(reportData) {
  const docRef = await addDoc(dailyReportsCollection, {
    ...reportData,
    generated_at: serverTimestamp()
  });
  return docRef.id;
}

export async function getDailyReport(date) {
  const q = query(dailyReportsCollection, where('report_date', '==', date));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- Real-time Listeners ---
export function listenToInventoryLogs(userId, callback) {
  const q = query(
    inventoryLogsCollection, 
    where('user_id', '==', userId),
    orderBy('date', 'desc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(logs);
  });
}

// --- Admin PIN Setup ---
export async function setupAdminPin() {
  const adminPin = bcrypt.hashSync('4545', 10);
  
  // Check if admin exists
  const q = query(usersCollection, where('role', '==', 'admin'));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.docs.length > 0) {
    // Update existing admin
    const adminDoc = querySnapshot.docs[0];
    await updateDoc(doc(db, 'users', adminDoc.id), { pin_hash: adminPin });
    console.log('Admin PIN updated to 4545');
  } else {
    // Create new admin
    await addDoc(usersCollection, {
      name: 'VesPoint Admin',
      role: 'admin',
      pin_hash: adminPin,
      created_at: serverTimestamp()
    });
    console.log('Admin created with PIN 4545');
  }
}

// Call admin setup on module load
setupAdminPin();
