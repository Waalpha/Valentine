import { Sale, Product, BusinessConfig } from '../types';
import { db, DEFAULT_BUSINESS_ID } from './firebase';
import { doc, setDoc, updateDoc, increment, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { logAuditAction } from './utils';

export interface OfflineStatus {
  isOnline: boolean;
  pendingSalesCount: number;
  isSyncing: boolean;
  lastSyncTime: string | null;
}

type StatusListener = (status: OfflineStatus) => void;
const listeners: Set<StatusListener> = new Set();

let isSyncing = false;

// Initial state
function getStoredPendingSales(): Sale[] {
  try {
    return JSON.parse(localStorage.getItem('bar_pos_offline_sales_queue') || '[]');
  } catch (e) {
    return [];
  }
}

function savePendingSales(queue: Sale[]) {
  localStorage.setItem('bar_pos_offline_sales_queue', JSON.stringify(queue));
  notifyListeners();
}

export function getOfflineStatus(): OfflineStatus {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const pendingSales = getStoredPendingSales();
  const lastSyncTime = localStorage.getItem('bar_pos_last_sync_time');

  return {
    isOnline,
    pendingSalesCount: pendingSales.length,
    isSyncing,
    lastSyncTime
  };
}

export function subscribeOfflineStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener(getOfflineStatus());
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  const current = getOfflineStatus();
  listeners.forEach(fn => {
    try {
      fn(current);
    } catch (e) {
      console.error('Error in offline listener:', e);
    }
  });
}

// Global online/offline event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineManager] Connection restored! Triggering sync...');
    notifyListeners();
    // Auto sync when reconnecting
    setTimeout(() => {
      syncOfflineQueue();
    }, 1500);
  });

  window.addEventListener('offline', () => {
    console.log('[OfflineManager] System is now operating OFFLINE.');
    notifyListeners();
  });
}

/**
 * Cache products and categories locally
 */
export function cacheLocalProducts(products: Product[]) {
  try {
    localStorage.setItem('bar_pos_local_products', JSON.stringify(products));
    localStorage.setItem('bar_pos_products_cache_date', new Date().toISOString());
  } catch (e) {
    console.warn('Failed to cache products locally:', e);
  }
}

export function getLocalCachedProducts(): Product[] {
  try {
    return JSON.parse(localStorage.getItem('bar_pos_local_products') || '[]');
  } catch (e) {
    return [];
  }
}

export function cacheLocalCategories(categories: { id: string; name: string }[]) {
  try {
    localStorage.setItem('bar_pos_local_categories', JSON.stringify(categories));
  } catch (e) {
    console.warn('Failed to cache categories locally:', e);
  }
}

export function getLocalCachedCategories(): { id: string; name: string }[] {
  try {
    return JSON.parse(localStorage.getItem('bar_pos_local_categories') || '[]');
  } catch (e) {
    return [];
  }
}

/**
 * Deduct stock locally immediately
 */
export function deductLocalProductStock(items: { productId: string; quantity: number }[]) {
  try {
    const products = getLocalCachedProducts();
    for (const item of items) {
      if (item.productId.startsWith('custom-')) continue;
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        p.currentStock = Math.max(0, (p.currentStock || 0) - item.quantity);
      }
    }
    localStorage.setItem('bar_pos_local_products', JSON.stringify(products));
  } catch (e) {
    console.error('Failed to deduct local product stock:', e);
  }
}

/**
 * Store sale locally and queue for sync
 */
export function saveSaleLocallyAndQueue(sale: Sale) {
  // 1. Save to local sales history
  try {
    const localSales: Sale[] = JSON.parse(localStorage.getItem('bar_pos_local_sales') || '[]');
    // Avoid duplicate
    const exists = localSales.some(s => s.id === sale.id);
    if (!exists) {
      localSales.unshift(sale);
      localStorage.setItem('bar_pos_local_sales', JSON.stringify(localSales));
    }
  } catch (e) {
    console.error('Failed to write to bar_pos_local_sales:', e);
  }

  // 2. Queue for server sync
  const queue = getStoredPendingSales();
  if (!queue.some(s => s.id === sale.id)) {
    queue.push(sale);
    savePendingSales(queue);
  }

  // 3. Deduct local stock
  deductLocalProductStock(sale.items);
}

/**
 * Synchronize all pending sales to Firestore
 */
export async function syncOfflineQueue(): Promise<{ syncedCount: number; errors: number }> {
  if (isSyncing) {
    return { syncedCount: 0, errors: 0 };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0, errors: 0 };
  }

  const queue = getStoredPendingSales();
  if (queue.length === 0) {
    return { syncedCount: 0, errors: 0 };
  }

  isSyncing = true;
  notifyListeners();

  let syncedCount = 0;
  let errors = 0;
  const remainingQueue: Sale[] = [];

  for (const sale of queue) {
    try {
      // 1. Upload sale document
      const saleRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'sales', sale.id);
      await setDoc(saleRef, sale, { merge: true });

      // 2. Update stock in Firestore for inventory items
      for (const item of sale.items) {
        if (item.productId.startsWith('custom-')) continue;
        try {
          const prodRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'products', item.productId);
          await updateDoc(prodRef, {
            currentStock: increment(-item.quantity),
            updatedAt: new Date().toISOString()
          });
        } catch (stockErr) {
          console.warn(`Could not decrement stock online for ${item.productId}:`, stockErr);
        }
      }

      syncedCount++;
    } catch (err) {
      console.error(`Failed to sync sale ${sale.id}:`, err);
      errors++;
      remainingQueue.push(sale);
    }
  }

  // Update stored queue with any failed items
  savePendingSales(remainingQueue);
  localStorage.setItem('bar_pos_last_sync_time', new Date().toLocaleTimeString());

  isSyncing = false;
  notifyListeners();

  return { syncedCount, errors };
}

/**
 * Permanently delete all sales receipts, payment records, and daily shift closings
 * to start completely fresh with zero sales. Products, inventory, and users remain intact.
 */
export async function clearAllPaymentRecords(user?: { uid: string; name: string }): Promise<{ deletedSales: number; deletedClosings: number }> {
  // 1. Clear local caches immediately
  localStorage.removeItem('bar_pos_local_sales');
  localStorage.removeItem('bar_pos_offline_sales_queue');
  localStorage.removeItem('bar_pos_last_sync_time');
  notifyListeners();

  let deletedSales = 0;
  let deletedClosings = 0;

  // 2. Clear remote Firestore sales
  try {
    const salesSnap = await getDocs(collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'sales'));
    for (const d of salesSnap.docs) {
      await deleteDoc(doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'sales', d.id));
      deletedSales++;
    }
  } catch (e) {
    console.warn('Error clearing remote sales:', e);
  }

  // 3. Clear remote daily shift closings
  try {
    const closingsSnap = await getDocs(collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'dailyClosings'));
    for (const d of closingsSnap.docs) {
      await deleteDoc(doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'dailyClosings', d.id));
      deletedClosings++;
    }
  } catch (e) {
    console.warn('Error clearing remote dailyClosings:', e);
  }

  // 4. Clear remote cash reconciliations
  try {
    const reconciliationsSnap = await getDocs(collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'cashReconciliations'));
    for (const d of reconciliationsSnap.docs) {
      await deleteDoc(doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'cashReconciliations', d.id));
    }
  } catch (e) {
    console.warn('Error clearing remote cashReconciliations:', e);
  }

  if (user) {
    logAuditAction(user.uid, user.name, 'PAYMENTS_CLEARED', 'Cleared all payment records and sales receipts to start fresh').catch(() => {});
  }

  return { deletedSales, deletedClosings };
}
