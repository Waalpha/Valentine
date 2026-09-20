import React, { useEffect, useState } from 'react';
import { UserProfile, BusinessConfig, Sale, Product } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { formatCurrency } from '../../lib/utils';
import { Receipt, Search, Download, Calendar, Filter, DollarSign, ShoppingBag, RotateCcw, Trash2, Printer } from 'lucide-react';
import { clearAllPaymentRecords } from '../../lib/offlineManager';
import { ReceiptModal } from '../common/ReceiptModal';
import { ThermalReceipt } from '../../printer/ThermalReceipt';

interface SalesReportsViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
}

export function SalesReportsView({ user, businessConfig }: SalesReportsViewProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [cashierFilter, setCashierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Clear Payment / Sales Records State
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [clearSuccess, setClearSuccess] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    let firestoreSales: Sale[] = [];
    try {
      const salesRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'sales');
      const salesSnap = await getDocs(salesRef);
      salesSnap.forEach(d => {
        firestoreSales.push({ id: d.id, ...d.data() } as Sale);
      });
    } catch (err) {
      console.warn("Could not fetch sales from Firestore, falling back to local storage:", err);
    }

    let localSales: Sale[] = [];
    try {
      localSales = JSON.parse(localStorage.getItem('bar_pos_local_sales') || '[]');
    } catch (e) {
      localSales = [];
    }

    // Merge and deduplicate by id
    const map = new Map<string, Sale>();
    [...localSales, ...firestoreSales].forEach(s => {
      if (s && s.id) {
        map.set(s.id, s);
      }
    });

    const mergedList = Array.from(map.values());
    mergedList.sort((a, b) => b.createdAt - a.createdAt);
    setSales(mergedList);

    try {
      const prodRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'products');
      const prodSnap = await getDocs(prodRef);
      const prods: Product[] = [];
      prodSnap.forEach(d => {
        prods.push({ id: d.id, ...d.data() } as Product);
      });
      setProducts(prods);
    } catch (e) {
      try {
        const localProds = JSON.parse(localStorage.getItem('bar_pos_local_products') || '[]');
        setProducts(localProds);
      } catch (err) {
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }
  }

  // Generate sample sales for testing/demo if list is empty
  const handleGenerateSampleSales = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = Date.now();
    const sampleSales: Sale[] = [
      {
        id: 'sale-demo-01',
        businessId: DEFAULT_BUSINESS_ID,
        items: [
          { productId: 'prod-tusker', productName: 'Tusker Lager (500ml)', quantity: 3, unitPrice: 250, totalAmount: 750, barcode: '6161101234567' },
          { productId: 'prod-nyama', productName: 'Nyama Choma Portion', quantity: 1, unitPrice: 600, totalAmount: 600 }
        ],
        totalAmount: 1350,
        paymentMethod: 'M-Pesa',
        amountTendered: 1350,
        change: 0,
        referenceCode: 'QBC84920K',
        tillNumber: '5849201',
        cashierId: user.uid,
        cashierName: user.name || 'Atieno',
        businessDayId: todayStr,
        date: todayStr,
        time: '14:30:22',
        createdAt: now - 3600000
      },
      {
        id: 'sale-demo-02',
        businessId: DEFAULT_BUSINESS_ID,
        items: [
          { productId: 'prod-whitecap', productName: 'White Cap Lager', quantity: 4, unitPrice: 260, totalAmount: 1040, barcode: '6161101234581' }
        ],
        totalAmount: 1040,
        paymentMethod: 'Cash',
        amountTendered: 1500,
        change: 460,
        tillNumber: '5849201',
        cashierId: user.uid,
        cashierName: user.name || 'Mercy',
        businessDayId: todayStr,
        date: todayStr,
        time: '16:15:05',
        createdAt: now - 1800000
      }
    ];

    try {
      const existing = JSON.parse(localStorage.getItem('bar_pos_local_sales') || '[]');
      const combined = [...sampleSales, ...existing];
      localStorage.setItem('bar_pos_local_sales', JSON.stringify(combined));
      setSales(combined);
      setSuccess('Successfully generated demo sales report entries!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      console.error('Failed to generate sample sales:', e);
    }
  };

  const [success, setSuccess] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const filteredSales = sales.filter(sale => {
    // Date filter
    if (dateFilter === 'today' && sale.date !== todayStr) return false;
    if (dateFilter === 'yesterday' && sale.date !== yesterdayStr) return false;
    // For week / month we can check timestamp diff or date string
    if (dateFilter === 'week') {
      const diff = Date.now() - sale.createdAt;
      if (diff > 7 * 86400000) return false;
    }
    if (dateFilter === 'month') {
      const diff = Date.now() - sale.createdAt;
      if (diff > 30 * 86400000) return false;
    }

    // Payment method filter
    if (paymentFilter !== 'all' && sale.paymentMethod !== paymentFilter) return false;

    // Cashier filter
    if (cashierFilter !== 'all' && sale.cashierName !== cashierFilter) return false;

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = sale.id.toLowerCase().includes(q);
      const matchCashier = sale.cashierName.toLowerCase().includes(q);
      const matchItem = sale.items.some(i => i.productName.toLowerCase().includes(q));
      if (!matchId && !matchCashier && !matchItem) return false;
    }

    return true;
  });

  const totalSalesAmount = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalTransactions = filteredSales.length;
  const totalQuantitySold = filteredSales.reduce((sum, s) => {
    return sum + s.items.reduce((acc, item) => acc + item.quantity, 0);
  }, 0);

  const cashiersList = Array.from(new Set(sales.map(s => s.cashierName)));

  const handleExportCSV = () => {
    let csv = 'Sale ID,Date,Time,Cashier,Payment Method,Total Amount,Items\n';
    filteredSales.forEach(s => {
      const itemsStr = s.items.map(i => `${i.productName} x${i.quantity}`).join('; ');
      csv += `"${s.id}","${s.date}","${s.time}","${s.cashierName}","${s.paymentMethod}",${s.totalAmount},"${itemsStr}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sales_report_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currency = businessConfig?.currency || 'KSh';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales Reports & Analytics</h2>
          <p className="text-sm text-gray-500">Filter, inspect, and export historical bar sales data</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setConfirmText('');
              setShowClearModal(true);
            }}
            className="inline-flex items-center space-x-2 rounded-2xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-3 text-sm font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-red-600" />
            <span>Clear / Reset Sales</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center space-x-2 rounded-2xl bg-slate-900 hover:bg-slate-800 px-5 py-3 text-sm font-bold text-white shadow-md transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV Report</span>
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center space-x-2 rounded-2xl border border-amber-600 bg-amber-50 hover:bg-amber-100 text-amber-800 px-4 py-3 text-sm font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print All Receipts</span>
          </button>
        </div>
      </div>

      {/* Hidden print container for all receipts */}
      <div className="hidden print:block space-y-4">
        {filteredSales.map((sale) => (
          <div key={sale.id} className="break-after-page">
            <ThermalReceipt sale={sale} businessConfig={businessConfig} />
          </div>
        ))}
      </div>

      {success && (
        <div className="flex items-center space-x-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          <span>{success}</span>
        </div>
      )}

      {clearSuccess && (
        <div className="flex items-center space-x-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          <span>{clearSuccess}</span>
        </div>
      )}

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Filtered Total Sales</p>
          <p className="text-2xl font-black text-amber-700 mt-1">{formatCurrency(totalSalesAmount, currency)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Transactions</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{totalTransactions.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Items Sold</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{totalQuantitySold.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-4 print:hidden">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Date Filter</label>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="w-full rounded-xl border border-gray-300 p-2.5 text-sm bg-white focus:border-amber-600 focus:outline-none"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Past 7 Days</option>
            <option value="month">Past 30 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Payment Method</label>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-2.5 text-sm bg-white focus:border-amber-600 focus:outline-none"
          >
            <option value="all">All Methods</option>
            <option value="Cash">Cash</option>
            <option value="M-Pesa">M-Pesa</option>
            <option value="Card">Card</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Cashier</label>
          <select
            value={cashierFilter}
            onChange={(e) => setCashierFilter(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-2.5 text-sm bg-white focus:border-amber-600 focus:outline-none"
          >
            <option value="all">All Cashiers</option>
            {cashiersList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Search</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sale ID, item..."
            className="w-full rounded-xl border border-gray-300 p-2.5 text-sm focus:border-amber-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Sales Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading sales reports...</div>
      ) : filteredSales.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-xs space-y-4">
          <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-1" />
          <h3 className="text-lg font-bold text-gray-800">No Sales Found</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {sales.length === 0 ? 'No sales have been recorded yet. Click below to generate sample sales or record a sale from the POS.' : 'Try adjusting your date or filter options.'}
          </p>
          {sales.length === 0 && (
            <button
              onClick={handleGenerateSampleSales}
              className="inline-flex items-center space-x-2 rounded-2xl bg-amber-600 hover:bg-amber-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-amber-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Generate Sample Sales</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden print:hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <th className="p-4">Transaction ID</th>
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">Cashier</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4">Items Sold</th>
                  <th className="p-4 text-right">Total Amount</th>
                  <th className="p-4 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-4 font-mono font-bold text-xs text-amber-800">#{sale.id.slice(-8).toUpperCase()}</td>
                    <td className="p-4 text-xs text-gray-500">{sale.date} {sale.time}</td>
                    <td className="p-4 font-medium text-gray-900">{sale.cashierName}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {sale.items.map((i, idx) => (
                          <span key={idx} className="bg-gray-100 px-2 py-0.5 rounded-md text-xs text-gray-700">
                            {i.productName} (×{i.quantity})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-right font-black text-amber-700">
                      {formatCurrency(sale.totalAmount, currency)}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedSaleForReceipt(sale)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-all cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Reprint</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedSaleForReceipt && (
        <ReceiptModal
          sale={selectedSaleForReceipt}
          businessConfig={businessConfig}
          onClose={() => setSelectedSaleForReceipt(null)}
        />
      )}

      {/* Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Clear All Payment Records?</h3>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              This action will permanently delete all sales transactions, payment histories (Cash, M-Pesa, Card), and cashier daily shift closings across both cloud Firestore and local storage.
            </p>

            <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold">What will be preserved:</p>
              <p>• All 70 catalog products, categories & prices</p>
              <p>• Current stock inventory levels</p>
              <p>• Staff and cashier logins</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Type <span className="font-bold text-red-600">CLEAR</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="Type CLEAR"
                className="w-full rounded-xl border border-gray-300 p-3 text-sm font-mono uppercase focus:border-red-600 focus:outline-none"
              />
            </div>

            <div className="flex space-x-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
                className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setClearing(true);
                  setClearSuccess('');
                  try {
                    const res = await clearAllPaymentRecords(user);
                    setShowClearModal(false);
                    setConfirmText('');
                    setSales([]);
                    setClearSuccess(`Successfully cleared all payment records (${res.deletedSales} sales, ${res.deletedClosings} closings deleted). Starting fresh!`);
                    setTimeout(() => {
                      window.location.reload();
                    }, 1400);
                  } catch (err: any) {
                    console.error('Failed to clear payment records:', err);
                  } finally {
                    setClearing(false);
                  }
                }}
                disabled={confirmText !== 'CLEAR' || clearing}
                className="flex items-center space-x-2 rounded-xl bg-red-600 hover:bg-red-700 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-red-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                <span>{clearing ? 'Clearing...' : 'Permanently Clear'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
