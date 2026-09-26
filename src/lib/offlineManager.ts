import { Sale, Product, BusinessConfig, DailyOpening, DailyClosing, RestaurantOrder, ExpenseRecord } from '../types';
import { db, DEFAULT_BUSINESS_ID } from './firebase';
import { doc, setDoc, updateDoc, increment, getDoc, collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { logAuditAction, cleanForFirestore } from './utils';

export interface OfflineStatus {
  isOnline: boolean;
  pendingSalesCount: number;
  pendingOpeningsCount: number;
  pendingClosingsCount: number;
  pendingOrdersCount: number;
  pendingExpensesCount: number;
  pendingTotalCount: number;
  isSyncing: boolean;
  lastSyncTime: string | null;
  lastSyncResult?: {
    success: boolean;
    syncedCount: number;
    message: string;
    timestamp: number;
  } | null;
}

type StatusListener = (status: OfflineStatus) => void;
const listeners: Set<StatusListener> = new Set();

let isSyncing = false;
let autoSyncDebounceTimer: any = null;

// LocalStorage Keys
const OFFLINE_SALES_KEY = 'bar_pos_offline_sales_queue';
const OFFLINE_OPENINGS_KEY = 'bar_pos_offline_openings_queue';
const OFFLINE_CLOSINGS_KEY = 'bar_pos_offline_closings_queue';
const OFFLINE_ORDERS_KEY = 'bar_pos_offline_orders_queue';
const OFFLINE_EXPENSES_KEY = 'bar_pos_offline_expenses_queue';
const OFFLINE_AUDIT_KEY = 'bar_pos_offline_audit_queue';
const LAST_SYNC_TIME_KEY = 'bar_pos_last_sync_time';
const LAST_SYNC_RESULT_KEY = 'bar_pos_last_sync_result';

// Queue Interfaces
export interface PendingOpeningSync {
  opening: DailyOpening;
  tenantId: string;
  productUpdates?: { id: string; openingStock: number; currentStock: number }[];
  queuedAt: number;
}

export interface PendingClosingSync {
  closing: DailyClosing;
  tenantId: string;
  queuedAt: number;
}

export interface PendingOrderSync {
  order: RestaurantOrder;
  tenantId: string;
  queuedAt: number;
}

export interface PendingExpenseSync {
  expense: ExpenseRecord;
  tenantId: string;
  queuedAt: number;
}

export interface PendingAuditSync {
  id: string;
  logEntry: any;
  queuedAt: number;
}

// 1. Sales Queue
function getStoredPendingSales(): Sale[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_SALES_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function savePendingSales(queue: Sale[]) {
  try {
    localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('Failed to write offline sales queue to localStorage:', e);
  }
  notifyListeners();
}

// 2. Openings Queue
export function getStoredPendingOpenings(): PendingOpeningSync[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_OPENINGS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

export function savePendingOpenings(queue: PendingOpeningSync[]) {
  try {
    localStorage.setItem(OFFLINE_OPENINGS_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('Failed to write offline openings queue:', e);
  }
  notifyListeners();
}

export function queueOpeningForSync(opening: DailyOpening, updatedProducts?: Product[], tenantId?: string) {
  const activeTenantId = tenantId || DEFAULT_BUSINESS_ID;
  const queue = getStoredPendingOpenings();
  const productUpdates = updatedProducts?.map(p => ({
    id: p.id,
    openingStock: p.openingStock,
    currentStock: p.currentStock
  }));

  const existingIdx = queue.findIndex(o => o.opening.id === opening.id);
  const entry: PendingOpeningSync = {
    opening,
    tenantId: activeTenantId,
    productUpdates,
    queuedAt: Date.now()
  };

  if (existingIdx >= 0) {
    queue[existingIdx] = entry;
  } else {
    queue.push(entry);
  }
  savePendingOpenings(queue);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    scheduleAutoSync(500);
  }
}

// 3. Closings Queue
export function getStoredPendingClosings(): PendingClosingSync[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_CLOSINGS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

export function savePendingClosings(queue: PendingClosingSync[]) {
  try {
    localStorage.setItem(OFFLINE_CLOSINGS_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('Failed to write offline closings queue:', e);
  }
  notifyListeners();
}

export function queueClosingForSync(closing: DailyClosing, tenantId?: string) {
  const activeTenantId = tenantId || DEFAULT_BUSINESS_ID;
  const queue = getStoredPendingClosings();
  const existingIdx = queue.findIndex(c => c.closing.id === closing.id);
  const entry: PendingClosingSync = {
    closing,
    tenantId: activeTenantId,
    queuedAt: Date.now()
  };

  if (existingIdx >= 0) {
    queue[existingIdx] = entry;
  } else {
    queue.push(entry);
  }
  savePendingClosings(queue);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    scheduleAutoSync(500);
  }
}

// 4. Orders Queue
export function getStoredPendingOrders(): PendingOrderSync[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_ORDERS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

export function savePendingOrders(queue: PendingOrderSync[]) {
  try {
    localStorage.setItem(OFFLINE_ORDERS_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('Failed to write offline orders queue:', e);
  }
  notifyListeners();
}

export function queueOrderForSync(order: RestaurantOrder, tenantId?: string) {
  const activeTenantId = tenantId || order.businessId || DEFAULT_BUSINESS_ID;
  const queue = getStoredPendingOrders();
  const existingIdx = queue.findIndex(o => o.order.id === order.id);
  const entry: PendingOrderSync = {
    order,
    tenantId: activeTenantId,
    queuedAt: Date.now()
  };

  if (existingIdx >= 0) {
    queue[existingIdx] = entry;
  } else {
    queue.push(entry);
  }
  savePendingOrders(queue);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    scheduleAutoSync(500);
  }
}

// 5. Expenses Queue
export function getStoredPendingExpenses(): PendingExpenseSync[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_EXPENSES_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

export function savePendingExpenses(queue: PendingExpenseSync[]) {
  try {
    localStorage.setItem(OFFLINE_EXPENSES_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('Failed to write offline expenses queue:', e);
  }
  notifyListeners();
}

export function queueExpenseForSync(expense: ExpenseRecord, tenantId?: string) {
  const activeTenantId = tenantId || expense.businessId || DEFAULT_BUSINESS_ID;
  const queue = getStoredPendingExpenses();
  const existingIdx = queue.findIndex(x => x.expense.id === expense.id);
  const entry: PendingExpenseSync = {
    expense,
    tenantId: activeTenantId,
    queuedAt: Date.now()
  };

  if (existingIdx >= 0) {
    queue[existingIdx] = entry;
  } else {
    queue.push(entry);
  }
  savePendingExpenses(queue);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    scheduleAutoSync(500);
  }
}

// 6. Audit Queue
export function getStoredPendingAudits(): PendingAuditSync[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_AUDIT_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

export function savePendingAudits(queue: PendingAuditSync[]) {
  try {
    localStorage.setItem(OFFLINE_AUDIT_KEY, JSON.stringify(queue));
  } catch (e) {}
}

export function queueAuditForSync(logEntry: any) {
  const queue = getStoredPendingAudits();
  queue.push({
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    logEntry,
    queuedAt: Date.now()
  });
  savePendingAudits(queue.slice(-50));

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    scheduleAutoSync(1000);
  }
}

export function getOfflineStatus(): OfflineStatus {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const pendingSales = getStoredPendingSales();
  const pendingOpenings = getStoredPendingOpenings();
  const pendingClosings = getStoredPendingClosings();
  const pendingOrders = getStoredPendingOrders();
  const pendingExpenses = getStoredPendingExpenses();
  const lastSyncTime = localStorage.getItem(LAST_SYNC_TIME_KEY);

  let lastSyncResult = null;
  try {
    const storedRes = localStorage.getItem(LAST_SYNC_RESULT_KEY);
    if (storedRes) {
      lastSyncResult = JSON.parse(storedRes);
    }
  } catch (e) {}

  const pendingTotalCount =
    pendingSales.length +
    pendingOpenings.length +
    pendingClosings.length +
    pendingOrders.length +
    pendingExpenses.length;

  return {
    isOnline,
    pendingSalesCount: pendingSales.length,
    pendingOpeningsCount: pendingOpenings.length,
    pendingClosingsCount: pendingClosings.length,
    pendingOrdersCount: pendingOrders.length,
    pendingExpensesCount: pendingExpenses.length,
    pendingTotalCount,
    isSyncing,
    lastSyncTime,
    lastSyncResult
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

/**
 * Debounced automatic sync scheduler
 */
export function scheduleAutoSync(delayMs = 600) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (autoSyncDebounceTimer) {
    clearTimeout(autoSyncDebounceTimer);
  }
  autoSyncDebounceTimer = setTimeout(() => {
    syncAllOfflineData().catch(err => {
      console.warn('[OfflineManager] Background auto-sync attempt deferred:', err);
    });
  }, delayMs);
}

/**
 * Initialize automatic sync listeners and background healthcheck
 */
export function initAutoSync() {
  if (typeof window === 'undefined') return;

  // 1. Browser online event
  window.addEventListener('online', () => {
    console.log('[OfflineManager] 🌐 Internet connection restored! Automatically syncing offline queue...');
    notifyListeners();
    scheduleAutoSync(600);
  });

  // 2. Browser offline event
  window.addEventListener('offline', () => {
    console.log('[OfflineManager] ⚠️ Network disconnected. Entering offline mode; new records will queue.');
    notifyListeners();
  });

  // 3. Tab Visibility change (e.g. user unlocks phone or switches back to POS tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      const status = getOfflineStatus();
      if (status.pendingTotalCount > 0 && !isSyncing) {
        console.log('[OfflineManager] Tab focused with pending offline records. Triggering automatic sync...');
        scheduleAutoSync(300);
      }
    }
  });

  // 4. Periodic background sync check every 15 seconds
  setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine && !isSyncing) {
      const status = getOfflineStatus();
      if (status.pendingTotalCount > 0) {
        console.log(`[OfflineManager] Heartbeat detected ${status.pendingTotalCount} pending record(s). Auto-syncing...`);
        syncAllOfflineData().catch(() => {});
      }
    }
  }, 15000);

  // 5. Initial startup check after UI has comfortably loaded
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    setTimeout(() => {
      const status = getOfflineStatus();
      if (status.pendingTotalCount > 0) {
        console.log('[OfflineManager] Startup sync check: pushing pending records...');
        syncAllOfflineData().catch(() => {});
      }
    }, 3500);
  }
}

// Auto-run initialization immediately in browser environment
if (typeof window !== 'undefined') {
  initAutoSync();
}

/**
 * Cache products and categories locally
 */
export function cacheLocalProducts(products: Product[], tenantId?: string) {
  try {
    const key = tenantId ? `bar_pos_local_products_${tenantId}` : 'bar_pos_local_products';
    localStorage.setItem(key, JSON.stringify(products));
    localStorage.setItem('bar_pos_local_products', JSON.stringify(products)); // backward compatibility
    localStorage.setItem('bar_pos_products_cache_date', new Date().toISOString());
  } catch (e) {
    console.warn('Failed to cache products locally:', e);
  }
}

const DEFAULT_FALLBACK_PRODUCTS: Product[] = [
  {
    id: 'prod-tusker',
    name: 'Tusker Lager (500ml)',
    barcode: '6161100010012',
    categoryId: 'cat-beer',
    categoryName: 'Beer',
    unitType: 'Bottle',
    buyingPrice: 180,
    sellingPrice: 250,
    openingStock: 120,
    currentStock: 120,
    stockAdded: 0,
    minStockLevel: 15,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-whitecap',
    name: 'White Cap Lager',
    barcode: '6161100010029',
    categoryId: 'cat-beer',
    categoryName: 'Beer',
    unitType: 'Bottle',
    buyingPrice: 180,
    sellingPrice: 250,
    openingStock: 80,
    currentStock: 80,
    stockAdded: 0,
    minStockLevel: 10,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-guinness',
    name: 'Guinness Stout',
    barcode: '6161100010036',
    categoryId: 'cat-beer',
    categoryName: 'Beer',
    unitType: 'Bottle',
    buyingPrice: 220,
    sellingPrice: 300,
    openingStock: 60,
    currentStock: 60,
    stockAdded: 0,
    minStockLevel: 10,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-heineken',
    name: 'Heineken',
    barcode: '8712000030018',
    categoryId: 'cat-beer',
    categoryName: 'Beer',
    unitType: 'Bottle',
    buyingPrice: 250,
    sellingPrice: 350,
    openingStock: 40,
    currentStock: 40,
    stockAdded: 0,
    minStockLevel: 8,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-smirnoff',
    name: 'Smirnoff Vodka (750ml)',
    barcode: '5000281010015',
    categoryId: 'cat-spirits',
    categoryName: 'Spirits',
    unitType: 'Bottle',
    buyingPrice: 1200,
    sellingPrice: 1800,
    openingStock: 25,
    currentStock: 25,
    stockAdded: 0,
    minStockLevel: 5,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-chrome',
    name: 'Chrome Vodka (250ml)',
    barcode: '6161100010067',
    categoryId: 'cat-spirits',
    categoryName: 'Spirits',
    unitType: 'Bottle',
    buyingPrice: 350,
    sellingPrice: 500,
    openingStock: 50,
    currentStock: 50,
    stockAdded: 0,
    minStockLevel: 10,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-jw-black',
    name: 'Johnnie Walker Black Label',
    barcode: '5000267014013',
    categoryId: 'cat-spirits',
    categoryName: 'Spirits',
    unitType: 'Bottle',
    buyingPrice: 2800,
    sellingPrice: 4000,
    openingStock: 15,
    currentStock: 15,
    stockAdded: 0,
    minStockLevel: 3,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-coke',
    name: 'Coca Cola (Soda 300ml)',
    barcode: '5449000000996',
    categoryId: 'cat-soft',
    categoryName: 'Soft Drinks',
    unitType: 'Bottle',
    buyingPrice: 60,
    sellingPrice: 100,
    openingStock: 100,
    currentStock: 100,
    stockAdded: 0,
    minStockLevel: 20,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const DEFAULT_FALLBACK_CATEGORIES = [
  { id: 'cat-beer', name: 'Beer' },
  { id: 'cat-spirits', name: 'Spirits' },
  { id: 'cat-soft', name: 'Soft Drinks' },
  { id: 'cat-cider', name: 'Ciders' }
];

export function getLocalCachedProducts(tenantId?: string): Product[] {
  try {
    const key = tenantId ? `bar_pos_local_products_${tenantId}` : 'bar_pos_local_products';
    const stored = JSON.parse(localStorage.getItem(key) || localStorage.getItem('bar_pos_local_products') || '[]');
    if (Array.isArray(stored) && stored.length > 0) {
      return stored.map((p: any) => ({
        ...p,
        barcode: p.barcode != null ? String(p.barcode).trim() : undefined
      }));
    }
  } catch (e) {
    // fallback
  }
  // Initialize with fallback products if cache is empty
  cacheLocalProducts(DEFAULT_FALLBACK_PRODUCTS, tenantId);
  return DEFAULT_FALLBACK_PRODUCTS;
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
    const stored = JSON.parse(localStorage.getItem('bar_pos_local_categories') || '[]');
    if (Array.isArray(stored) && stored.length > 0) {
      return stored;
    }
  } catch (e) {
    // fallback
  }
  cacheLocalCategories(DEFAULT_FALLBACK_CATEGORIES);
  return DEFAULT_FALLBACK_CATEGORIES;
}

/**
 * Deduct stock locally immediately
 */
export function deductLocalProductStock(items: { productId: string; quantity: number }[], tenantId?: string) {
  try {
    const products = getLocalCachedProducts(tenantId);
    for (const item of items) {
      if (item.productId.startsWith('custom-')) continue;
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        p.currentStock = (p.currentStock || 0) - item.quantity;
      }
    }
    cacheLocalProducts(products, tenantId);
  } catch (e) {
    console.error('Failed to deduct local product stock:', e);
  }
}

/**
 * Store sale locally and queue for sync
 */
export function saveSaleLocallyAndQueue(sale: Sale, tenantId?: string) {
  const activeTenantId = tenantId || sale.businessId || DEFAULT_BUSINESS_ID;
  const enrichedSale: Sale = {
    ...sale,
    businessId: activeTenantId
  };

  // 1. Save to local sales history
  try {
    const salesKey = tenantId ? `bar_pos_local_sales_${tenantId}` : 'bar_pos_local_sales';
    const localSales: Sale[] = JSON.parse(localStorage.getItem(salesKey) || localStorage.getItem('bar_pos_local_sales') || '[]');
    // Avoid duplicate
    const exists = localSales.some(s => s.id === enrichedSale.id);
    if (!exists) {
      localSales.unshift(enrichedSale);
      localStorage.setItem(salesKey, JSON.stringify(localSales));
      localStorage.setItem('bar_pos_local_sales', JSON.stringify(localSales));
    }
  } catch (e) {
    console.error('Failed to write to local sales cache:', e);
  }

  // 2. Queue for server sync
  const queue = getStoredPendingSales();
  if (!queue.some(s => s.id === enrichedSale.id)) {
    queue.push(enrichedSale);
    savePendingSales(queue);
  }

  // 3. Deduct local stock immediately for zero-lag POS experience
  deductLocalProductStock(enrichedSale.items, activeTenantId);

  // 4. If connected to internet, trigger automatic background sync immediately
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    scheduleAutoSync(400);
  }
}

/**
 * Synchronize all pending offline data (Sales, Openings, Closings, Orders, Audits) to Firestore
 */
export async function syncAllOfflineData(tenantId?: string): Promise<{
  syncedSales: number;
  syncedOpenings: number;
  syncedClosings: number;
  syncedOrders: number;
  syncedExpenses: number;
  syncedAudits: number;
  totalSynced: number;
  errors: number;
}> {
  if (isSyncing) {
    return {
      syncedSales: 0,
      syncedOpenings: 0,
      syncedClosings: 0,
      syncedOrders: 0,
      syncedExpenses: 0,
      syncedAudits: 0,
      totalSynced: 0,
      errors: 0
    };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      syncedSales: 0,
      syncedOpenings: 0,
      syncedClosings: 0,
      syncedOrders: 0,
      syncedExpenses: 0,
      syncedAudits: 0,
      totalSynced: 0,
      errors: 0
    };
  }

  const salesQueue = getStoredPendingSales();
  const openingsQueue = getStoredPendingOpenings();
  const closingsQueue = getStoredPendingClosings();
  const ordersQueue = getStoredPendingOrders();
  const expensesQueue = getStoredPendingExpenses();
  const auditsQueue = getStoredPendingAudits();

  const totalPending =
    salesQueue.length +
    openingsQueue.length +
    closingsQueue.length +
    ordersQueue.length +
    expensesQueue.length +
    auditsQueue.length;

  if (totalPending === 0) {
    return {
      syncedSales: 0,
      syncedOpenings: 0,
      syncedClosings: 0,
      syncedOrders: 0,
      syncedExpenses: 0,
      syncedAudits: 0,
      totalSynced: 0,
      errors: 0
    };
  }

  isSyncing = true;
  notifyListeners();

  let syncedSales = 0;
  let syncedOpenings = 0;
  let syncedClosings = 0;
  let syncedOrders = 0;
  let syncedExpenses = 0;
  let syncedAudits = 0;
  let errors = 0;

  // 1. Synchronize Pending Sales
  const remainingSales: Sale[] = [];
  for (const sale of salesQueue) {
    const activeTenantId = sale.businessId || tenantId || DEFAULT_BUSINESS_ID;
    try {
      // Upload sale document
      const saleRef = doc(db, 'businesses', activeTenantId, 'sales', sale.id);
      await setDoc(saleRef, cleanForFirestore(sale), { merge: true });

      // Decrement stock in Firestore and log stock movement
      for (const item of sale.items) {
        if (item.productId.startsWith('custom-')) continue;
        try {
          const prodRef = doc(db, 'businesses', activeTenantId, 'products', item.productId);
          await updateDoc(prodRef, {
            currentStock: increment(-item.quantity),
            updatedAt: new Date().toISOString()
          });

          const movementId = `mov-${sale.id}-${item.productId}`;
          const movementRef = doc(db, 'businesses', activeTenantId, 'stockMovements', movementId);
          await setDoc(
            movementRef,
            {
              id: movementId,
              productId: item.productId,
              productName: item.productName,
              barcode: item.barcode || '',
              previousStock: 0,
              addedQty: -item.quantity,
              newStock: 0,
              date: sale.date,
              time: sale.time,
              adminId: sale.cashierId,
              adminName: sale.cashierName,
              reason: `POS Checkout #${sale.id.slice(-6)}${item.barcode ? ` [Barcode: ${item.barcode}]` : ''}`,
              createdAt: sale.createdAt || Date.now()
            },
            { merge: true }
          );
        } catch (stockErr) {
          console.warn(`Could not decrement stock online for ${item.productId}:`, stockErr);
        }
      }

      syncedSales++;
    } catch (err) {
      console.error(`Failed to sync sale ${sale.id}:`, err);
      errors++;
      remainingSales.push(sale);
    }
  }
  savePendingSales(remainingSales);

  // 2. Synchronize Pending Shift Openings
  const remainingOpenings: PendingOpeningSync[] = [];
  for (const item of openingsQueue) {
    try {
      const openingRef = doc(db, 'businesses', item.tenantId, 'dailyOpenings', item.opening.id);
      await setDoc(openingRef, cleanForFirestore(item.opening), { merge: true });

      if (item.productUpdates && item.productUpdates.length > 0) {
        const batch = writeBatch(db);
        item.productUpdates.forEach(pu => {
          const pRef = doc(db, 'businesses', item.tenantId, 'products', pu.id);
          batch.update(pRef, {
            openingStock: pu.openingStock,
            currentStock: pu.currentStock,
            stockAdded: 0
          });
        });
        await batch.commit();
      }
      syncedOpenings++;
    } catch (err) {
      console.error(`Failed to sync opening ${item.opening.id}:`, err);
      errors++;
      remainingOpenings.push(item);
    }
  }
  savePendingOpenings(remainingOpenings);

  // 3. Synchronize Pending Shift Closings
  const remainingClosings: PendingClosingSync[] = [];
  for (const item of closingsQueue) {
    try {
      const closingRef = doc(db, 'businesses', item.tenantId, 'dailyClosings', item.closing.id);
      await setDoc(closingRef, cleanForFirestore(item.closing), { merge: true });
      syncedClosings++;
    } catch (err) {
      console.error(`Failed to sync closing ${item.closing.id}:`, err);
      errors++;
      remainingClosings.push(item);
    }
  }
  savePendingClosings(remainingClosings);

  // 4. Synchronize Pending Waiter Orders
  const remainingOrders: PendingOrderSync[] = [];
  for (const item of ordersQueue) {
    try {
      const orderRef = doc(db, 'businesses', item.tenantId, 'orders', item.order.id);
      await setDoc(orderRef, cleanForFirestore(item.order), { merge: true });
      syncedOrders++;
    } catch (err) {
      console.error(`Failed to sync order ${item.order.id}:`, err);
      errors++;
      remainingOrders.push(item);
    }
  }
  savePendingOrders(remainingOrders);

  // 5. Synchronize Pending Cashier Expenses
  const remainingExpenses: PendingExpenseSync[] = [];
  for (const item of expensesQueue) {
    try {
      const expenseRef = doc(db, 'businesses', item.tenantId, 'expenses', item.expense.id);
      await setDoc(expenseRef, cleanForFirestore(item.expense), { merge: true });
      syncedExpenses++;
    } catch (err) {
      console.error(`Failed to sync expense ${item.expense.id}:`, err);
      errors++;
      remainingExpenses.push(item);
    }
  }
  savePendingExpenses(remainingExpenses);

  // 6. Synchronize Pending Audit Logs
  const remainingAudits: PendingAuditSync[] = [];
  for (const item of auditsQueue) {
    try {
      const auditRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID, 'auditLogs', item.id);
      await setDoc(auditRef, cleanForFirestore(item.logEntry), { merge: true });
      syncedAudits++;
    } catch (err) {
      console.error('Failed to sync audit log:', err);
      remainingAudits.push(item);
    }
  }
  savePendingAudits(remainingAudits);

  const totalSynced = syncedSales + syncedOpenings + syncedClosings + syncedOrders + syncedExpenses + syncedAudits;

  if (totalSynced > 0) {
    const timeStr = new Date().toLocaleTimeString();
    localStorage.setItem(LAST_SYNC_TIME_KEY, timeStr);

    // Build friendly feedback message for toast
    const parts: string[] = [];
    if (syncedSales > 0) parts.push(`${syncedSales} sale${syncedSales > 1 ? 's' : ''}`);
    if (syncedOpenings > 0) parts.push(`${syncedOpenings} opening`);
    if (syncedClosings > 0) parts.push(`${syncedClosings} closing`);
    if (syncedOrders > 0) parts.push(`${syncedOrders} order${syncedOrders > 1 ? 's' : ''}`);
    if (syncedExpenses > 0) parts.push(`${syncedExpenses} expense${syncedExpenses > 1 ? 's' : ''}`);
    const summaryText = parts.join(', ');

    const result = {
      success: errors === 0,
      syncedCount: totalSynced,
      message: `Auto-synced ${summaryText} to cloud!`,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem(LAST_SYNC_RESULT_KEY, JSON.stringify(result));
    } catch (e) {}

    // Pull latest catalog from Firestore to maintain fresh client state
    try {
      const activeTenant = tenantId || DEFAULT_BUSINESS_ID;
      const prodSnap = await getDocs(collection(db, 'businesses', activeTenant, 'products'));
      const freshProds: Product[] = [];
      prodSnap.forEach(d => {
        freshProds.push({ id: d.id, ...d.data() } as Product);
      });
      if (freshProds.length > 0) {
        cacheLocalProducts(freshProds, activeTenant);
      }
    } catch (catErr) {
      console.warn('Could not refresh products after sync:', catErr);
    }
  }

  isSyncing = false;
  notifyListeners();

  return {
    syncedSales,
    syncedOpenings,
    syncedClosings,
    syncedOrders,
    syncedExpenses,
    syncedAudits,
    totalSynced,
    errors
  };
}

/**
 * Synchronize all pending sales to Firestore (kept for backward-compatibility)
 */
export async function syncOfflineQueue(tenantId?: string): Promise<{ syncedCount: number; errors: number }> {
  const res = await syncAllOfflineData(tenantId);
  return {
    syncedCount: res.totalSynced,
    errors: res.errors
  };
}

/**
 * Permanently delete all sales receipts, payment records, and daily shift closings
 * to start completely fresh with zero sales. Products, inventory, and users remain intact.
 */
export async function clearAllPaymentRecords(user?: { uid: string; name: string }): Promise<{ deletedSales: number; deletedClosings: number }> {
  // 1. Clear local caches immediately
  localStorage.removeItem('bar_pos_local_sales');
  localStorage.removeItem(OFFLINE_SALES_KEY);
  localStorage.removeItem(OFFLINE_OPENINGS_KEY);
  localStorage.removeItem(OFFLINE_CLOSINGS_KEY);
  localStorage.removeItem(OFFLINE_ORDERS_KEY);
  localStorage.removeItem(LAST_SYNC_TIME_KEY);
  localStorage.removeItem(LAST_SYNC_RESULT_KEY);
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
