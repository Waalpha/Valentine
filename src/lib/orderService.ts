import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db, DEFAULT_BUSINESS_ID } from './firebase';
import {
  RestaurantTable,
  RestaurantOrder,
  OrderItem,
  TableStatus,
  OrderStatus,
  KitchenStatus,
  Sale,
  UserProfile,
  BusinessConfig,
  PaymentMethod
} from '../types';
import { saveSaleLocallyAndQueue } from './offlineManager';
import { logAuditAction, cleanForFirestore } from './utils';

const DEFAULT_TABLES: Omit<RestaurantTable, 'businessId'>[] = [
  { id: 'tbl-1', name: 'Table 1', status: 'available', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'tbl-2', name: 'Table 2', status: 'available', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'tbl-3', name: 'Table 3', status: 'available', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'tbl-4', name: 'Table 4', status: 'available', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'tbl-5', name: 'Table 5', status: 'available', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'tbl-6', name: 'Table 6', status: 'available', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'tbl-7', name: 'Table 7', status: 'available', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'tbl-8', name: 'Table 8', status: 'available', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'tbl-bar-1', name: 'Bar Counter 1', status: 'available', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'tbl-bar-2', name: 'Bar Counter 2', status: 'available', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'tbl-vip-1', name: 'VIP Lounge 1', status: 'available', createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'tbl-vip-2', name: 'VIP Lounge 2', status: 'available', createdAt: Date.now(), updatedAt: Date.now() }
];

const LOCAL_TABLES_KEY = 'restaurant_pos_tables_cache';
const LOCAL_ORDERS_KEY = 'restaurant_pos_orders_cache';

function getLocalTables(tenantId: string): RestaurantTable[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_TABLES_KEY}_${tenantId}`) || localStorage.getItem(LOCAL_TABLES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_TABLES.map(t => ({ ...t, businessId: tenantId }));
}

function setLocalTables(tables: RestaurantTable[], tenantId: string) {
  try {
    localStorage.setItem(`${LOCAL_TABLES_KEY}_${tenantId}`, JSON.stringify(tables));
    localStorage.setItem(LOCAL_TABLES_KEY, JSON.stringify(tables));
  } catch {}
}

function getLocalOrders(tenantId: string): RestaurantOrder[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_ORDERS_KEY}_${tenantId}`) || localStorage.getItem(LOCAL_ORDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function setLocalOrders(orders: RestaurantOrder[], tenantId: string) {
  try {
    localStorage.setItem(`${LOCAL_ORDERS_KEY}_${tenantId}`, JSON.stringify(orders));
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
  } catch {}
}

/**
 * Initialize default tables if not already existing in Firestore
 */
export async function initializeTablesIfEmpty(tenantId: string = DEFAULT_BUSINESS_ID): Promise<RestaurantTable[]> {
  try {
    const tablesCol = collection(db, 'businesses', tenantId, 'tables');
    const snap = await getDocs(tablesCol);
    if (!snap.empty) {
      const tables: RestaurantTable[] = [];
      snap.forEach(d => tables.push({ id: d.id, ...d.data() } as RestaurantTable));
      tables.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      setLocalTables(tables, tenantId);
      return tables;
    }

    // Seed default tables
    const created: RestaurantTable[] = [];
    for (const t of DEFAULT_TABLES) {
      const tableWithTenant: RestaurantTable = { ...t, businessId: tenantId };
      await setDoc(doc(tablesCol, t.id), tableWithTenant);
      created.push(tableWithTenant);
    }
    setLocalTables(created, tenantId);
    return created;
  } catch (err) {
    console.warn('Using local fallback tables:', err);
    return getLocalTables(tenantId);
  }
}

/**
 * Subscribe to live table updates
 */
export function subscribeTables(
  tenantId: string = DEFAULT_BUSINESS_ID,
  callback: (tables: RestaurantTable[]) => void
): () => void {
  // Call immediately with local cache
  callback(getLocalTables(tenantId));

  try {
    const tablesCol = collection(db, 'businesses', tenantId, 'tables');
    return onSnapshot(
      tablesCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: RestaurantTable[] = [];
          snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as RestaurantTable));
          list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
          setLocalTables(list, tenantId);
          callback(list);
        } else {
          initializeTablesIfEmpty(tenantId).then(callback);
        }
      },
      (error) => {
        console.warn('Realtime tables error, falling back to local:', error);
        callback(getLocalTables(tenantId));
      }
    );
  } catch (err) {
    console.warn('Snapshot setup error for tables:', err);
    callback(getLocalTables(tenantId));
    return () => {};
  }
}

/**
 * Add or update table
 */
export async function saveRestaurantTable(
  table: Partial<RestaurantTable> & { name: string },
  tenantId: string = DEFAULT_BUSINESS_ID
): Promise<RestaurantTable> {
  const tableId = table.id || `tbl-${Date.now()}`;
  const tableData: RestaurantTable = {
    id: tableId,
    name: table.name.trim(),
    status: table.status || 'available',
    guestCount: table.guestCount || 4,
    businessId: tenantId,
    currentOrderId: table.currentOrderId || undefined,
    currentWaiterId: table.currentWaiterId || undefined,
    currentWaiterName: table.currentWaiterName || undefined,
    createdAt: table.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  const local = getLocalTables(tenantId);
  const existingIdx = local.findIndex(t => t.id === tableId);
  if (existingIdx >= 0) {
    local[existingIdx] = tableData;
  } else {
    local.push(tableData);
  }
  setLocalTables(local, tenantId);

  try {
    const tableRef = doc(db, 'businesses', tenantId, 'tables', tableId);
    await setDoc(tableRef, tableData, { merge: true });
  } catch (err) {
    console.warn('Failed to sync table to Firestore:', err);
  }

  return tableData;
}

/**
 * Delete a table
 */
export async function deleteRestaurantTable(tableId: string, tenantId: string = DEFAULT_BUSINESS_ID): Promise<void> {
  const local = getLocalTables(tenantId).filter(t => t.id !== tableId);
  setLocalTables(local, tenantId);

  try {
    const tableRef = doc(db, 'businesses', tenantId, 'tables', tableId);
    await deleteDoc(tableRef);
  } catch (err) {
    console.warn('Failed to delete table in Firestore:', err);
  }
}

/**
 * Update table status
 */
export async function updateTableStatus(
  tableId: string | undefined,
  status: TableStatus,
  orderId?: string,
  waiterId?: string,
  waiterName?: string,
  tenantId: string = DEFAULT_BUSINESS_ID
): Promise<void> {
  if (!tableId || !tableId.trim()) return;

  const local = getLocalTables(tenantId);
  const t = local.find(x => x.id === tableId);
  if (t) {
    t.status = status;
    t.currentOrderId = orderId;
    t.currentWaiterId = waiterId;
    t.currentWaiterName = waiterName;
    t.updatedAt = Date.now();
    setLocalTables(local, tenantId);
  }

  try {
    const tableRef = doc(db, 'businesses', tenantId, 'tables', tableId);
    await setDoc(tableRef, {
      id: tableId,
      status,
      currentOrderId: orderId || null,
      currentWaiterId: waiterId || null,
      currentWaiterName: waiterName || null,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to update table status in Firestore:', err);
  }
}

/**
 * Generate a clean 4-digit human-friendly order number (e.g. 1045)
 */
export function generateOrderNumber(): string {
  const base = 1000 + (Math.floor(Date.now() / 1000) % 9000);
  return String(base);
}

/**
 * Broadcast an order event across browser tabs and windows
 */
function broadcastOrderEvent(action: 'ORDER_CREATED' | 'ORDER_UPDATED', order: RestaurantOrder, tenantId: string) {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('bar_pos_orders_sync');
      channel.postMessage({ action, order, tenantId, timestamp: Date.now() });
      channel.close();
    }
  } catch (e) {}

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bar_pos_order_event', { detail: { action, order, tenantId } }));
    }
  } catch (e) {}
}

/**
 * Submit a waiter order (Order Status = 'pending_cashier')
 */
export async function submitWaiterOrder(
  data: {
    table: RestaurantTable;
    waiter: UserProfile;
    items: OrderItem[];
    customerName?: string;
    notes?: string;
  },
  tenantId: string = DEFAULT_BUSINESS_ID
): Promise<RestaurantOrder> {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const orderId = `order-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const orderNumber = generateOrderNumber();

  const totalAmount = data.items.reduce((sum, item) => sum + item.totalAmount, 0);

  const newOrder: RestaurantOrder = {
    id: orderId,
    orderNumber,
    tableId: data.table.id,
    tableName: data.table.name,
    customerName: data.customerName?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
    items: data.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalAmount: item.totalAmount,
      notes: item.notes?.trim() || undefined
    })),
    subtotal: totalAmount,
    totalAmount,
    orderStatus: 'pending_cashier',
    kitchenStatus: 'new',
    waiterId: data.waiter.uid,
    waiterName: data.waiter.name,
    paymentStatus: 'pending',
    businessDayId: todayStr,
    businessId: tenantId,
    date: todayStr,
    time: timeStr,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // 1. Cache in local storage first for instant zero-latency UI response
  const local = getLocalOrders(tenantId);
  local.unshift(newOrder);
  setLocalOrders(local, tenantId);

  // 2. Broadcast immediately to any Cashier tab/window open in browser
  broadcastOrderEvent('ORDER_CREATED', newOrder, tenantId);

  // 3. Update table status
  await updateTableStatus(data.table.id, 'order_pending', orderId, data.waiter.uid, data.waiter.name, tenantId);

  // 4. Persist to Firestore with undefined sanitization
  try {
    const cleanedOrder = cleanForFirestore(newOrder);
    const orderRef = doc(db, 'businesses', tenantId, 'orders', orderId);
    await setDoc(orderRef, cleanedOrder);
    console.log(`[OrderService] Order #${orderNumber} (${orderId}) successfully stored in Firestore at businesses/${tenantId}/orders`);
  } catch (err: any) {
    console.error('[OrderService] Warning: Failed to write order to Firestore, order preserved in local cache:', err);
  }

  // 5. Audit log
  logAuditAction(
    data.waiter.uid,
    data.waiter.name,
    'WAITER_ORDER_SUBMITTED',
    `Submitted Order #${orderNumber} for ${data.table.name} (${data.items.length} items, Total: KSh ${totalAmount})`,
    orderId
  ).catch(() => {});

  return newOrder;
}

/**
 * Subscribe to all orders (real-time for Cashier & Waiter views)
 * Combines Firestore onSnapshot with cross-tab BroadcastChannel & LocalStorage events
 */
export function subscribeOrders(
  tenantId: string = DEFAULT_BUSINESS_ID,
  callback: (orders: RestaurantOrder[]) => void
): () => void {
  // Immediately return existing local orders
  callback(getLocalOrders(tenantId));

  let unsubscribeFirestore: (() => void) | null = null;
  let broadcastChannel: BroadcastChannel | null = null;

  // Cross-tab broadcast listener (e.g. Waiter in one tab, Cashier in another)
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel('bar_pos_orders_sync');
      broadcastChannel.onmessage = (event) => {
        if (event.data?.tenantId === tenantId && event.data?.order) {
          const incoming: RestaurantOrder = event.data.order;
          const current = getLocalOrders(tenantId);
          const existingIdx = current.findIndex(o => o.id === incoming.id);
          if (existingIdx >= 0) {
            current[existingIdx] = incoming;
          } else {
            current.unshift(incoming);
          }
          current.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setLocalOrders(current, tenantId);
          callback(current);
        }
      };
    } catch (e) {}
  }

  // Window event listener (in-app components)
  const windowListener = (e: any) => {
    if (e.detail?.tenantId === tenantId && e.detail?.order) {
      const incoming: RestaurantOrder = e.detail.order;
      const current = getLocalOrders(tenantId);
      const existingIdx = current.findIndex(o => o.id === incoming.id);
      if (existingIdx >= 0) {
        current[existingIdx] = incoming;
      } else {
        current.unshift(incoming);
      }
      current.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setLocalOrders(current, tenantId);
      callback(current);
    }
  };

  const storageListener = (e: StorageEvent) => {
    if (e.key === `${LOCAL_ORDERS_KEY}_${tenantId}` || e.key === LOCAL_ORDERS_KEY) {
      callback(getLocalOrders(tenantId));
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('bar_pos_order_event', windowListener);
    window.addEventListener('storage', storageListener);
  }

  // Firestore real-time collection listener
  try {
    const ordersCol = collection(db, 'businesses', tenantId, 'orders');
    unsubscribeFirestore = onSnapshot(
      ordersCol,
      (snapshot) => {
        const firestoreList: RestaurantOrder[] = [];
        snapshot.forEach(d => firestoreList.push({ id: d.id, ...d.data() } as RestaurantOrder));
        
        // Merge with local orders so freshly submitted local orders are never blanked out by initial snapshot delay
        const local = getLocalOrders(tenantId);
        const map = new Map<string, RestaurantOrder>();
        // Add local first
        local.forEach(o => map.set(o.id, o));
        // Server authoritative updates overwrite
        firestoreList.forEach(o => map.set(o.id, o));

        const merged = Array.from(map.values());
        merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setLocalOrders(merged, tenantId);
        callback(merged);
      },
      (error) => {
        console.warn('Order subscription error from Firestore:', error);
        callback(getLocalOrders(tenantId));
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to orders in Firestore:', err);
  }

  return () => {
    if (unsubscribeFirestore) unsubscribeFirestore();
    if (broadcastChannel) broadcastChannel.close();
    if (typeof window !== 'undefined') {
      window.removeEventListener('bar_pos_order_event', windowListener);
      window.removeEventListener('storage', storageListener);
    }
  };
}

/**
 * Update an existing order (items, notes, status)
 */
export async function updateOrder(
  orderId: string,
  updates: Partial<RestaurantOrder>,
  tenantId: string = DEFAULT_BUSINESS_ID
): Promise<void> {
  const local = getLocalOrders(tenantId);
  const idx = local.findIndex(o => o.id === orderId);
  let updatedOrder: RestaurantOrder | null = null;
  if (idx >= 0) {
    local[idx] = { ...local[idx], ...updates, updatedAt: Date.now() };
    updatedOrder = local[idx];
    setLocalOrders(local, tenantId);
  }

  if (updatedOrder) {
    broadcastOrderEvent('ORDER_UPDATED', updatedOrder, tenantId);
  }

  try {
    const cleanedUpdates = cleanForFirestore({ ...updates, updatedAt: Date.now() });
    const orderRef = doc(db, 'businesses', tenantId, 'orders', orderId);
    await setDoc(orderRef, cleanedUpdates, { merge: true });
  } catch (err) {
    console.warn('Failed to update order in Firestore:', err);
  }
}

/**
 * Mark KOT as printed
 */
export async function recordKotPrinted(orderId: string, tenantId: string = DEFAULT_BUSINESS_ID): Promise<void> {
  await updateOrder(orderId, { kotPrintedAt: Date.now(), kitchenStatus: 'preparing' }, tenantId);
}

/**
 * Cashier processes payment for a waiter order:
 * 1. Validates payment details
 * 2. Creates completed Sale object with waiter and table metadata
 * 3. Saves sale via saveSaleLocallyAndQueue (which deducts inventory accurately upon sale completion)
 * 4. Marks order as 'paid' & 'completed'
 * 5. Frees the table status to 'available'
 * 6. Emits audit log and returns completed Sale for customer receipt printing!
 */
export async function processWaiterOrderPayment(
  order: RestaurantOrder,
  paymentData: {
    paymentMethod: PaymentMethod;
    amountTendered: number;
    change: number;
    referenceCode?: string;
  },
  cashier: UserProfile,
  businessConfig?: BusinessConfig | null,
  tenantId: string = DEFAULT_BUSINESS_ID
): Promise<Sale> {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];
  const saleId = `sale-order-${order.orderNumber}-${Date.now()}`;

  const completedSale: Sale = {
    id: saleId,
    businessId: tenantId,
    items: order.items.map(i => ({
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalAmount: i.totalAmount,
      notes: i.notes
    })),
    totalAmount: order.totalAmount,
    paymentMethod: paymentData.paymentMethod,
    amountTendered: paymentData.amountTendered,
    change: paymentData.change,
    referenceCode: paymentData.referenceCode?.trim() || undefined,
    tillNumber: businessConfig?.tillNumber || '5849201',
    cashierId: cashier.uid,
    cashierName: cashier.name,
    waiterId: order.waiterId,
    waiterName: order.waiterName,
    tableId: order.tableId,
    tableName: order.tableName,
    orderId: order.id,
    orderNumber: order.orderNumber,
    notes: order.notes,
    businessDayId: todayStr,
    date: todayStr,
    time: timeStr,
    createdAt: now.getTime()
  };

  // 1. Save sale locally, deduct stock, and queue for Firestore sync
  saveSaleLocallyAndQueue(cleanForFirestore(completedSale), tenantId);

  // 2. Mark order as paid & completed
  await updateOrder(
    order.id,
    {
      orderStatus: 'completed',
      paymentStatus: 'paid',
      cashierId: cashier.uid,
      cashierName: cashier.name,
      paymentMethod: paymentData.paymentMethod,
      saleId
    },
    tenantId
  );

  // 3. Reset table status back to available
  try {
    if (order.tableId) {
      await updateTableStatus(order.tableId, 'available', undefined, undefined, undefined, tenantId);
    }
  } catch (tErr) {
    console.warn('Failed to reset table status:', tErr);
  }

  // 4. Audit Log
  logAuditAction(
    cashier.uid,
    cashier.name,
    'ORDER_PAYMENT_PROCESSED',
    `Processed payment for Order #${order.orderNumber} (${order.tableName}, Waiter: ${order.waiterName}) of KSh ${order.totalAmount} via ${paymentData.paymentMethod}`,
    saleId
  ).catch(() => {});

  return completedSale;
}
