import React, { useState } from 'react';
import { UserProfile, BusinessConfig, ExpenseCategory, ExpensePaymentSource, ExpenseRecord } from '../../types';
import { recordExpense, QUICK_EXPENSE_TEMPLATES } from '../../lib/expenseService';
import { formatCurrency } from '../../lib/utils';
import { 
  X, 
  DollarSign, 
  Receipt, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Sparkles, 
  Wallet, 
  Smartphone, 
  CreditCard,
  Tag,
  HelpCircle,
  Check
} from 'lucide-react';

interface RecordExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
  onExpenseRecorded?: (expense: ExpenseRecord) => void;
}

const CATEGORIES: { label: ExpenseCategory; icon: string; desc: string }[] = [
  { label: 'Ice & Garnishes', icon: '🧊', desc: 'Ice bags, lemons, limes, mint leaves' },
  { label: 'Bar Supplies', icon: '🍹', desc: 'Straws, napkins, coasters, mixers' },
  { label: 'Cleaning & Sanitation', icon: '🧼', desc: 'Detergent, cloths, mops, trash bags' },
  { label: 'Transport & Errands', icon: '🛵', desc: 'Boda-boda, courier to bank for change float' },
  { label: 'Kitchen Ingredients', icon: '🍳', desc: 'Urgent cooking gas, emergency groceries' },
  { label: 'Casual Labor & Tips', icon: '👥', desc: 'Extra glass collectors, barback shift tip' },
  { label: 'Repairs & Maintenance', icon: '🔧', desc: 'Plumbing fittings, bulbs, electrical repairs' },
  { label: 'Utilities & Emergency', icon: '⚡', desc: 'Generator fuel, emergency power' },
  { label: 'Other', icon: '📋', desc: 'General miscellaneous petty expense' }
];

export function RecordExpenseModal({
  isOpen,
  onClose,
  user,
  businessConfig,
  onExpenseRecorded
}: RecordExpenseModalProps) {
  if (!isOpen) return null;

  const currency = businessConfig?.currency || 'KSh';

  const [amount, setAmount] = useState<string>('');
  const [paymentSource, setPaymentSource] = useState<ExpensePaymentSource>('Cash Drawer');
  const [category, setCategory] = useState<ExpenseCategory>('Ice & Garnishes');
  const [reason, setReason] = useState<string>('');
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [lastRecorded, setLastRecorded] = useState<ExpenseRecord | null>(null);

  const quickAmounts = [100, 200, 500, 1000, 1500, 2000, 3000, 5000];

  const handleApplyQuickTemplate = (tpl: typeof QUICK_EXPENSE_TEMPLATES[0]) => {
    setCategory(tpl.category);
    setReason(tpl.reason);
    setPaymentSource(tpl.paymentSource);
    setError('');
  };

  const handlePrintVoucher = (exp: ExpenseRecord) => {
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) {
      // Fallback: trigger standard browser print dialog
      window.print();
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Expense Voucher - ${exp.voucherNumber || exp.id}</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 13px;
            line-height: 1.35;
            color: #000;
            padding: 8px;
            width: 72mm;
            margin: 0 auto;
          }
          .text-center { text-align: center; }
          .bold { font-weight: bold; }
          .title { font-size: 16px; font-weight: bold; letter-spacing: 1px; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .double-divider { border-top: 2px solid #000; margin: 8px 0; }
          .amount-box {
            font-size: 18px;
            font-weight: bold;
            padding: 6px;
            border: 1px solid #000;
            text-align: center;
            margin: 8px 0;
          }
          .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .label { font-weight: bold; }
          .sign-area { margin-top: 20px; }
          .sign-line { border-bottom: 1px solid #000; height: 25px; margin-bottom: 4px; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="title">${businessConfig?.name || 'CLUB PAXX'}</div>
          <div>${businessConfig?.location || 'BAR & RESTAURANT'}</div>
          <div class="bold" style="margin-top: 4px;">*** CASHIER EXPENSE VOUCHER ***</div>
        </div>

        <div class="double-divider"></div>

        <div class="row">
          <span>Voucher #:</span>
          <span class="bold">${exp.voucherNumber || exp.id.slice(-8)}</span>
        </div>
        <div class="row">
          <span>Date:</span>
          <span>${exp.date} ${exp.time}</span>
        </div>
        <div class="row">
          <span>Cashier:</span>
          <span class="bold">${exp.cashierName}</span>
        </div>
        <div class="row">
          <span>Payment Source:</span>
          <span class="bold">${exp.paymentSource.toUpperCase()}</span>
        </div>
        <div class="row">
          <span>Category:</span>
          <span>${exp.category}</span>
        </div>
        ${exp.receiptNumber ? `
        <div class="row">
          <span>Receipt / Ref #:</span>
          <span>${exp.receiptNumber}</span>
        </div>` : ''}

        <div class="amount-box">
          PAID OUT: ${currency} ${exp.amount.toLocaleString()}
        </div>

        <div class="divider"></div>

        <div class="bold">EXPLANATION ("WHAT FOR"):</div>
        <div style="margin-top: 4px; padding: 4px; background: #eee; font-style: italic;">
          ${exp.reason}
        </div>

        ${exp.notes ? `
        <div style="margin-top: 6px;">
          <span class="bold">Notes:</span> ${exp.notes}
        </div>` : ''}

        <div class="divider"></div>

        <div class="sign-area">
          <div class="row">
            <div style="width: 48%;">
              <div class="sign-line"></div>
              <div class="text-center" style="font-size: 11px;">Authorizer Signature</div>
            </div>
            <div style="width: 48%;">
              <div class="sign-line"></div>
              <div class="text-center" style="font-size: 11px;">Cashier Signature</div>
            </div>
          </div>
        </div>

        <div class="double-divider"></div>
        <div class="text-center" style="font-size: 11px;">
          * KEEP THIS VOUCHER IN CASH DRAWER FOR TILL RECONCILIATION *
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 800);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleSubmit = async (andPrint: boolean = false) => {
    setError('');
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid expense amount greater than 0.');
      return;
    }

    if (!reason.trim()) {
      setError('Please explain what this expense was for. A clear explanation is required.');
      return;
    }

    setLoading(true);
    try {
      const recorded = await recordExpense({
        amount: numAmount,
        category,
        reason: reason.trim(),
        paymentSource,
        receiptNumber: receiptNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        user,
        tenantId: user.businessId
      });

      setLastRecorded(recorded);
      if (onExpenseRecorded) {
        onExpenseRecorded(recorded);
      }

      if (andPrint) {
        handlePrintVoucher(recorded);
      }

      // Reset form state after brief success notice
      setTimeout(() => {
        setAmount('');
        setReason('');
        setReceiptNumber('');
        setNotes('');
        setLastRecorded(null);
        onClose();
      }, andPrint ? 1000 : 600);
    } catch (err: any) {
      setError(err?.message || 'Failed to record expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-expense-title"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 id="record-expense-title" className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Record Cashier Expense</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  On Duty
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Logged by: <strong className="text-amber-300">{user.name}</strong> • Record operational & petty cash outlays
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 flex-1">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start space-x-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          {lastRecorded && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-sm animate-in fade-in">
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  Recorded <strong>{currency} {lastRecorded.amount.toLocaleString()}</strong> for{' '}
                  <em>"{lastRecorded.reason}"</em>
                </span>
              </div>
              <button
                onClick={() => handlePrintVoucher(lastRecorded)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Voucher</span>
              </button>
            </div>
          )}

          {/* Amount and Payment Source Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Expense Amount ({currency}) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                  {currency}
                </div>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-14 pr-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 text-xl font-black text-slate-900 placeholder:text-slate-300 outline-hidden transition-all"
                  autoFocus
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {quickAmounts.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(String(q))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      amount === String(q)
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    +{q.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Source */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Paid Out From <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentSource('Cash Drawer')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                    paymentSource === 'Cash Drawer'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-600/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  <Wallet className={`w-5 h-5 mb-1 ${paymentSource === 'Cash Drawer' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold leading-tight">Cash Drawer</div>
                    <div className="text-[10px] text-slate-500 leading-tight">Petty float</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentSource('M-Pesa')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                    paymentSource === 'M-Pesa'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-600/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  <Smartphone className={`w-5 h-5 mb-1 ${paymentSource === 'M-Pesa' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold leading-tight">M-Pesa</div>
                    <div className="text-[10px] text-slate-500 leading-tight">Paybill/Till</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentSource('Other')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                    paymentSource === 'Other'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-600/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  <CreditCard className={`w-5 h-5 mb-1 ${paymentSource === 'Other' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold leading-tight">Other</div>
                    <div className="text-[10px] text-slate-500 leading-tight">Bank/Direct</div>
                  </div>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 italic">
                {paymentSource === 'Cash Drawer'
                  ? '⚠️ Will automatically deduct from Cash Drawer physical count during Daily Shift Closing.'
                  : 'Does not deduct from physical cash drawer count.'}
              </p>
            </div>
          </div>

          {/* Expense Category */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
              <span>Category <span className="text-red-500">*</span></span>
              <span className="text-[11px] text-slate-400 lowercase font-normal">select closest match</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((c) => {
                const isSelected = category === c.label;
                return (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => setCategory(c.label)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center space-x-2.5 ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/80 text-amber-950 font-bold ring-2 ring-amber-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/60 text-slate-700'
                    }`}
                  >
                    <span className="text-lg">{c.icon}</span>
                    <span className="text-xs truncate">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* The Mandated "Explain What For" Reason Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>Explain What For (Mandatory Reason)</span>
                <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] font-semibold text-slate-400">
                {reason.length > 0 ? `${reason.length} chars` : 'required'}
              </span>
            </div>

            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain clearly what this money was spent on (e.g. 'Bought 2 blocks of ice for cocktail bar station because the ice maker is defrosting')..."
              className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-hidden transition-all resize-none"
            />

            {/* Quick Helper Suggestions / Templates */}
            <div className="mt-2">
              <div className="text-[11px] font-bold text-slate-500 flex items-center space-x-1 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Quick templates (tap to apply):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_EXPENSE_TEMPLATES.slice(0, 6).map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyQuickTemplate(tpl)}
                    className="text-[11px] bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200 transition-all text-left"
                  >
                    + {tpl.reason.length > 36 ? tpl.reason.slice(0, 36) + '...' : tpl.reason}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Optional Receipt Reference & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Receipt / Merchant Reference (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Receipt #1042 or M-Pesa Code"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Additional Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Approved by Manager Peter"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-500 outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            Voucher automatically logs into shift audit trail and drawer records.
          </div>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-semibold transition-all"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
              title="Save expense and open thermal print chit for the cash drawer"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Record & Print Voucher</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(false)}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-black shadow-md shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <span>Recording...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Expense</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
