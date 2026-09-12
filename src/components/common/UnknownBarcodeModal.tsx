import React from 'react';
import { AlertTriangle, Plus, Search, X } from 'lucide-react';

interface UnknownBarcodeModalProps {
  isOpen: boolean;
  barcode: string;
  onClose: () => void;
  onAddNewProduct: (barcode: string) => void;
  onSearchProduct: (barcode: string) => void;
}

export const UnknownBarcodeModal: React.FC<UnknownBarcodeModalProps> = ({
  isOpen,
  barcode,
  onClose,
  onAddNewProduct,
  onSearchProduct
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl p-6 text-white space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Product Not Found</h3>
              <p className="text-xs text-slate-400">Barcode not recognized in this tenant's inventory</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanned Barcode Card */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center space-y-1 text-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Scanned Barcode
          </span>
          <span className="text-xl font-mono font-black text-amber-400 tracking-wider">
            {barcode}
          </span>
          <span className="text-[11px] text-slate-500">
            No active product in your catalog matches this code
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={() => {
              onClose();
              onAddNewProduct(barcode);
            }}
            className="w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wide shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product With This Barcode</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onSearchProduct(barcode);
            }}
            className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wide border border-slate-700 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Search className="w-4 h-4 text-slate-400" />
            <span>Search Catalog by Name / SKU</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-2xl text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel (ESC)
          </button>
        </div>
      </div>
    </div>
  );
};
