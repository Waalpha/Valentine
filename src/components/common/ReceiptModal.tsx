import React from 'react';
import { Sale, BusinessConfig } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { Printer, X, CheckCircle2 } from 'lucide-react';

interface ReceiptModalProps {
  sale: Sale;
  businessConfig?: BusinessConfig | null;
  onClose: () => void;
}

export function ReceiptModal({ sale, businessConfig, onClose }: ReceiptModalProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all">
        {/* Header Actions */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center space-x-2 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
            <span className="font-semibold text-gray-900">Sale Recorded Successfully</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Receipt Content */}
        <div id="receipt-printable" className="my-6 space-y-4 font-mono text-sm text-gray-800">
          <div className="text-center">
            <h2 className="text-lg font-bold uppercase tracking-wide text-gray-900">
              {businessConfig?.name || 'Club Valentine'}
            </h2>
            <p className="text-xs text-gray-500">{businessConfig?.address || 'Nairobi CBD'}</p>
            <p className="text-xs text-gray-500">Tel: {businessConfig?.phone || '+254 712 345 678'}</p>
          </div>

          <div className="border-t border-dashed border-gray-300 pt-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span>Receipt #:</span>
              <span className="font-semibold">{sale.id.slice(-8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{sale.date} {sale.time}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>{sale.cashierName}</span>
            </div>
            <div className="flex justify-between">
              <span>Payment:</span>
              <span className="font-semibold text-emerald-700">{sale.paymentMethod}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 pt-3">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 pb-1 text-gray-500">
                  <th className="pb-1">Item</th>
                  <th className="text-center pb-1">Qty</th>
                  <th className="text-right pb-1">Price</th>
                  <th className="text-right pb-1">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sale.items.map((item, idx) => (
                  <tr key={idx} className="py-1">
                    <td className="py-1.5 pr-2 font-sans font-medium text-gray-900">{item.productName}</td>
                    <td className="py-1.5 text-center">{item.quantity}</td>
                    <td className="py-1.5 text-right">{item.unitPrice}</td>
                    <td className="py-1.5 text-right font-semibold">{item.totalAmount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-dashed border-gray-300 pt-3 space-y-1 font-sans">
            <div className="flex justify-between text-base font-bold text-gray-900">
              <span>TOTAL:</span>
              <span>{formatCurrency(sale.totalAmount, businessConfig?.currency || 'KSh')}</span>
            </div>
            {sale.amountTendered !== undefined && sale.amountTendered > 0 && (
              <div className="flex justify-between text-xs text-gray-600 pt-1">
                <span>Amount Paid:</span>
                <span>{formatCurrency(sale.amountTendered, businessConfig?.currency || 'KSh')}</span>
              </div>
            )}
            {sale.change !== undefined && sale.change > 0 && (
              <div className="flex justify-between text-xs font-semibold text-emerald-700">
                <span>Change Returned:</span>
                <span>{formatCurrency(sale.change, businessConfig?.currency || 'KSh')}</span>
              </div>
            )}
            {sale.referenceCode && (
              <div className="flex justify-between text-xs text-gray-500 pt-1">
                <span>Ref / M-Pesa Code:</span>
                <span className="font-mono">{sale.referenceCode}</span>
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-gray-300 pt-4 text-center text-xs text-gray-500">
            <p>{businessConfig?.receiptFooter || 'Thank you! Please drink responsibly.'}</p>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="flex space-x-3 pt-2">
          <button
            onClick={handlePrint}
            className="flex flex-1 items-center justify-center space-x-2 rounded-xl bg-gray-900 py-3 text-sm font-medium text-white shadow-md hover:bg-gray-800 transition-all"
          >
            <Printer className="h-4 w-4" />
            <span>Print Receipt</span>
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
