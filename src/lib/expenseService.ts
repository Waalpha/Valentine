import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db, DEFAULT_BUSINESS_ID } from './firebase';
import { ExpenseRecord, ExpenseCategory, ExpensePaymentSource, UserProfile } from '../types';
import { queueExpenseForSync } from './offlineManager';
import { logAuditAction, cleanForFirestore } from './utils';

const LOCAL_EXPENSES_KEY = 'bar_pos_local_expenses';

export function getLocalExpenses(tenantId: string): ExpenseRecord[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_EXPENSES_KEY}_${tenantId}`) || localStorage.getItem(LOCAL_EXPENSES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
    }
  } catch (e) {
    console.warn('Error reading local expenses:', e);
  }
  return [];
}

export function saveLocalExpenses(expenses: ExpenseRecord[], tenantId: string) {
  try {
    const sorted = [...expenses].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    localStorage.setItem(`${LOCAL_EXPENSES_KEY}_${tenantId}`, JSON.stringify(sorted));
    localStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(sorted));
  } catch (e) {
    console.warn('Error saving local expenses:', e);
  }
}

/**
 * Record a new expense by a cashier or manager
 */
export async function recordExpense(params: {
  amount: number;
  category: ExpenseCategory;
  reason: string;
  paymentSource: ExpensePaymentSource;
  receiptNumber?: string;
  voucherNumber?: string;
  notes?: string;
  user: UserProfile;
  tenantId?: string;
}): Promise<ExpenseRecord> {
  const {
    amount,
    category,
    reason,
    paymentSource,
    receiptNumber,
    voucherNumber,
    notes,
    user,
    tenantId = user.businessId || DEFAULT_BUSINESS_ID
  } = params;

  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('Please enter a valid expense amount greater than 0.');
  }

  if (!reason || !reason.trim()) {
    throw new Error('Please explain what this expense is for. A reason is required.');
  }

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);
  const expenseId = `exp_${dateStr}_${timestamp}_${rand}`;
  const generatedVoucher = voucherNumber?.trim() || `EXP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(1000 + Math.random() * 9000))}`;

  const expense: ExpenseRecord = {
    id: expenseId,
    amount: Number(amount),
    category,
    reason: reason.trim(),
    paymentSource,
    receiptNumber: receiptNumber?.trim() || undefined,
    voucherNumber: generatedVoucher,
    cashierId: user.uid,
    cashierName: user.name,
    businessDayId: dateStr,
    businessId: tenantId,
    date: dateStr,
    time: timeStr,
    createdAt: timestamp,
    notes: notes?.trim() || undefined,
    status: 'recorded'
  };

  // 1. Immediately store in local cache (0ms latency)
  const existingLocal = getLocalExpenses(tenantId);
  const updatedLocal = [expense, ...existingLocal.filter(e => e.id !== expense.id)];
  saveLocalExpenses(updatedLocal, tenantId);

  // 2. Queue for offline sync or write directly if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const expenseRef = doc(db, 'businesses', tenantId, 'expenses', expense.id);
      await setDoc(expenseRef, cleanForFirestore(expense));
    } catch (dbErr) {
      console.warn('Online expense write failed, queued for auto-sync:', dbErr);
      queueExpenseForSync(expense, tenantId);
    }
  } else {
    queueExpenseForSync(expense, tenantId);
  }

  // 3. Audit trail
  logAuditAction(
    user.uid,
    user.name,
    'EXPENSE_RECORDED',
    `Cashier ${user.name} recorded ${paymentSource} expense of KSh ${amount.toLocaleString()} for "${reason.trim()}" [Category: ${category}]`,
    expense.id
  ).catch(() => {});

  return expense;
}

/**
 * Delete / void an expense (audited)
 */
export async function deleteExpense(
  expenseId: string,
  tenantId: string,
  user: UserProfile,
  reason: string = 'Voided by authorized staff'
): Promise<void> {
  // Update local
  const current = getLocalExpenses(tenantId);
  const filtered = current.filter(e => e.id !== expenseId);
  saveLocalExpenses(filtered, tenantId);

  // Delete remote if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const ref = doc(db, 'businesses', tenantId, 'expenses', expenseId);
      await deleteDoc(ref);
    } catch (e) {
      console.warn('Failed to delete expense from remote:', e);
    }
  }

  // Audit log
  logAuditAction(
    user.uid,
    user.name,
    'EXPENSE_VOIDED',
    `User ${user.name} voided expense #${expenseId}: ${reason}`,
    expenseId
  ).catch(() => {});
}

/**
 * Real-time subscription to expenses
 */
export function subscribeExpenses(
  tenantId: string,
  callback: (expenses: ExpenseRecord[]) => void
): () => void {
  // Immediately dispatch current local cache
  const local = getLocalExpenses(tenantId);
  callback(local);

  try {
    const q = query(
      collection(db, 'businesses', tenantId, 'expenses'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const remoteExpenses: ExpenseRecord[] = [];
        snapshot.forEach(docSnap => {
          remoteExpenses.push({ id: docSnap.id, ...docSnap.data() } as ExpenseRecord);
        });

        // Merge remote with any un-synced local records
        const localCurrent = getLocalExpenses(tenantId);
        const map = new Map<string, ExpenseRecord>();
        
        // Remote wins
        remoteExpenses.forEach(e => map.set(e.id, e));
        // Fill in local un-synced
        localCurrent.forEach(e => {
          if (!map.has(e.id)) map.set(e.id, e);
        });

        const merged = Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        saveLocalExpenses(merged, tenantId);
        callback(merged);
      },
      (err) => {
        console.warn('Expenses onSnapshot error, using local fallback:', err);
        callback(getLocalExpenses(tenantId));
      }
    );

    return unsub;
  } catch (err) {
    console.warn('Could not setup expenses subscription:', err);
    return () => {};
  }
}

/**
 * Get all expenses for today
 */
export async function getTodayExpenses(tenantId: string): Promise<ExpenseRecord[]> {
  const todayStr = new Date().toISOString().split('T')[0];
  const local = getLocalExpenses(tenantId).filter(e => e.date === todayStr);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return local;
  }

  try {
    const q = query(
      collection(db, 'businesses', tenantId, 'expenses'),
      where('date', '==', todayStr)
    );
    const snap = await getDocs(q);
    const remote: ExpenseRecord[] = [];
    snap.forEach(d => remote.push({ id: d.id, ...d.data() } as ExpenseRecord));

    if (remote.length > 0) {
      // Merge
      const map = new Map<string, ExpenseRecord>();
      remote.forEach(e => map.set(e.id, e));
      local.forEach(e => {
        if (!map.has(e.id)) map.set(e.id, e);
      });
      return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
  } catch (e) {
    console.warn('Failed to fetch today remote expenses:', e);
  }

  return local;
}

/**
 * Common quick reasons / templates to speed up cashier duty
 */
export const QUICK_EXPENSE_TEMPLATES: { category: ExpenseCategory; reason: string; paymentSource: ExpensePaymentSource }[] = [
  { category: 'Ice & Garnishes', reason: 'Crystal ice blocks & crushed ice for cocktail station', paymentSource: 'Cash Drawer' },
  { category: 'Ice & Garnishes', reason: 'Fresh lemons, limes, and mint leaves for the bar', paymentSource: 'Cash Drawer' },
  { category: 'Bar Supplies', reason: 'Cocktail napkins, paper towels, and drinking straws', paymentSource: 'Cash Drawer' },
  { category: 'Cleaning & Sanitation', reason: 'Bar washing detergent, bar cloths, and disinfectant spray', paymentSource: 'Cash Drawer' },
  { category: 'Transport & Errands', reason: 'Boda-boda courier fare to bank for cashier change float', paymentSource: 'Cash Drawer' },
  { category: 'Kitchen Ingredients', reason: 'Urgent cooking gas refill cylinder for kitchen', paymentSource: 'Cash Drawer' },
  { category: 'Casual Labor & Tips', reason: 'Extra casual barback / glass collector shift allowance', paymentSource: 'Cash Drawer' },
  { category: 'Repairs & Maintenance', reason: 'Emergency plumbing washer replacement for beer tap sink', paymentSource: 'Cash Drawer' },
  { category: 'Utilities & Emergency', reason: 'Generator fuel purchase during power surge', paymentSource: 'Cash Drawer' },
  { category: 'Other', reason: 'Replacement beer glasses broken during evening rush', paymentSource: 'Cash Drawer' }
];
