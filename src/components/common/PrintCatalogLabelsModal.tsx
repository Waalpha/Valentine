import React, { useState } from 'react';
import { Product, BusinessConfig } from '../../types';
import { BarcodeSvg } from './BarcodeSvg';
import { formatCurrency } from '../../lib/utils';
import { X, Printer, Search, CheckSquare, Square, Filter } from 'lucide-react';

interface PrintCatalogLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  businessConfig?: BusinessConfig | null;
}

export const PrintCatalogLabelsModal: React.FC<PrintCatalogLabelsModalProps> = ({
  isOpen,
  onClose,
  products,
  businessConfig
}) => {
  // Only products with barcodes can be printed
  const validProducts = products.filter(p => p.barcode && String(p.barcode).trim());
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    () => new Set(validProducts.map(p => p.id))
  );
  const [copiesPerProduct, setCopiesPerProduct] = useState<number>(1);
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showBusinessName, setShowBusinessName] = useState<boolean>(true);
  const [labelSize, setLabelSize] = useState<'standard' | 'compact' | 'jewelry'>('standard');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const currency = businessConfig?.currency || 'KSh';
  const businessName = businessConfig?.name || 'Davetech ERP';

  const toggleSelectAll = () => {
    if (selectedProductIds.size === validProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(validProducts.map(p => p.id)));
    }
  };

  const toggleSelectProduct = (id: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProductIds(next);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filtered items to display
  const displayItems = validProducts.filter(p => {
    if (!selectedProductIds.has(p.id)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      p.categoryName?.toLowerCase().includes(q) ||
      String(p.barcode || '').toLowerCase().includes(q)
    );
  });

  // Flat list multiplied by copies
  const totalLabelsToPrint = displayItems.length * copiesPerProduct;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto border border-gray-200 print:border-none print:shadow-none print:rounded-none print:m-0 print:p-0">
        
        {/* Header - Screen only */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-md">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Print Catalog Barcode Labels</h3>
              <p className="text-xs text-slate-300">
                Print barcode sheets or thermal stickers for your products ({selectedProductIds.size} of {validProducts.length} selected)
              </p>
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
        <div className="p-5 border-b border-gray-200 bg-gray-50 space-y-4 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Copies per Product:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={copiesPerProduct}
                  onChange={(e) => setCopiesPerProduct(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-bold text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <div className="flex space-x-1">
                  {[1, 2, 5].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCopiesPerProduct(preset)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        copiesPerProduct === preset
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
                Label Style:
              </label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-medium text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="standard">Standard Sticker (50mm × 30mm)</option>
                <option value="compact">Compact Shelf Tag (40mm × 25mm)</option>
                <option value="jewelry">Small Label (30mm × 20mm)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Display Attributes:
              </label>
              <div className="flex items-center space-x-4 pt-2">
                <label className="flex items-center space-x-2 text-xs text-gray-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Show Selling Price</span>
                </label>
                <label className="flex items-center space-x-2 text-xs text-gray-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBusinessName}
                    onChange={(e) => setShowBusinessName(e.target.checked)}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Show Business Name</span>
                </label>
              </div>
            </div>
          </div>

          {/* Quick Selection Toolbar */}
          <div className="pt-2 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-amber-700 hover:text-amber-800"
              >
                {selectedProductIds.size === validProducts.length ? (
                  <CheckSquare className="w-4 h-4 text-amber-600" />
                ) : (
                  <Square className="w-4 h-4 text-gray-400" />
                )}
                <span>
                  {selectedProductIds.size === validProducts.length ? 'Deselect All' : 'Select All Products'}
                </span>
              </button>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-500">
                Printing <strong>{totalLabelsToPrint}</strong> label{totalLabelsToPrint === 1 ? '' : 's'} ({displayItems.length} unique products)
              </span>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter products..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Labels Sheet Preview & Printable Canvas */}
        <div className="p-6 overflow-y-auto max-h-[55vh] bg-gray-100 print:bg-white print:p-0 print:max-h-none">
          {displayItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="font-bold text-sm">No products selected to print</p>
              <p className="text-xs text-gray-400 mt-1">Select one or more products above to generate barcode labels</p>
            </div>
          ) : (
            <div
              id="printable-catalog-barcode-labels"
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-3 print:gap-2 print:p-2"
            >
              {displayItems.map((prod) => {
                const barcodeStr = String(prod.barcode).trim();
                const countArr = Array.from({ length: copiesPerProduct });

                return countArr.map((_, copyIdx) => (
                  <div
                    key={`${prod.id}-copy-${copyIdx}`}
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

                    <span className="text-[11px] font-bold text-gray-900 leading-tight line-clamp-1 mt-0.5" title={prod.name}>
                      {prod.name}
                    </span>

                    {/* Barcode */}
                    <div className="my-1 flex justify-center w-full">
                      <BarcodeSvg
                        value={barcodeStr}
                        format={barcodeStr.length === 13 ? 'EAN13' : 'CODE128'}
                        width={labelSize === 'jewelry' ? 1.1 : 1.35}
                        height={labelSize === 'jewelry' ? 24 : labelSize === 'compact' ? 30 : 36}
                        fontSize={labelSize === 'jewelry' ? 8 : 9}
                        displayValue={true}
                      />
                    </div>

                    {showPrice && (
                      <div className="mt-0.5 font-black text-xs text-gray-900">
                        <span className="text-[10px] font-bold text-gray-500 mr-0.5">{currency}</span>
                        <span className="text-sm">{prod.sellingPrice.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                ));
              })}
            </div>
          )}
        </div>

        {/* Footer - Screen only */}
        <div className="p-4 border-t border-gray-100 bg-white flex items-center justify-between print:hidden">
          <p className="text-xs text-gray-500">
            Compatible with standard A4 sticker paper and thermal label rolls.
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
              disabled={displayItems.length === 0}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print {totalLabelsToPrint} Labels</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
