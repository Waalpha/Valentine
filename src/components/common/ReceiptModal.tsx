import React from 'react';
import { Sale, BusinessConfig } from '../../types';
import { X, CheckCircle2, Printer } from 'lucide-react';
import { ThermalReceipt } from './ThermalReceipt';
import { triggerThermalPrint } from '../../lib/thermalPrint';

interface ReceiptModalProps {
  sale: Sale;
  businessConfig?: BusinessConfig | null;
  onClose: () => void;
}

export function ReceiptModal({ sale, businessConfig, onClose }: ReceiptModalProps) {
  const handlePrint = () => {
    triggerThermalPrint();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all max-h-[90vh] overflow-y-auto">
        {/* Header Actions */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
          <div className="flex items-center space-x-2 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
            <span className="font-semibold text-gray-900">Sale Recorded Successfully</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Thermal Receipt Preview */}
        <div className="flex justify-center my-4">
          <ThermalReceipt sale={sale} businessConfig={businessConfig} />
        </div>

        {/* Modal Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-100">
          <button
            onClick={handlePrint}
            className="flex flex-1 items-center justify-center space-x-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-bold text-white shadow-md transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Print 58mm Thermal Receipt</span>
          </button>

          <button
            onClick={onClose}
            className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
