import React, { useState, useEffect } from 'react';
import { UserProfile, BusinessConfig, ExpenseRecord, ExpenseCategory } from '../../types';
import { DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { subscribeExpenses, deleteExpense } from '../../lib/expenseService';
import { RecordExpenseModal } from '../common/RecordExpenseModal';
import { formatCurrency } from '../../lib/utils';
import { 
  Wallet, 
  Plus, 
  Search, 
  Filter, 
  Printer, 
  Download, 
  Trash2, 
  Calendar, 
  DollarSign, 
  Tag, 
  Smartphone, 
  CreditCard,
  CheckCircle2,
  Users,
  FileSpreadsheet
} from 'lucide-react';

interface AdminExpensesViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
}

export function AdminExpensesView({ user, businessConfig }: AdminExpensesViewProps) {
  const tenantId = user.businessId || DEFAULT_BUSINESS_ID;
  const currency = businessConfig?.currency || 'KSh';
  const todayStr = new Date().toISOString().split('T')[0];

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | 'month' | 'all' | 'custom'>('all');
  const [customDate, setCustomDate] = useState(todayStr);
  const [selectedCashier, setSelectedCashier] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeExpenses(tenantId, (all) => {
      setExpenses(all);
      setLoading(false);
    });
    return () => unsub();
  }, [tenantId]);

  // Date filtering logic
  const now = new Date();
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const sevenDaysAgoStr = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const thisMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM

  const filteredExpenses = expenses.filter((e) => {
    // 1. Date filter
    if (dateFilter === 'today' && e.date !== todayStr) return false;
    if (dateFilter === 'yesterday' && e.date !== yesterdayStr) return false;
    if (dateFilter === '7days' && e.date < sevenDaysAgoStr) return false;
    if (dateFilter === 'month' && !e.date.startsWith(thisMonthPrefix)) return false;
    if (dateFilter === 'custom' && e.date !== customDate) return false;

    // 2. Cashier filter
    if (selectedCashier !== 'all' && e.cashierId !== selectedCashier && e.cashierName !== selectedCashier) return false;

    // 3. Category filter
    if (selectedCategory !== 'all' && e.category !== selectedCategory) return false;

    // 4. Source filter
    if (selectedSource !== 'all' && e.paymentSource !== selectedSource) return false;

    // 5. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchReason = e.reason.toLowerCase().includes(q);
      const matchCategory = e.category.toLowerCase().includes(q);
      const matchCashier = e.cashierName.toLowerCase().includes(q);
      const matchVoucher = e.voucherNumber ? e.voucherNumber.toLowerCase().includes(q) : false;
      const matchReceipt = e.receiptNumber ? e.receiptNumber.toLowerCase().includes(q) : false;
      if (!matchReason && !matchCategory && !matchCashier && !matchVoucher && !matchReceipt) return false;
    }

    return true;
  });

  // Unique cashiers for filter dropdown
  const cashiersList = Array.from(new Set(expenses.map(e => e.cashierName))).filter(Boolean);

  // Summary calculations
  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const cashDrawerTotal = filteredExpenses.filter(e => e.paymentSource === 'Cash Drawer').reduce((sum, e) => sum + e.amount, 0);
  const mpesaTotal = filteredExpenses.filter(e => e.paymentSource === 'M-Pesa').reduce((sum, e) => sum + e.amount, 0);
  const avgExpense = filteredExpenses.length > 0 ? Math.round(totalAmount / filteredExpenses.length) : 0;

  const handleDeleteExpense = async (exp: ExpenseRecord) => {
    if (!window.confirm(`Are you sure you want to void this expense of ${currency} ${exp.amount.toLocaleString()} for "${exp.reason}"?`)) {
      return;
    }
    try {
      await deleteExpense(exp.id, tenantId, user, 'Voided by Administrator');
      setSuccessMessage('Expense successfully voided and logged.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to void expense');
    }
  };

  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) {
      alert('No expense records to export.');
      return;
    }

    const headers = ['Voucher No', 'Date', 'Time', 'Cashier', 'Category', 'What For (Reason)', 'Payment Source', 'Amount', 'Receipt Ref', 'Notes'];
    const rows = filteredExpenses.map(e => [
      `"${e.voucherNumber || e.id}"`,
      `"${e.date}"`,
      `"${e.time}"`,
      `"${e.cashierName}"`,
      `"${e.category}"`,
      `"${e.reason.replace(/"/g, '""')}"`,
      `"${e.paymentSource}"`,
      e.amount,
      `"${e.receiptNumber || ''}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `expenses_report_${dateFilter}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Expense Audit Report - ${businessConfig?.name || 'Club Paxx'}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 20px; font-weight: bold; color: #0f172a; }
          .stats { display: flex; justify-content: space-between; margin-bottom: 20px; background: #f8fafc; padding: 12px; border-radius: 8px; }
          .stat-box { text-align: center; }
          .stat-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .stat-val { font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
          th { background: #f1f5f9; padding: 8px; text-align: left; font-weight: bold; border-bottom: 2px solid #cbd5e1; }
          td { padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          .bold { font-weight: bold; }
          .text-right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${businessConfig?.name || 'CLUB PAXX'}</div>
          <div>OPERATIONAL EXPENSES AUDIT REPORT</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
            Filter: ${dateFilter.toUpperCase()} • Generated on: ${new Date().toLocaleString()}
          </div>
        </div>

        <div class="stats">
          <div class="stat-box">
            <div class="stat-title">Total Outlays</div>
            <div class="stat-val">${currency} ${totalAmount.toLocaleString()}</div>
          </div>
          <div class="stat-box">
            <div class="stat-title">Cash Drawer (Petty)</div>
            <div class="stat-val">${currency} ${cashDrawerTotal.toLocaleString()}</div>
          </div>
          <div class="stat-box">
            <div class="stat-title">M-Pesa / Digital</div>
            <div class="stat-val">${currency} ${mpesaTotal.toLocaleString()}</div>
          </div>
          <div class="stat-box">
            <div class="stat-title">Records Count</div>
            <div class="stat-val">${filteredExpenses.length}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Cashier</th>
              <th>Category</th>
              <th>Explain What For (Reason)</th>
              <th>Source</th>
              <th>Voucher / Ref</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${filteredExpenses.map(e => `
              <tr>
                <td>${e.date} ${e.time}</td>
                <td class="bold">${e.cashierName}</td>
                <td>${e.category}</td>
                <td>
                  <div class="bold">${e.reason}</div>
                  ${e.notes ? `<div style="font-size: 11px; color: #64748b;">Note: ${e.notes}</div>` : ''}
                </td>
                <td>${e.paymentSource}</td>
                <td>${e.voucherNumber || e.id.slice(-6)} ${e.receiptNumber ? `<br/><small>Ref: ${e.receiptNumber}</small>` : ''}</td>
                <td class="text-right bold">-${currency} ${e.amount.toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px;">
          <div>Prepared By: ___________________</div>
          <div>Audited & Approved By: ___________________</div>
        </div>

        <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 800); };</script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Wallet className="w-5 h-5" />
            </div>
            <span>Expense Reports & Audit</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track, audit, and reconcile cashier on-duty expenses and operational cash outlays
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrintReport}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Print Report</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-black shadow-lg shadow-amber-500/25 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-3 text-emerald-800 text-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Total Expenses ({dateFilter})</span>
            <Wallet className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {currency} {totalAmount.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {filteredExpenses.length} transactions recorded
          </div>
          <div className="absolute -right-3 -bottom-3 w-16 h-16 bg-amber-500/5 rounded-full pointer-events-none" />
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-bold uppercase tracking-wider">
            <span>Cash Drawer (Petty Cash)</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            {currency} {cashDrawerTotal.toLocaleString()}
          </div>
          <div className="text-xs text-emerald-600 mt-1">
            Deducted from register drawers
          </div>
          <div className="absolute -right-3 -bottom-3 w-16 h-16 bg-emerald-500/5 rounded-full pointer-events-none" />
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-blue-700 text-xs font-bold uppercase tracking-wider">
            <span>M-Pesa / Till Outlays</span>
            <Smartphone className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700 mt-2">
            {currency} {mpesaTotal.toLocaleString()}
          </div>
          <div className="text-xs text-blue-600 mt-1">
            Direct digital payments
          </div>
          <div className="absolute -right-3 -bottom-3 w-16 h-16 bg-blue-500/5 rounded-full pointer-events-none" />
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Average Expense Size</span>
            <Tag className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {currency} {avgExpense.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Across {filteredExpenses.length} records
          </div>
          <div className="absolute -right-3 -bottom-3 w-16 h-16 bg-purple-500/5 rounded-full pointer-events-none" />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        {/* Date Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100">
          {[
            { id: 'all', label: 'All Dates' },
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7days', label: 'Last 7 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'custom', label: 'Custom Date' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDateFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                dateFilter === tab.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {dateFilter === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 outline-hidden focus:border-amber-500"
            />
          )}
        </div>

        {/* Dropdowns & Search */}
        <div className="flex flex-col md:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search explanation (what for), cashier name, voucher #, receipt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 outline-hidden"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Cashier Filter */}
            <select
              value={selectedCashier}
              onChange={(e) => setSelectedCashier(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:border-amber-500 outline-hidden"
            >
              <option value="all">All Cashiers</option>
              {cashiersList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:border-amber-500 outline-hidden"
            >
              <option value="all">All Categories</option>
              <option value="Ice & Garnishes">Ice & Garnishes</option>
              <option value="Bar Supplies">Bar Supplies</option>
              <option value="Cleaning & Sanitation">Cleaning & Sanitation</option>
              <option value="Kitchen Ingredients">Kitchen Ingredients</option>
              <option value="Transport & Errands">Transport & Errands</option>
              <option value="Casual Labor & Tips">Casual Labor & Tips</option>
              <option value="Repairs & Maintenance">Repairs & Maintenance</option>
              <option value="Utilities & Emergency">Utilities & Emergency</option>
              <option value="Other">Other</option>
            </select>

            {/* Source Filter */}
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:border-amber-500 outline-hidden"
            >
              <option value="all">All Sources</option>
              <option value="Cash Drawer">Cash Drawer</option>
              <option value="M-Pesa">M-Pesa</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <span>Expenses Audit Log</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {filteredExpenses.length} entries
            </span>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <div className="text-base font-bold text-slate-800">No expenses found for this criteria</div>
            <p className="text-xs text-slate-500 mt-1">Try changing date filters, search terms, or record a new expense.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">Date & Time</th>
                  <th className="px-6 py-3.5">Cashier</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5">Explain What For (Reason)</th>
                  <th className="px-6 py-3.5">Source</th>
                  <th className="px-6 py-3.5">Voucher / Ref</th>
                  <th className="px-6 py-3.5 text-right">Amount</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                      <div className="font-bold text-slate-700">{exp.date}</div>
                      <div className="font-mono text-slate-400">{exp.time}</div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold text-slate-900">{exp.cashierName}</span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-100/70 text-amber-900 border border-amber-200">
                        {exp.category}
                      </span>
                    </td>

                    <td className="px-6 py-4 max-w-sm">
                      <div className="font-semibold text-slate-900 leading-snug">
                        {exp.reason}
                      </div>
                      {exp.notes && (
                        <div className="text-xs text-slate-500 italic mt-0.5">
                          Note: {exp.notes}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold ${
                        exp.paymentSource === 'Cash Drawer'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                          : exp.paymentSource === 'M-Pesa'
                          ? 'bg-blue-100 text-blue-900 border border-blue-200'
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        {exp.paymentSource}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                      <div className="font-mono font-bold text-slate-700">{exp.voucherNumber || exp.id.slice(-6)}</div>
                      {exp.receiptNumber && (
                        <div className="text-[11px] text-slate-400">Ref: {exp.receiptNumber}</div>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-base font-black text-rose-600">
                        -{currency} {exp.amount.toLocaleString()}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleDeleteExpense(exp)}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                        title="Void Expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Expense Modal */}
      <RecordExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={user}
        businessConfig={businessConfig}
        onExpenseRecorded={() => {
          setSuccessMessage('Expense successfully recorded and logged.');
          setTimeout(() => setSuccessMessage(''), 3000);
        }}
      />
    </div>
  );
}
