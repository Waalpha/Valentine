import React, { useState } from 'react';
import { Product, BusinessConfig } from '../../types';
import { BarcodeSvg } from './BarcodeSvg';
import { formatCurrency } from '../../lib/utils';
import { X, Printer, Settings, CheckCircle2, Copy } from 'lucide-react';

interface PrintBarcodeLabelModalProps {
  product: Product;
  businessConfig?: BusinessConfig | null;
  onClose: () => void;
}

export const PrintBarcodeLabelModal: React.FC<PrintBarcodeLabelModalProps> = ({
  product,
  businessConfig,
  onClose
}) => {
  const [copies, setCopies] = useState<number>(4);
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showBusinessName, setShowBusinessName] = useState<boolean>(true);
  const [labelSize, setLabelSize] = useState<'standard' | 'compact' | 'jewelry'>('standard');

  const currency = businessConfig?.currency || 'KSh';
  const businessName = businessConfig?.name || 'Davetech ERP';
  const barcodeValue = product.barcode != null && String(product.barcode).trim()
    ? String(product.barcode).trim()
    : `28${product.id.replace(/\D/g, '').slice(-8) || '10000001'}`;

  const handlePrint = () => {
    window.print();
  };

  // Generate copies array
  const labelList = Array.from({ length: Math.max(1, Math.min(copies, 100)) });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto border border-gray-200">
        {/* Header - Screen only */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Print Barcode Labels</h3>
              <p className="text-xs text-slate-300">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls - Screen only */}
        <div className="p-5 border-b border-gray-100 bg-gray-50 space-y-4 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Number of Copies:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-bold text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <div className="flex space-x-1">
                  {[1, 4, 10, 20].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCopies(preset)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        copies === preset
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Display Options:
              </label>
              <div className="flex flex-col space-y-1.5 pt-1">
                <label className="flex items-center space-x-2 text-xs text-gray-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Show Selling Price ({formatCurrency(product.sellingPrice, currency)})</span>
                </label>
                <label className="flex items-center space-x-2 text-xs text-gray-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBusinessName}
                    onChange={(e) => setShowBusinessName(e.target.checked)}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Show Store Name</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Label Style:
              </label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-medium text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="standard">Standard Sticker (50mm × 30mm)</option>
                <option value="compact">Compact Shelf Tag (40mm × 25mm)</option>
                <option value="jewelry">Small Barcode (30mm × 20mm)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Labels Preview and Printable Canvas */}
        <div className="p-6 overflow-y-auto max-h-[50vh] bg-gray-100 print:bg-white print:p-0 print:max-h-none">
          <div className="text-xs text-gray-400 font-semibold mb-3 print:hidden flex items-center justify-between">
            <span>Print Preview ({copies} label{copies === 1 ? '' : 's'})</span>
            <span className="text-[11px] text-gray-500 font-mono">Barcode: {barcodeValue}</span>
          </div>

          <div
            id="printable-barcode-labels-grid"
            className="grid grid-cols-2 sm:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2 print:p-2"
          >
            {labelList.map((_, idx) => (
              <div
                key={idx}
                className="bg-white p-3 rounded-xl border border-gray-300 shadow-xs flex flex-col items-center justify-between text-center print:border-gray-400 print:shadow-none print:break-inside-avoid print:p-2"
                style={{
                  minHeight: labelSize === 'compact' ? '95px' : labelSize === 'jewelry' ? '80px' : '115px'
                }}
              >
                {showBusinessName && (
                  <span className="text-[9px] uppercase font-black tracking-wider text-gray-500 leading-tight block truncate max-w-full">
                    {businessName}
                  </span>
                )}
                <span className="text-[11px] font-bold text-gray-900 leading-tight line-clamp-1 mt-0.5">
                  {product.name}
                </span>

                {/* The Barcode itself */}
                <div className="my-1 flex justify-center w-full">
                  <BarcodeSvg
                    value={barcodeValue}
                    format="CODE128"
                    width={labelSize === 'jewelry' ? 1.2 : 1.5}
                    height={labelSize === 'jewelry' ? 26 : labelSize === 'compact' ? 32 : 38}
                    fontSize={labelSize === 'jewelry' ? 9 : 10}
                    displayValue={true}
                  />
                </div>

                {showPrice && (
                  <div className="mt-0.5 font-black text-xs text-gray-900">
                    <span className="text-[10px] font-bold text-gray-500 mr-0.5">{currency}</span>
                    <span className="text-sm">{product.sellingPrice.toLocaleString()}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer - Screen only */}
        <div className="p-4 border-t border-gray-100 bg-white flex items-center justify-between print:hidden">
          <p className="text-xs text-gray-500">
            Uses standard thermal sticker or A4 label paper.
          </p>
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-50 cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print {copies} Label{copies === 1 ? '' : 's'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
