import React, { useEffect, useState } from 'react';
import { UserProfile, BusinessConfig, Sale, Product, DailyOpening, ExpenseRecord } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { formatCurrency } from '../../lib/utils';
import { 
  ShoppingCart, Receipt, Package, CalendarCheck, TrendingUp, DollarSign, 
  Layers, UtensilsCrossed, Sunrise, CheckCircle2, ArrowRight, Wallet, Plus 
} from 'lucide-react';
import { subscribeOrders } from '../../lib/orderService';
import { getLocalCachedProducts } from '../../lib/offlineManager';
import { subscribeExpenses, getLocalExpenses } from '../../lib/expenseService';
import { RecordExpenseModal } from '../common/RecordExpenseModal';

interface CashierDashboardProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
  setActiveTab: (tab: 'dashboard' | 'sell' | 'waiter_orders' | 'opening_stock' | 'stock' | 'closing' | 'sales' | 'expenses') => void;
}

export function CashierDashboard({ user, businessConfig, setActiveTab }: CashierDashboardProps) {
  const tenantId = user.businessId || DEFAULT_BUSINESS_ID;
  const todayStr = new Date().toISOString().split('T')[0];
  const currency = businessConfig?.currency || 'KSh';

  const [todaySalesTotal, setTodaySalesTotal] = useState<number>(() => {
    try {
      const localSales = JSON.parse(localStorage.getItem(`bar_pos_local_sales_${tenantId}`) || localStorage.getItem('bar_pos_local_sales') || '[]');
      return localSales.filter((s: Sale) => s.date === todayStr).reduce((acc: number, s: Sale) => acc + s.totalAmount, 0);
    } catch (e) {
      return 0;
    }
  });
  const [todayCashSalesTotal, setTodayCashSalesTotal] = useState<number>(() => {
    try {
      const localSales = JSON.parse(localStorage.getItem(`bar_pos_local_sales_${tenantId}`) || localStorage.getItem('bar_pos_local_sales') || '[]');
      return localSales.filter((s: Sale) => s.date === todayStr && s.paymentMethod === 'Cash').reduce((acc: number, s: Sale) => acc + s.totalAmount, 0);
    } catch (e) {
      return 0;
    }
  });
  const [todayExpensesTotal, setTodayExpensesTotal] = useState<number>(() => {
    try {
      const localExpenses = getLocalExpenses(tenantId);
      return localExpenses.filter(e => e.date === todayStr).reduce((sum, e) => sum + e.amount, 0);
    } catch (e) {
      return 0;
    }
  });
  const [todayDrawerExpensesTotal, setTodayDrawerExpensesTotal] = useState<number>(() => {
    try {
      const localExpenses = getLocalExpenses(tenantId);
      return localExpenses.filter(e => e.date === todayStr && e.paymentSource === 'Cash Drawer').reduce((sum, e) => sum + e.amount, 0);
    } catch (e) {
      return 0;
    }
  });
  const [todayItemsSold, setTodayItemsSold] = useState<number>(() => {
    try {
      const localSales = JSON.parse(localStorage.getItem(`bar_pos_local_sales_${tenantId}`) || localStorage.getItem('bar_pos_local_sales') || '[]');
      return localSales
        .filter((s: Sale) => s.date === todayStr)
        .reduce((acc: number, s: Sale) => acc + s.items.reduce((sum: number, i: any) => sum + i.quantity, 0), 0);
    } catch (e) {
      return 0;
    }
  });
  const [todayTransactionsCount, setTodayTransactionsCount] = useState<number>(() => {
    try {
      const localSales = JSON.parse(localStorage.getItem(`bar_pos_local_sales_${tenantId}`) || localStorage.getItem('bar_pos_local_sales') || '[]');
      return localSales.filter((s: Sale) => s.date === todayStr).length;
    } catch (e) {
      return 0;
    }
  });
  const [availableStockTotal, setAvailableStockTotal] = useState<number>(() => {
    const cached = getLocalCachedProducts(tenantId);
    return cached.reduce((sum, p) => sum + (p.currentStock !== undefined ? p.currentStock : (p.openingStock || 0)), 0);
  });
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [openingStockRecord, setOpeningStockRecord] = useState<DailyOpening | null>(() => {
    try {
      const localOpenings = JSON.parse(
        localStorage.getItem(`bar_pos_local_openings_${tenantId}`) || 
        localStorage.getItem('bar_pos_local_openings') || 
        '{}'
      );
      return localOpenings[`${todayStr}-${user.uid}`] || null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  // Subscribe to live expenses
  useEffect(() => {
    const unsub = subscribeExpenses(tenantId, (all) => {
      const todayList = all.filter(e => e.date === todayStr);
      const totalExp = todayList.reduce((sum, e) => sum + e.amount, 0);
      const drawerExp = todayList.filter(e => e.paymentSource === 'Cash Drawer').reduce((sum, e) => sum + e.amount, 0);
      setTodayExpensesTotal(totalExp);
      setTodayDrawerExpensesTotal(drawerExp);
    });
    return () => unsub();
  }, [tenantId, todayStr]);

  useEffect(() => {
    const unsub = subscribeOrders(tenantId, (orders) => {
      const pending = orders.filter(o => o.orderStatus !== 'completed' && o.orderStatus !== 'cancelled').length;
      setPendingOrdersCount(pending);
    });
    return () => unsub();
  }, [tenantId]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // 1. Check if opening stock is recorded today
        try {
          const localOpenings = JSON.parse(
            localStorage.getItem(`bar_pos_local_openings_${tenantId}`) || 
            localStorage.getItem('bar_pos_local_openings') || 
            '{}'
          );
          if (localOpenings[`${todayStr}-${user.uid}`]) {
            setOpeningStockRecord(localOpenings[`${todayStr}-${user.uid}`]);
          }
        } catch (e) {
          // ignore
        }

        if (typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            const opRef = doc(db, 'businesses', tenantId, 'dailyOpenings', `${todayStr}-${user.uid}`);
            const opSnap = await getDoc(opRef);
            if (opSnap.exists()) {
              setOpeningStockRecord(opSnap.data() as DailyOpening);
            }
          } catch (err) {
            console.warn("Could not check online opening stock:", err);
          }
        }
        
        // 2. Fetch today's sales
        const salesRef = collection(db, 'businesses', tenantId, 'sales');
        const qSales = query(salesRef, where('date', '==', todayStr));
        const salesSnap = await getDocs(qSales);
        
        let totalCash = 0;
        let totalQty = 0;
        salesSnap.forEach(docSnap => {
          const data = docSnap.data() as Sale;
          totalCash += data.totalAmount;
          data.items.forEach(item => {
            totalQty += item.quantity;
          });
        });

        setTodaySalesTotal(totalCash);
        setTodayItemsSold(totalQty);
        setTodayTransactionsCount(salesSnap.size);

        // 3. Fetch products current stock
        const prodRef = collection(db, 'businesses', tenantId, 'products');
        const prodSnap = await getDocs(prodRef);
        let stockSum = 0;
        prodSnap.forEach(docSnap => {
          const prod = docSnap.data() as Product;
          stockSum += (prod.currentStock || 0);
        });
        setAvailableStockTotal(stockSum);
      } catch (err) {
        console.warn("Using local fallback stats due to permission error:", err);
        try {
          const localSales = JSON.parse(localStorage.getItem(`bar_pos_local_sales_${tenantId}`) || localStorage.getItem('bar_pos_local_sales') || '[]');
          const todayStr = new Date().toISOString().split('T')[0];
          let totalCash = 0;
          let totalQty = 0;
          let count = 0;
          localSales.forEach((s: Sale) => {
            if (s.date === todayStr) {
              totalCash += s.totalAmount;
              count++;
              s.items.forEach(i => {
                totalQty += i.quantity;
              });
            }
          });
          setTodaySalesTotal(totalCash);
          setTodayItemsSold(totalQty);
          setTodayTransactionsCount(count);
          setAvailableStockTotal(150);
        } catch (e) {
          setTodaySalesTotal(0);
          setTodayItemsSold(0);
          setTodayTransactionsCount(0);
          setAvailableStockTotal(150);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [tenantId, user.uid]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-amber-600 to-amber-700 p-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Welcome back, {user.name}!</h2>
            <p className="text-amber-100 text-sm mt-1">Ready to record sales and manage today's shift effortlessly.</p>
          </div>
          <button
            onClick={() => setActiveTab('sell')}
            className="inline-flex items-center justify-center space-x-2 rounded-2xl bg-white px-6 py-3.5 text-base font-bold text-amber-800 shadow-lg hover:bg-amber-50 active:scale-95 transition-all cursor-pointer"
          >
            <ShoppingCart className="w-5 h-5" />
            <span>RECORD SALE NOW</span>
          </button>
        </div>
      </div>

      {/* Opening Stock Status Alert Banner */}
      {!openingStockRecord ? (
        <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-200/80 flex items-center justify-center shrink-0 text-amber-900 mt-0.5">
              <Sunrise className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-amber-950 text-sm sm:text-base">Shift Opening Stock Pending</h4>
              <p className="text-xs sm:text-sm text-amber-800 mt-0.5">
                Count physical bottles on shelves and bars to record your starting baseline before selling.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('opening_stock')}
            className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black tracking-wide shadow-sm cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <span>TAKE OPENING STOCK</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-emerald-950 text-sm">Opening Stock Verified</h4>
              <p className="text-xs text-emerald-700">
                {openingStockRecord.totalOpeningUnits} bottles counted across {openingStockRecord.items.length} items by {openingStockRecord.cashierName}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('opening_stock')}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100/70 hover:bg-emerald-200/80 px-3 py-1.5 rounded-lg cursor-pointer transition-colors shrink-0"
          >
            Review Opening Stock
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Today's Sales */}
        <div className="rounded-2xl bg-white p-5 shadow-xs border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Today's Sales</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">
              {loading ? '...' : formatCurrency(todaySalesTotal, currency)}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{todayTransactionsCount} transactions</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Today's Expenses */}
        <div 
          onClick={() => setActiveTab('expenses')}
          className="rounded-2xl bg-white p-5 shadow-xs border border-gray-100 flex items-center justify-between cursor-pointer hover:border-amber-400 transition-all group"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-600 flex items-center space-x-1">
              <span>Today's Expenses</span>
            </p>
            <p className="text-2xl font-extrabold text-rose-600 mt-1">
              -{loading ? '...' : formatCurrency(todayExpensesTotal, currency)}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 group-hover:text-amber-600 transition-colors">
              Click to view outlays →
            </p>
          </div>
          <div className="rounded-xl bg-rose-50 p-3 text-rose-600 group-hover:scale-105 transition-transform">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Expected Net Cash Drawer */}
        <div className="rounded-2xl bg-white p-5 shadow-xs border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Net Drawer Cash</p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">
              {loading ? '...' : formatCurrency(Math.max(0, todayCashSalesTotal - todayDrawerExpensesTotal), currency)}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Cash Sales - Cash Outlays</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Items Sold */}
        <div className="rounded-2xl bg-white p-5 shadow-xs border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Items Sold</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">
              {loading ? '...' : todayItemsSold.toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Bottles & glasses</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Current Stock */}
        <div className="rounded-2xl bg-white p-5 shadow-xs border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Current Stock</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">
              {loading ? '...' : availableStockTotal.toLocaleString()} <span className="text-xs font-normal text-gray-400">units</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Across catalog</p>
          </div>
          <div className="rounded-xl bg-purple-50 p-3 text-purple-600">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Cashier Actions Grid */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Quick POS Actions</h3>
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 text-xs font-bold border border-amber-500/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-600" />
            <span>Record Cashier Expense</span>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
          <button
            onClick={() => setActiveTab('waiter_orders')}
            className="relative flex flex-col items-center justify-center p-5 rounded-3xl bg-amber-600 text-white shadow-lg shadow-amber-600/30 hover:bg-amber-700 active:scale-95 transition-all group text-center cursor-pointer"
          >
            {pendingOrdersCount > 0 && (
              <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-black bg-white text-slate-950 animate-bounce">
                {pendingOrdersCount} NEW
              </span>
            )}
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <UtensilsCrossed className="w-6 h-6 text-white" />
            </div>
            <span className="text-base font-bold">WAITER ORDERS</span>
            <span className="text-[11px] text-amber-100 mt-0.5">
              {pendingOrdersCount > 0 ? `${pendingOrdersCount} pending` : 'Settle orders'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sell')}
            className="flex flex-col items-center justify-center p-5 rounded-3xl bg-slate-900 text-white shadow-lg hover:bg-slate-800 active:scale-95 transition-all group text-center cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <ShoppingCart className="w-6 h-6 text-amber-400" />
            </div>
            <span className="text-base font-bold">DIRECT SALE</span>
            <span className="text-[11px] text-slate-300 mt-0.5">Counter walk-in POS</span>
          </button>

          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex flex-col items-center justify-center p-5 rounded-3xl bg-rose-50 border-2 border-rose-300/80 text-rose-950 shadow-xs hover:border-rose-500 hover:shadow-md active:scale-95 transition-all group text-center cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-200/80 flex items-center justify-center mb-2.5 text-rose-800 group-hover:scale-110 transition-transform">
              <Wallet className="w-6 h-6" />
            </div>
            <span className="text-base font-bold">RECORD EXPENSE</span>
            <span className="text-[11px] text-rose-800 mt-0.5">Petty cash & outlays</span>
          </button>

          <button
            onClick={() => setActiveTab('opening_stock')}
            className="flex flex-col items-center justify-center p-5 rounded-3xl bg-amber-50 border-2 border-amber-300/80 text-amber-950 shadow-xs hover:border-amber-500 hover:shadow-md active:scale-95 transition-all group text-center cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-200/80 flex items-center justify-center mb-2.5 text-amber-800 group-hover:scale-110 transition-transform">
              <Sunrise className="w-6 h-6" />
            </div>
            <span className="text-base font-bold">OPENING STOCK</span>
            <span className="text-[11px] text-amber-800 mt-0.5">Shift start count</span>
          </button>

          <button
            onClick={() => setActiveTab('stock')}
            className="flex flex-col items-center justify-center p-5 rounded-3xl bg-white border border-gray-200 text-gray-900 shadow-xs hover:border-amber-500 hover:shadow-md active:scale-95 transition-all group text-center cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mb-2.5 text-purple-600 group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6" />
            </div>
            <span className="text-base font-bold">STOCK STATUS</span>
            <span className="text-[11px] text-gray-500 mt-0.5">Live bar inventory</span>
          </button>

          <button
            onClick={() => setActiveTab('closing')}
            className="flex flex-col items-center justify-center p-5 rounded-3xl bg-white border border-gray-200 text-gray-900 shadow-xs hover:border-emerald-500 hover:shadow-md active:scale-95 transition-all group text-center cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-2.5 text-emerald-600 group-hover:scale-110 transition-transform">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <span className="text-base font-bold">CLOSING STOCK</span>
            <span className="text-[11px] text-gray-500 mt-0.5">End-of-day reconciliation</span>
          </button>

          <button
            onClick={() => setActiveTab('sales')}
            className="flex flex-col items-center justify-center p-5 rounded-3xl bg-white border border-gray-200 text-gray-900 shadow-xs hover:border-amber-500 hover:shadow-md active:scale-95 transition-all group text-center cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-2.5 text-blue-600 group-hover:scale-110 transition-transform">
              <Receipt className="w-6 h-6" />
            </div>
            <span className="text-base font-bold">TODAY'S SALES</span>
            <span className="text-[11px] text-gray-500 mt-0.5">Receipts & payments</span>
          </button>
        </div>
      </div>

      {/* Record Expense Modal */}
      <RecordExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        user={user}
        businessConfig={businessConfig}
      />
    </div>
  );
}
