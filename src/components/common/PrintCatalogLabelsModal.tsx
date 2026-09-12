import React, { useState, useRef } from 'react';
import { Product, BusinessConfig } from '../../types';
import { BarcodeSvg } from './BarcodeSvg';
import { formatCurrency } from '../../lib/utils';
import { X, Printer, Search, CheckSquare, Square, Filter, Layers, ScrollText } from 'lucide-react';
import { printBarcodeContainer } from '../../lib/barcodePrintService';

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
  const [layout, setLayout] = useState<'sheet' | 'roll58' | 'roll80'>('sheet');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  const printContainerRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const currency = businessConfig?.currency || 'KSh';
  const businessName = businessConfig?.name || 'Club Valentine Bar POS';

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

  const handlePrint = async () => {
    if (!printContainerRef.current) {
      window.print();
      return;
    }
    setIsPrinting(true);
    try {
      await printBarcodeContainer(printContainerRef.current, {
        title: `Catalog Barcode Labels (${displayItems.length} Products)`,
        layout,
        labelSize,
        columns: layout === 'sheet' ? 3 : 1
      });
    } catch (err) {
      console.warn('Iframe print error, attempting direct window.print:', err);
      window.print();
    } finally {
      setIsPrinting(false);
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto border border-gray-200 print:border-none print:shadow-none print:rounded-none print:m-0 print:p-0">
        
        {/* Header - Screen only */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-md">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Print Catalog Barcode Labels
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 font-semibold border border-amber-500/30">
                  {validProducts.length} Items Available
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Batch print barcodes for your entire product catalog or selected items
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
          {/* Printer / Paper Type Segmented Tabs */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
              Printer Paper Format:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setLayout('sheet')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  layout === 'sheet'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-black'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>A4 Sticker Sheet</span>
              </button>
              <button
                type="button"
                onClick={() => setLayout('roll58')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  layout === 'roll58'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-black'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <ScrollText className="w-3.5 h-3.5" />
                <span>58mm Roll</span>
              </button>
              <button
                type="button"
                onClick={() => setLayout('roll80')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  layout === 'roll80'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-black'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <ScrollText className="w-3.5 h-3.5" />
                <span>80mm Roll</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Copies per item */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Copies Per Product:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={copiesPerProduct}
                  onChange={(e) => setCopiesPerProduct(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-bold text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <div className="flex space-x-1">
                  {[1, 2, 4].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCopiesPerProduct(preset)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        copiesPerProduct === preset
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {preset}×
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Display Options */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Display Details:
              </label>
              <div className="flex flex-col space-y-1.5 pt-1">
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
                  <span>Show Store Name</span>
                </label>
              </div>
            </div>

            {/* Label Size */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Label Format:
              </label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-medium text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="standard">Standard Sticker (50mm × 30mm)</option>
                <option value="compact">Compact Shelf Tag (40mm × 25mm)</option>
                <option value="jewelry">Small Barcode (30mm × 20mm)</option>
              </select>
            </div>
          </div>

          {/* Product Selection Controls */}
          <div className="pt-2 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="px-3 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-xs font-bold text-gray-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
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
              <span className="text-xs text-gray-600">
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
              ref={printContainerRef}
              id="printable-catalog-barcode-labels"
              className={`printable-barcode-area ${
                layout === 'sheet'
                  ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-3 print:gap-2 print:p-2'
                  : 'flex flex-col items-center gap-3 max-w-[58mm] mx-auto'
              }`}
            >
              {displayItems.map((prod) => {
                const barcodeStr = String(prod.barcode).trim();
                const countArr = Array.from({ length: copiesPerProduct });

                return countArr.map((_, copyIdx) => (
                  <div
                    key={`${prod.id}-copy-${copyIdx}`}
                    className="barcode-label-card bg-white p-3 rounded-xl border border-gray-300 shadow-xs flex flex-col items-center justify-between text-center print:border-gray-500 print:shadow-none print:break-inside-avoid print:p-2 w-full"
                    style={{
                      minHeight: labelSize === 'compact' ? '95px' : labelSize === 'jewelry' ? '80px' : '115px',
                      maxWidth: layout !== 'sheet' ? '54mm' : undefined
                    }}
                  >
                    {showBusinessName && (
                      <span className="business-name text-[9px] uppercase font-black tracking-wider text-gray-600 leading-tight block truncate max-w-full">
                        {businessName}
                      </span>
                    )}

                    <span className="product-name text-[11px] font-bold text-gray-900 leading-tight line-clamp-1 mt-0.5" title={prod.name}>
                      {prod.name}
                    </span>

                    {/* Barcode */}
                    <div className="barcode-wrapper my-1 flex justify-center w-full">
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
                      <div className="price-tag mt-0.5 font-black text-xs text-gray-900">
                        <span className="curr text-[10px] font-bold text-gray-500 mr-0.5">{currency}</span>
                        <span>{prod.sellingPrice.toLocaleString()}</span>
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
            Compatible with standard A4 sticker paper, laser/inkjet, and thermal roll label printers.
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
              disabled={displayItems.length === 0 || isPrinting}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Preparing Print...' : `Print ${totalLabelsToPrint} Labels`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
