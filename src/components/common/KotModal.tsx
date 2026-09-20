import React, { useState } from 'react';
import { RestaurantOrder, BusinessConfig } from '../../types';
import { X, CheckCircle2, Printer, AlertCircle, Wine } from 'lucide-react';
import { ThermalKot } from '../../printer/ThermalKot';
import { thermalPrinterService } from '../../printer/ThermalPrinterService';
import { recordKotPrinted } from '../../lib/orderService';

interface KotModalProps {
  order: RestaurantOrder;
  businessConfig?: BusinessConfig | null;
  onClose: () => void;
  onSentToCashier?: () => void;
  isNewSubmission?: boolean;
}

export function KotModal({
  order,
  businessConfig,
  onClose,
  onSentToCashier,
  isNewSubmission = false
}: KotModalProps) {
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleThermalPrint = async () => {
    setPrinting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const state = thermalPrinterService.getState();
      if (state.status !== 'connected') {
        await thermalPrinterService.connect();
      }
      await thermalPrinterService.printKot(order, businessConfig);
      await recordKotPrinted(order.id, order.businessId);
      setSuccessMsg('Bar order ticket printed successfully via thermal printer!');
    } catch (err: any) {
      console.warn('Direct thermal print failed, falling back to browser print:', err);
      try {
        window.print();
        await recordKotPrinted(order.id, order.businessId);
        setSuccessMsg('Opened browser print dialog.');
      } catch (printErr: any) {
        setError(printErr.message || err.message || 'Printing failed');
      }
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all max-h-[90vh] overflow-y-auto">
        {/* Header Actions */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
          <div className="flex items-center space-x-2 text-amber-600">
            <Wine className="h-6 w-6" />
            <div>
              <h3 className="font-bold text-gray-900 leading-tight">
                {isNewSubmission ? 'Order Submitted to Cashier' : 'Bar Order Ticket (BOT)'}
              </h3>
              <p className="text-xs text-gray-500">Order #{order.orderNumber} • {order.tableName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isNewSubmission && (
          <div className="mb-4 flex items-center space-x-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <p className="font-bold">Sent to Cashier POS Successfully!</p>
              <p className="text-[11px] text-emerald-700">Cashier can now see and process this order for payment.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center space-x-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
            {successMsg}
          </div>
        )}

        {/* Bar Ticket Preview Card */}
        <div className="flex justify-center my-3 bg-gray-50 py-3 rounded-xl border border-dashed border-gray-200">
          <ThermalKot order={order} businessConfig={businessConfig} />
        </div>

        {/* Modal Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-100">
          <button
            onClick={handleThermalPrint}
            disabled={printing}
            className="flex flex-1 items-center justify-center space-x-2 rounded-xl bg-amber-600 hover:bg-amber-700 py-3 text-sm font-bold text-white shadow-md transition-all cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <Printer className="h-4 w-4" />
            <span>{printing ? 'Printing Bar Ticket...' : 'Print Bar Ticket (BOT)'}</span>
          </button>

          <button
            onClick={() => {
              if (onSentToCashier) onSentToCashier();
              onClose();
            }}
            className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>

        {/* Modal Footer Branding */}
        <div className="pt-3 text-center">
          <p className="text-[11px] text-gray-400 font-medium">
            Bar Ticket Engine Powered by <strong className="text-gray-700 font-bold">Davetech Solutions</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
