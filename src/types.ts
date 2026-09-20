import type { PrinterFontSettings } from './printer/printerTypes';

export type UserRole = 'admin' | 'manager' | 'cashier' | 'waiter';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string;
  status: 'active' | 'disabled' | 'deleted';
  createdAt: string;
  pin?: string;
}

export type TableStatus = 'available' | 'occupied' | 'order_pending' | 'served' | 'payment_pending';

export interface RestaurantTable {
  id: string;
  name: string;
  status: TableStatus;
  currentOrderId?: string;
  currentWaiterId?: string;
  currentWaiterName?: string;
  guestCount?: number;
  businessId?: string;
  createdAt: number;
  updatedAt: number;
}

export type OrderStatus = 'draft' | 'submitted' | 'pending_cashier' | 'payment_pending' | 'paid' | 'completed' | 'cancelled';
export type KitchenStatus = 'new' | 'preparing' | 'ready' | 'served';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  notes?: string;
}

export interface RestaurantOrder {
  id: string;
  orderNumber: string; // e.g. "1045"
  tableId: string;
  tableName: string;
  customerName?: string;
  notes?: string;
  items: OrderItem[];
  subtotal: number;
  totalAmount: number;
  orderStatus: OrderStatus;
  kitchenStatus: KitchenStatus;
  waiterId: string;
  waiterName: string;
  cashierId?: string;
  cashierName?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus: 'pending' | 'paid';
  saleId?: string;
  businessDayId: string;
  businessId: string;
  date: string;
  time: string;
  createdAt: number;
  updatedAt: number;
  kotPrintedAt?: number;
}

export interface BusinessConfig {
  id: string;
  name: string;
  logoUrl?: string;
  phone: string;
  tillNumber?: string; // M-Pesa Buy Goods Till Number (printed on receipt)
  paybillNumber?: string; // Optional Paybill Number
  location: string;
  address: string;
  currency: string; // e.g. "KSh"
  openingTime: string;
  closingTime: string;
  lowStockThreshold: number;
  receiptHeader?: string;
  receiptFooter?: string;
  printerFontSettings?: PrinterFontSettings;
  allowNegativeStock?: boolean; // When false, POS blocks selling beyond currentStock
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string; // Code 128, EAN-13, UPC, etc. (unique within tenant)
  categoryId: string;
  categoryName: string;
  unitType: 'Bottle' | 'Can' | 'Glass' | 'Crate' | 'Piece' | 'Shot' | 'Packet';
  buyingPrice?: number;
  sellingPrice: number;
  openingStock: number;
  currentStock: number;
  stockAdded: number; // accumulated added stock during day
  minStockLevel: number;
  status: 'active' | 'inactive';
  businessId?: string; // Tenant isolation key
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  notes?: string;
}

export type PaymentMethod = 'Cash' | 'M-Pesa' | 'Card' | 'Other';

export interface Sale {
  id: string;
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  amountTendered?: number;
  change?: number;
  referenceCode?: string;
  tillNumber?: string; // Active till number for the transaction
  cashierId: string;
  cashierName: string;
  waiterId?: string;
  waiterName?: string;
  tableId?: string;
  tableName?: string;
  orderId?: string;
  orderNumber?: string;
  notes?: string;
  businessDayId: string;
  businessId?: string; // Tenant isolation key
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  createdAt: number; // timestamp millis
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  previousStock: number;
  addedQty: number;
  newStock: number;
  date: string;
  time: string;
  adminId: string;
  adminName: string;
  reason: string;
  createdAt: number;
}

export interface BusinessDay {
  id: string; // YYYY-MM-DD
  date: string;
  openingTime: string;
  closingTime: string;
  openedBy: string;
  closedBy?: string;
  status: 'open' | 'closed';
  createdAt: number;
}

export interface OpeningItem {
  productId: string;
  productName: string;
  categoryName?: string;
  unitType?: string;
  previousStock: number;
  openingStock: number;
  variance?: number; // openingStock - previousStock
  notes?: string;
}

export interface DailyOpening {
  id: string; // YYYY-MM-DD-cashierId
  businessDayId: string;
  date: string;
  cashierId: string;
  cashierName: string;
  items: OpeningItem[];
  totalOpeningUnits: number;
  notes?: string;
  submittedAt: number;
  status: 'confirmed';
}

export interface ClosingItem {
  productId: string;
  productName: string;
  categoryName?: string;
  openingStock?: number;
  stockAdded?: number;
  soldQuantity?: number;
  expected: number;
  actual: number;
  variance: number; // actual - expected
  buyingPrice?: number;
  sellingPrice?: number;
}

export interface DailyClosing {
  id: string;
  businessDayId: string;
  date: string;
  cashierId: string;
  cashierName: string;
  items: ClosingItem[];
  totalSales: number;
  paymentTotals: {
    Cash: number;
    'M-Pesa': number;
    Card: number;
    Other: number;
  };
  totalTransactions: number;
  totalItemsSold: number;
  cashierDeclaredCash?: number;
  cashVariance?: number;
  notes?: string;
  submittedAt: number;
  status: 'submitted' | 'reviewed';
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  date: string;
  time: string;
  recordId?: string;
  description: string;
  createdAt: number;
}
