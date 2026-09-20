import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, BusinessConfig, Sale, RestaurantOrder } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { formatCurrency } from '../../lib/utils';
import {
  Users,
  Award,
  TrendingUp,
  Clock,
  CheckCircle2,
  Calendar,
  UtensilsCrossed,
  DollarSign
} from 'lucide-react';
import { subscribeOrders } from '../../lib/orderService';

interface WaiterPerformanceViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
}

interface WaiterMetrics {
  waiterId: string;
  waiterName: string;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalSalesValue: number;
  averageOrderValue: number;
}

export function WaiterPerformanceView({ user, businessConfig }: WaiterPerformanceViewProps) {
  const tenantId = user.businessId || DEFAULT_BUSINESS_ID;
  const currency = businessConfig?.currency || 'KSh';

  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

  useEffect(() => {
    // 1. Subscribe to orders
    const unsub = subscribeOrders(tenantId, (loaded) => {
      setOrders(loaded);
    });

    // 2. Fetch sales from Firestore
    async function loadSales() {
      try {
        const salesCol = collection(db, 'businesses', tenantId, 'sales');
        const snap = await getDocs(salesCol);
        const list: Sale[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as Sale));
        setSales(list);
      } catch (e) {
        console.warn('Failed to load sales for waiter performance:', e);
      } finally {
        setLoading(false);
      }
    }

    loadSales();
    return () => unsub();
  }, [tenantId]);

  // Filter orders and sales by date
  const filteredData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const filterFn = (item: { date: string }) => {
      if (timeFilter === 'today') return item.date === todayStr;
      if (timeFilter === 'week') return item.date >= oneWeekAgo;
      if (timeFilter === 'month') return item.date >= oneMonthAgo;
      return true;
    };

    return {
      orders: orders.filter(filterFn),
      sales: sales.filter(filterFn)
    };
  }, [orders, sales, timeFilter]);

  // Aggregate by Waiter
  const waiterMetrics = useMemo(() => {
    const map = new Map<string, WaiterMetrics>();

    // Process all orders
    filteredData.orders.forEach((o) => {
      if (!o.waiterId) return;
      if (!map.has(o.waiterId)) {
        map.set(o.waiterId, {
          waiterId: o.waiterId,
          waiterName: o.waiterName || 'Staff',
          totalOrders: 0,
          completedOrders: 0,
          pendingOrders: 0,
          totalSalesValue: 0,
          averageOrderValue: 0
        });
      }

      const m = map.get(o.waiterId)!;
      m.totalOrders += 1;
      if (o.orderStatus === 'completed') {
        m.completedOrders += 1;
        m.totalSalesValue += o.totalAmount;
      } else if (o.orderStatus !== 'cancelled') {
        m.pendingOrders += 1;
      }
    });

    // Also scan sales that might have been processed directly without an existing order in memory
    const existingOrderIds = new Set(filteredData.orders.map(o => o.id));
    filteredData.sales.forEach((s) => {
      if (!s.waiterId) return;
      // If this sale was already accounted for via its completed order, skip it
      if (s.orderId && existingOrderIds.has(s.orderId)) return;

      if (!map.has(s.waiterId)) {
        map.set(s.waiterId, {
          waiterId: s.waiterId,
          waiterName: s.waiterName || 'Staff',
          totalOrders: 0,
          completedOrders: 0,
          pendingOrders: 0,
          totalSalesValue: 0,
          averageOrderValue: 0
        });
      }
      const m = map.get(s.waiterId)!;
      m.totalOrders += 1;
      m.completedOrders += 1;
      m.totalSalesValue += s.totalAmount;
    });

    // Compute average order value
    const list = Array.from(map.values()).map((m) => ({
      ...m,
      averageOrderValue: m.completedOrders > 0 ? Math.round(m.totalSalesValue / m.completedOrders) : 0
    }));

    // Sort by total sales value descending
    list.sort((a, b) => b.totalSalesValue - a.totalSalesValue);
    return list;
  }, [filteredData]);

  // Totals across all waiters
  const grandTotals = useMemo(() => {
    return waiterMetrics.reduce(
      (acc, m) => ({
        totalOrders: acc.totalOrders + m.totalOrders,
        completedOrders: acc.completedOrders + m.completedOrders,
        pendingOrders: acc.pendingOrders + m.pendingOrders,
        totalSalesValue: acc.totalSalesValue + m.totalSalesValue
      }),
      { totalOrders: 0, completedOrders: 0, pendingOrders: 0, totalSalesValue: 0 }
    );
  }, [waiterMetrics]);

  return (
    <div className="space-y-6">
      {/* Header & Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-600" />
            <span>Waiter Performance & Sales</span>
          </h2>
          <p className="text-sm text-gray-500">
            Track orders taken, completions, and total revenue generated by each waiter
          </p>
        </div>

        {/* Time Filter Pills */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-gray-200 shadow-xs">
          <button
            onClick={() => setTimeFilter('today')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              timeFilter === 'today'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setTimeFilter('week')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              timeFilter === 'week'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setTimeFilter('month')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              timeFilter === 'month'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setTimeFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              timeFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Revenue</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">
            {formatCurrency(grandTotals.totalSalesValue, currency)}
          </p>
          <p className="text-xs text-gray-500 mt-1">From completed waiter orders</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Orders</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">{grandTotals.totalOrders}</p>
          <p className="text-xs text-gray-500 mt-1">Submitted by floor staff</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Completed Orders</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-2">{grandTotals.completedOrders}</p>
          <p className="text-xs text-emerald-600 mt-1">Paid at cashier</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Pending Orders</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-700 mt-2">{grandTotals.pendingOrders}</p>
          <p className="text-xs text-amber-600 mt-1">Awaiting payment</p>
        </div>
      </div>

      {/* Waiter Leaderboard / Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600" />
            <span>Staff Sales Breakdown</span>
          </h3>
          <span className="text-xs text-gray-500">
            {waiterMetrics.length} staff active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-3.5 px-4">Waiter Name</th>
                <th className="py-3.5 px-4 text-center">Total Orders</th>
                <th className="py-3.5 px-4 text-center">Completed</th>
                <th className="py-3.5 px-4 text-center">Pending</th>
                <th className="py-3.5 px-4 text-right">Avg / Order</th>
                <th className="py-3.5 px-4 text-right">Total Sales Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {waiterMetrics.map((waiter, index) => (
                <tr key={waiter.waiterId} className="hover:bg-amber-50/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs">
                        {index + 1}
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 block">{waiter.waiterName}</span>
                        <span className="text-[11px] text-gray-400">ID: {waiter.waiterId.slice(-6)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-gray-700">
                    {waiter.totalOrders}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      {waiter.completedOrders}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {waiter.pendingOrders > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                        {waiter.pendingOrders}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right text-gray-600">
                    {formatCurrency(waiter.averageOrderValue, currency)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-gray-900 text-base">
                    {formatCurrency(waiter.totalSalesValue, currency)}
                  </td>
                </tr>
              ))}

              {waiterMetrics.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-sm">No waiter orders recorded for this period</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
