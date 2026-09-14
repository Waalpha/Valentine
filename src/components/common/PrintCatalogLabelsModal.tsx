import React, { useState, useRef, useEffect } from 'react';
import { Product, BusinessConfig } from '../../types';
import { BarcodeSvg } from './BarcodeSvg';
import { formatCurrency } from '../../lib/utils';
import { 
  X, 
  Printer, 
  Search, 
  CheckSquare, 
  Square, 
  Filter, 
  Layers, 
  ScrollText, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Laptop,
  Cable,
  HelpCircle,
  Info
} from 'lucide-react';
import { printBarcodeDirectly, isAppInsideIframe } from '../../lib/barcodePrintService';
import { ThermalPrinterBar } from './ThermalPrinterBar';
import { thermalPrinterService } from '../../printer/ThermalPrinterService';
import { PrinterConnectionState } from '../../printer/printerTypes';

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
  const [printMethod, setPrintMethod] = useState<'system' | 'direct'>('system');
  const [copiesPerProduct, setCopiesPerProduct] = useState<number>(1);
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showBusinessName, setShowBusinessName] = useState<boolean>(true);
  const [labelSize, setLabelSize] = useState<'standard' | 'compact' | 'jewelry'>('standard');
  const [layout, setLayout] = useState<'roll58' | 'roll80' | 'sheet'>('roll58');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printerState, setPrinterState] = useState<PrinterConnectionState>(thermalPrinterService.getState());
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);
  const [printErrorMsg, setPrintErrorMsg] = useState<string | null>(null);
  const [showDriverHelp, setShowDriverHelp] = useState<boolean>(false);

  const printContainerRef = useRef<HTMLDivElement>(null);
  const isInIframe = isAppInsideIframe();

  useEffect(() => {
    const unsub = thermalPrinterService.subscribe((s) => {
      setPrinterState(s);
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const isThermalConnected = printerState.status === 'connected' && !!printerState.device;
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

  // 1. Browser System Print (Installed OS Driver)
  const handleSystemPrint = async () => {
    if (displayItems.length === 0) return;
    if (!printContainerRef.current) {
      window.print();
      return;
    }
    setIsPrinting(true);
    setPrintErrorMsg(null);
    setPrintSuccessMsg(null);
    setShowDriverHelp(false);

    try {
      await printBarcodeDirectly(printContainerRef.current, {
        title: `Catalog Barcode Labels (${displayItems.length} Products)`,
        layout,
        labelSize,
        columns: layout === 'sheet' ? 3 : 1
      });
      setPrintSuccessMsg(`Print dialog opened! Select your thermal printer to print ${totalLabelsToPrint} labels.`);
      setTimeout(() => setPrintSuccessMsg(null), 5000);
    } catch (err: any) {
      console.warn('In-DOM print error:', err);
      setPrintErrorMsg(err.message || 'Could not open print dialog.');
    } finally {
      setIsPrinting(false);
    }
  };

  // 2. Direct Hardware Thermal Print (WebUSB / Bluetooth)
  const handleDirectThermalPrint = async () => {
    if (displayItems.length === 0) return;
    setIsPrinting(true);
    setPrintErrorMsg(null);
    setPrintSuccessMsg(null);

    try {
      if (!isThermalConnected) {
        const auto = await thermalPrinterService.autoConnect();
        if (!auto) {
          const dev = await thermalPrinterService.requestDevice('usb');
          await thermalPrinterService.connect(dev);
        }
      }

      const itemsToPrint = displayItems.map(p => ({
        product: p,
        copies: copiesPerProduct
      }));

      await thermalPrinterService.printCatalogBarcodeLabels(itemsToPrint, {
        showPrice,
        showBusinessName,
        businessName,
        currency
      });

      const devName = thermalPrinterService.getState().device?.name || 'Thermal Printer';
      setPrintSuccessMsg(`Printed ${totalLabelsToPrint} barcode labels directly to ${devName}!`);
      setTimeout(() => setPrintSuccessMsg(null), 5000);
    } catch (err: any) {
      console.warn('Direct thermal print error:', err);
      if (err?.name !== 'NotFoundError') {
        setPrintErrorMsg(err.message || 'Direct thermal print failed.');
        setShowDriverHelp(true);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto border border-gray-200 print:border-none print:shadow-none print:rounded-none print:m-0 print:p-0">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-md">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Print Catalog Barcode Labels
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 font-semibold border border-amber-500/30">
                  {totalLabelsToPrint} labels ready
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Bulk print barcodes for inventory labeling, shelf tags, or product packaging
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

        {/* Printing Method Switcher Banner */}
        <div className="bg-slate-950 p-4 pb-3 border-b border-slate-800 print:hidden space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Choose How Your Thermal Printer is Connected:
            </span>
            {isInIframe && (
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                title="Open in full browser window for unrestricted USB/Bluetooth access"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open in Full Tab</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Method 1: System Print (Installed OS Driver) */}
            <button
              type="button"
              onClick={() => setPrintMethod('system')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start space-x-2.5 ${
                printMethod === 'system'
                  ? 'bg-amber-500/20 border-amber-500 text-white shadow-xs'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 ${printMethod === 'system' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                <Laptop className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">Installed Thermal Printer</span>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 border border-amber-500/40">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  POS-58, POS-80, Epson, Xprinter with Windows/Mac driver. Zero pairing needed.
                </p>
              </div>
            </button>

            {/* Method 2: Direct Hardware (WebUSB / Bluetooth) */}
            <button
              type="button"
              onClick={() => setPrintMethod('direct')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start space-x-2.5 ${
                printMethod === 'direct'
                  ? 'bg-amber-500/20 border-amber-500 text-white shadow-xs'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 ${printMethod === 'direct' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                <Cable className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">Direct USB / Bluetooth</span>
                  {isThermalConnected && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                      Connected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Raw ESC/POS cable without OS driver or wireless Bluetooth BLE printer.
                </p>
              </div>
            </button>
          </div>

          {/* Show Hardware Connection Bar if in Direct Mode */}
          {printMethod === 'direct' && (
            <div className="pt-1">
              <ThermalPrinterBar businessConfig={businessConfig} onDeviceChange={setPrinterState} />
            </div>
          )}
        </div>

        {/* Notifications */}
        {printSuccessMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{printSuccessMsg}</span>
          </div>
        )}

        {printErrorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{printErrorMsg}</span>
          </div>
        )}

        {/* "Printer not in list" Help Card */}
        {showDriverHelp && (
          <div className="mx-6 mt-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="flex items-center justify-between font-bold text-amber-950">
              <div className="flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <span>Is your thermal printer not showing up in the USB list?</span>
              </div>
              <button 
                type="button" 
                onClick={() => setShowDriverHelp(false)}
                className="text-amber-700 hover:text-amber-950 font-bold"
              >
                ×
              </button>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              If your thermal printer is already recognized by Windows or Mac (e.g. POS-58 or XP-58 driver), the operating system locks the USB connection.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setPrintMethod('system');
                  setShowDriverHelp(false);
                  handleSystemPrint();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Switch to Installed Thermal Printer & Open Print Dialog</span>
              </button>
            </div>
          </div>
        )}

        {/* Config & Filters - Screen only */}
        <div className="p-6 border-b border-gray-100 bg-gray-50 space-y-4 print:hidden">
          {/* Paper Format Segmented Tabs */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                Paper Roll Format:
              </label>
              <span className="text-[11px] text-gray-500 font-medium">
                {layout === 'roll58' ? 'Continuous 58mm Thermal Roll' : layout === 'roll80' ? 'Continuous 80mm Thermal Roll' : 'A4 / Letter Sticker Sheet'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
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
                <span>A4 Sheet (3-Col)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-300 bg-white font-bold text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <div className="flex space-x-1">
                  {[1, 2, 5].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCopiesPerProduct(preset)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        copiesPerProduct === preset
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {preset}x
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

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                Label Style:
              </label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-xl border border-gray-300 bg-white font-medium text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="standard">Standard Sticker (50mm × 30mm)</option>
                <option value="compact">Compact Shelf Tag (40mm × 25mm)</option>
                <option value="jewelry">Small Barcode (30mm × 20mm)</option>
              </select>
            </div>
          </div>

          {/* Product Selection Bar */}
          <div className="pt-2 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center space-x-1 cursor-pointer"
              >
                {selectedProductIds.size === validProducts.length ? (
                  <>
                    <CheckSquare className="w-4 h-4 text-amber-600" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 text-gray-400" />
                    <span>Select All ({validProducts.length})</span>
                  </>
                )}
              </button>
              <span className="text-xs text-gray-500">
                {selectedProductIds.size} of {validProducts.length} selected
              </span>
            </div>

            {/* Quick Search */}
            <div className="relative min-w-[200px] max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
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
        <div className="p-6 overflow-y-auto max-h-[50vh] bg-gray-100 print:bg-white print:p-0 print:max-h-none">
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

        {/* Footer - Dual Print Actions */}
        <div className="p-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <div className="text-xs text-gray-500 text-center sm:text-left">
            {printMethod === 'system' ? (
              <span className="text-slate-700 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 inline text-emerald-600 shrink-0" />
                <span>Installed Thermal Printer mode: Opens print dialog with {layout === 'roll58' ? '58mm' : layout === 'roll80' ? '80mm' : 'A4'} roll formatting.</span>
              </span>
            ) : isThermalConnected ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-600" />
                Ready to print on {printerState.device?.name}
              </span>
            ) : (
              <span>Direct USB/BT mode requires pairing. (Or switch to Installed Thermal Printer above)</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-50 cursor-pointer"
            >
              Close
            </button>

            {/* Primary Print Button */}
            {printMethod === 'system' ? (
              <button
                type="button"
                onClick={handleSystemPrint}
                disabled={displayItems.length === 0 || isPrinting}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {isPrinting ? 'Opening...' : `Print ${totalLabelsToPrint} Labels (Thermal)`}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDirectThermalPrint}
                disabled={displayItems.length === 0 || isPrinting}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 ${
                  isThermalConnected
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>
                  {isPrinting
                    ? 'Printing...'
                    : isThermalConnected
                    ? `Print ${totalLabelsToPrint} Labels (Direct)`
                    : `Connect & Print ${totalLabelsToPrint} Labels`}
                </span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
