import React, { useEffect, useState } from 'react';
import { UserProfile, BusinessConfig, DailyClosing, DailyOpening } from '../../types';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { formatCurrency } from '../../lib/utils';
import { 
  CalendarCheck, 
  AlertTriangle, 
  CheckCircle2, 
  User, 
  DollarSign, 
  Sunrise, 
  Layers, 
  Printer, 
  Search,
  CheckCircle
} from 'lucide-react';

interface ClosingsViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
}

export function ClosingsView({ user, businessConfig }: ClosingsViewProps) {
  const tenantId = user.businessId || DEFAULT_BUSINESS_ID;
  const [activeSubTab, setActiveSubTab] = useState<'closings' | 'openings'>('closings');
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [openings, setOpenings] = useState<DailyOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStockAudits();
  }, [tenantId]);

  async function fetchStockAudits() {
    setLoading(true);

    // 1. Fetch Closings
    try {
      const closingRef = collection(db, 'businesses', tenantId, 'dailyClosings');
      const closingSnap = await getDocs(closingRef);
      const cList: DailyClosing[] = [];
      closingSnap.forEach(d => {
        cList.push({ id: d.id, ...d.data() } as DailyClosing);
      });
      cList.sort((a, b) => b.submittedAt - a.submittedAt);
      setClosings(cList);
    } catch (err) {
      console.warn("Using local fallback daily closings due to permission/offline:", err);
      try {
        const localClosings = JSON.parse(
          localStorage.getItem(`bar_pos_local_closings_${tenantId}`) || 
          localStorage.getItem('bar_pos_local_closings') || 
          '{}'
        );
        const list = Object.values(localClosings) as DailyClosing[];
        list.sort((a, b) => b.submittedAt - a.submittedAt);
        setClosings(list);
      } catch (e) {
        setClosings([]);
      }
    }

    // 2. Fetch Openings
    try {
      const openingRef = collection(db, 'businesses', tenantId, 'dailyOpenings');
      const openingSnap = await getDocs(openingRef);
      const oList: DailyOpening[] = [];
      openingSnap.forEach(d => {
        oList.push({ id: d.id, ...d.data() } as DailyOpening);
      });
      oList.sort((a, b) => b.submittedAt - a.submittedAt);
      setOpenings(oList);
    } catch (err) {
      console.warn("Using local fallback daily openings:", err);
      try {
        const localOpenings = JSON.parse(
          localStorage.getItem(`bar_pos_local_openings_${tenantId}`) || 
          localStorage.getItem('bar_pos_local_openings') || 
          '{}'
        );
        const list = Object.values(localOpenings) as DailyOpening[];
        list.sort((a, b) => b.submittedAt - a.submittedAt);
        setOpenings(list);
      } catch (e) {
        setOpenings([]);
      }
    } finally {
      setLoading(false);
    }
  }

  const currency = businessConfig?.currency || 'KSh';

  const filteredClosings = closings.filter(c => 
    searchQuery === '' ||
    c.date.includes(searchQuery) ||
    c.cashierName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOpenings = openings.filter(o => 
    searchQuery === '' ||
    o.date.includes(searchQuery) ||
    o.cashierName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Shift Stock Audits & Closings</h2>
          <p className="text-sm text-slate-500">Monitor cashiers' opening counts, end-of-shift reconciliations, and inventory variances</p>
        </div>

        {/* Search */}
        <div className="relative sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by cashier or date..."
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveSubTab('closings')}
          className={`flex items-center space-x-2 pb-3 px-4 text-sm font-bold border-b-2 cursor-pointer transition-colors ${
            activeSubTab === 'closings'
              ? 'border-amber-600 text-amber-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>Shift Closings ({closings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('openings')}
          className={`flex items-center space-x-2 pb-3 px-4 text-sm font-bold border-b-2 cursor-pointer transition-colors ${
            activeSubTab === 'openings'
              ? 'border-amber-600 text-amber-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sunrise className="w-4 h-4" />
          <span>Shift Openings ({openings.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span>Loading shift inventory records...</span>
        </div>
      ) : activeSubTab === 'closings' ? (
        filteredClosings.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs">
            <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800">No Daily Closings Found</h3>
            <p className="text-sm text-slate-500 mt-1">When cashiers submit end-of-day reports, they will be archived here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredClosings.map(closing => {
              const hasDiscrepancy = closing.items.some(i => i.variance !== 0);
              const shortages = closing.items.filter(i => i.variance < 0);
              const overages = closing.items.filter(i => i.variance > 0);

              return (
                <div key={closing.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center space-x-3.5">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${hasDiscrepancy ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                        {hasDiscrepancy ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-extrabold text-slate-900 text-base">Date: {closing.date}</h4>
                          <span className="text-xs text-slate-400">({new Date(closing.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Cashier: <strong className="text-slate-800">{closing.cashierName}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-xs text-slate-400 uppercase font-semibold">Total Shift Sales</p>
                        <p className="text-xl font-black text-amber-700">{formatCurrency(closing.totalSales, currency)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Breakdown & Cash Reconciliation */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-2xl">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">Cash Expected</p>
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(closing.paymentTotals.Cash, currency)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-rose-600 uppercase">Shift Expenses</p>
                      <p className="text-sm font-bold text-rose-600">
                        {closing.totalExpenses ? `-${formatCurrency(closing.totalExpenses, currency)}` : `${currency} 0`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">M-Pesa</p>
                      <p className="text-sm font-bold text-emerald-700">{formatCurrency(closing.paymentTotals['M-Pesa'], currency)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">Card & Other</p>
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(closing.paymentTotals.Card + closing.paymentTotals.Other, currency)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">Cash Declared in Drawer</p>
                      <p className="text-sm font-bold text-slate-900">
                        {closing.cashierDeclaredCash !== undefined ? formatCurrency(closing.cashierDeclaredCash, currency) : 'N/A'}
                        {closing.cashVariance !== undefined && (
                          <span className={`block text-[11px] font-bold ${closing.cashVariance === 0 ? 'text-emerald-600' : closing.cashVariance < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                            {closing.cashVariance === 0 ? 'Balanced' : `Diff: ${closing.cashVariance > 0 ? '+' : ''}${formatCurrency(closing.cashVariance, currency)}`}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Expenses List if recorded */}
                  {closing.expensesList && closing.expensesList.length > 0 && (
                    <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 space-y-1.5 text-xs">
                      <div className="font-bold text-rose-900">
                        Recorded Shift Outlays ({closing.expensesList.length}):
                      </div>
                      <div className="divide-y divide-rose-100/60 max-h-32 overflow-y-auto">
                        {closing.expensesList.map((exp, eIdx) => (
                          <div key={eIdx} className="py-1.5 flex items-center justify-between text-slate-700">
                            <div>
                              <span className="font-bold text-slate-900 mr-2">{exp.category}</span>
                              <span>What for: <strong>{exp.reason}</strong></span>
                              <span className="ml-2 text-[10px] text-slate-400">({exp.paymentSource})</span>
                            </div>
                            <span className="font-bold text-rose-600">-{formatCurrency(exp.amount, currency)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {closing.notes && (
                    <p className="text-xs text-slate-700 italic bg-amber-50/70 p-3 rounded-xl border border-amber-200/70">
                      <strong>Cashier Note:</strong> "{closing.notes}"
                    </p>
                  )}

                  {/* Items Table */}
                  <div className="overflow-x-auto pt-1">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase">
                          <th className="pb-2">Product Name</th>
                          <th className="pb-2 text-center">Opening</th>
                          <th className="pb-2 text-center">Added</th>
                          <th className="pb-2 text-center">Sold</th>
                          <th className="pb-2 text-center">Expected</th>
                          <th className="pb-2 text-center">Physical Count</th>
                          <th className="pb-2 text-center">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {closing.items.map((item, idx) => (
                          <tr key={idx} className={item.variance !== 0 ? 'bg-red-50/40 font-semibold' : ''}>
                            <td className="py-2.5 text-slate-900">{item.productName}</td>
                            <td className="py-2.5 text-center text-slate-500">{item.openingStock ?? '-'}</td>
                            <td className="py-2.5 text-center text-blue-600">{item.stockAdded ? `+${item.stockAdded}` : '0'}</td>
                            <td className="py-2.5 text-center text-amber-700">{item.soldQuantity ? `-${item.soldQuantity}` : '0'}</td>
                            <td className="py-2.5 text-center text-slate-600">{item.expected}</td>
                            <td className="py-2.5 text-center text-slate-900 font-bold">{item.actual}</td>
                            <td className="py-2.5 text-center">
                              {item.variance === 0 ? (
                                <span className="text-emerald-700 font-bold">0 (Match)</span>
                              ) : item.variance < 0 ? (
                                <span className="text-red-600 font-bold">Shortage: {item.variance}</span>
                              ) : (
                                <span className="text-blue-600 font-bold">Overage: +{item.variance}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* OPENINGS TAB */
        filteredOpenings.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs">
            <Sunrise className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800">No Shift Openings Recorded Yet</h3>
            <p className="text-sm text-slate-500 mt-1">When cashiers take morning/shift opening stock, the records will appear here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredOpenings.map(opening => (
              <div key={opening.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 border border-amber-200 flex items-center justify-center shrink-0">
                      <Sunrise className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-extrabold text-slate-900 text-base">Date: {opening.date}</h4>
                        <span className="text-xs text-slate-400">({new Date(opening.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Recorded by cashier: <strong className="text-slate-800">{opening.cashierName}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase font-semibold">Total Opening Bottles</p>
                    <p className="text-xl font-black text-slate-900">{opening.totalOpeningUnits} units</p>
                  </div>
                </div>

                {opening.notes && (
                  <p className="text-xs text-slate-700 italic bg-amber-50/70 p-3 rounded-xl border border-amber-200/70">
                    <strong>Opening Remarks:</strong> "{opening.notes}"
                  </p>
                )}

                {/* Items Table */}
                <div className="overflow-x-auto pt-1">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase">
                        <th className="pb-2">Product Name</th>
                        <th className="pb-2 text-center">System Previous Stock</th>
                        <th className="pb-2 text-center">Physical Count (Baseline)</th>
                        <th className="pb-2 text-center">Variance Adjusted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {opening.items.map((item, idx) => (
                        <tr key={idx} className={item.variance !== 0 ? 'bg-amber-50/40 font-semibold' : ''}>
                          <td className="py-2.5 text-slate-900">{item.productName}</td>
                          <td className="py-2.5 text-center text-slate-500">{item.systemStock}</td>
                          <td className="py-2.5 text-center text-slate-900 font-bold">{item.actualCount}</td>
                          <td className="py-2.5 text-center">
                            {item.variance === 0 ? (
                              <span className="text-emerald-700 font-bold">Exact (0)</span>
                            ) : item.variance < 0 ? (
                              <span className="text-red-600 font-bold">Adjusted: {item.variance}</span>
                            ) : (
                              <span className="text-blue-600 font-bold">Adjusted: +{item.variance}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
