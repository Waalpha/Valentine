import React, { useState, useRef, useEffect } from 'react';
import { Product, BusinessConfig } from '../../types';
import { BarcodeSvg } from './BarcodeSvg';
import { formatCurrency } from '../../lib/utils';
import { 
  X, 
  Printer, 
  CheckCircle2, 
  Copy, 
  Download, 
  Check, 
  Layers, 
  ScrollText, 
  AlertCircle,
  Zap,
  ExternalLink
} from 'lucide-react';
import { printBarcodeContainer, openBarcodePrintWindow } from '../../lib/barcodePrintService';
import { ThermalPrinterBar } from './ThermalPrinterBar';
import { thermalPrinterService } from '../../printer/ThermalPrinterService';
import { PrinterConnectionState } from '../../printer/printerTypes';

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
  const [layout, setLayout] = useState<'roll58' | 'roll80' | 'sheet'>('roll58');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [printerState, setPrinterState] = useState<PrinterConnectionState>(thermalPrinterService.getState());
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);
  const [printErrorMsg, setPrintErrorMsg] = useState<string | null>(null);

  const printContainerRef = useRef<HTMLDivElement>(null);

  const currency = businessConfig?.currency || 'KSh';
  const businessName = businessConfig?.name || 'Club Valentine Bar POS';
  const barcodeValue = product.barcode != null && String(product.barcode).trim()
    ? String(product.barcode).trim()
    : `28${product.id.replace(/\D/g, '').slice(-8) || '10000001'}`;

  useEffect(() => {
    const unsub = thermalPrinterService.subscribe((s) => {
      setPrinterState(s);
    });
    return () => unsub();
  }, []);

  const isThermalConnected = printerState.status === 'connected' && !!printerState.device;

  // 1. Direct Thermal Hardware Printing (ESC/POS via USB / Bluetooth)
  const handleDirectThermalPrint = async () => {
    setIsPrinting(true);
    setPrintErrorMsg(null);
    setPrintSuccessMsg(null);

    try {
      if (!isThermalConnected) {
        // Attempt auto-reconnect first
        const auto = await thermalPrinterService.autoConnect();
        if (!auto) {
          // Prompt user to pick USB device
          const dev = await thermalPrinterService.requestDevice('usb');
          await thermalPrinterService.connect(dev);
        }
      }

      await thermalPrinterService.printBarcodeLabels(product, copies, {
        showPrice,
        showBusinessName,
        businessName,
        currency
      });

      const devName = thermalPrinterService.getState().device?.name || 'Thermal Printer';
      setPrintSuccessMsg(`Printed ${copies} barcode label${copies === 1 ? '' : 's'} directly to ${devName}!`);
      setTimeout(() => setPrintSuccessMsg(null), 5000);
    } catch (err: any) {
      console.warn('Direct thermal print error:', err);
      // If user canceled picker, don't show red error
      if (err?.name !== 'NotFoundError') {
        setPrintErrorMsg(err.message || 'Direct thermal print failed. If using USB, check power and cable.');
      }
    } finally {
      setIsPrinting(false);
    }
  };

  // 2. Browser System Print (Windows / macOS CUPS driver or A4 Sheet)
  const handleSystemPrint = async () => {
    if (!printContainerRef.current) {
      window.print();
      return;
    }
    setIsPrinting(true);
    setPrintErrorMsg(null);
    setPrintSuccessMsg(null);
    try {
      await printBarcodeContainer(printContainerRef.current, {
        title: `Barcode Labels - ${product.name}`,
        layout,
        labelSize,
        columns: layout === 'sheet' ? 3 : 1
      });
      setPrintSuccessMsg('Opened print dialog.');
      setTimeout(() => setPrintSuccessMsg(null), 4000);
    } catch (err: any) {
      console.warn('Iframe print error, opening popup print window:', err);
      try {
        await openBarcodePrintWindow(printContainerRef.current, {
          title: `Barcode Labels - ${product.name}`,
          layout,
          labelSize,
          columns: layout === 'sheet' ? 3 : 1
        });
      } catch (winErr: any) {
        setPrintErrorMsg(winErr.message || 'Could not open print dialog.');
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCopyBarcode = () => {
    navigator.clipboard?.writeText(barcodeValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    const svgEl = printContainerRef.current?.querySelector('svg');
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `barcode-${barcodeValue}-${product.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate copies array
  const labelList = Array.from({ length: Math.max(1, Math.min(copies, 100)) });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto border border-gray-200 print:border-none print:shadow-none print:rounded-none print:m-0 print:p-0">
        
        {/* Header - Screen only */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-md">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Print Barcode Labels
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 font-semibold border border-amber-500/30">
                  Ready to Print
                </span>
              </h3>
              <p className="text-xs text-slate-300 truncate max-w-sm">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hardware Thermal Printer Connection Bar */}
        <div className="p-4 pb-0 bg-slate-950">
          <ThermalPrinterBar businessConfig={businessConfig} onDeviceChange={setPrinterState} />
        </div>

        {/* Notification Banners */}
        {printSuccessMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{printSuccessMsg}</span>
          </div>
        )}

        {printErrorMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{printErrorMsg}</span>
          </div>
        )}

        {/* Controls - Screen only */}
        <div className="p-5 border-b border-gray-100 bg-gray-50 space-y-4 print:hidden">
          {/* Printer / Paper Type Segmented Tabs */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                Paper Format & Printer Target:
              </label>
              <span className="text-[11px] text-gray-500">
                {layout === 'sheet' ? 'For A4 Sheet & Regular Printers' : 'Direct for 58mm / 80mm Thermal Rolls'}
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
                <span>A4 Sticker Sheet</span>
              </button>
            </div>
          </div>

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
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
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
                  <span>Show Price ({formatCurrency(product.sellingPrice, currency)})</span>
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
                className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-medium text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="standard">Standard Sticker (50mm × 30mm)</option>
                <option value="compact">Compact Shelf Tag (40mm × 25mm)</option>
                <option value="jewelry">Small Barcode (30mm × 20mm)</option>
              </select>
            </div>
          </div>

          {/* Barcode Quick Actions */}
          <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200">
            <div className="flex items-center space-x-2 text-xs text-gray-600 font-mono">
              <span className="font-semibold text-gray-800">Barcode:</span>
              <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-900 font-bold">{barcodeValue}</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleCopyBarcode}
                className="px-2.5 py-1 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg flex items-center space-x-1 cursor-pointer transition-colors"
                title="Copy barcode digits"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="px-2.5 py-1 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg flex items-center space-x-1 cursor-pointer transition-colors"
                title="Download high-resolution vector SVG"
              >
                <Download className="w-3.5 h-3.5 text-gray-500" />
                <span>Download SVG</span>
              </button>
            </div>
          </div>
        </div>

        {/* Labels Preview and Printable Canvas */}
        <div className="p-6 overflow-y-auto max-h-[44vh] bg-gray-100 print:bg-white print:p-0 print:max-h-none">
          <div className="text-xs text-gray-500 font-semibold mb-3 print:hidden flex items-center justify-between">
            <span>
              Print Preview ({copies} label{copies === 1 ? '' : 's'}) • {layout === 'sheet' ? 'A4 Sticker Sheet' : layout === 'roll58' ? '58mm Roll' : '80mm Roll'}
            </span>
            <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
              High-contrast vector output enabled
            </span>
          </div>

          <div
            ref={printContainerRef}
            id="printable-barcode-labels-grid"
            className={`printable-barcode-area ${
              layout === 'sheet'
                ? 'grid grid-cols-2 sm:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2 print:p-2'
                : 'flex flex-col items-center gap-3 max-w-[58mm] mx-auto'
            }`}
          >
            {labelList.map((_, idx) => (
              <div
                key={idx}
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
                <span className="product-name text-[11px] font-bold text-gray-900 leading-tight line-clamp-1 mt-0.5">
                  {product.name}
                </span>

                {/* The Barcode itself */}
                <div className="barcode-wrapper my-1 flex justify-center w-full">
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
                  <div className="price-tag mt-0.5 font-black text-xs text-gray-900">
                    <span className="curr text-[10px] font-bold text-gray-500 mr-0.5">{currency}</span>
                    <span>{product.sellingPrice.toLocaleString()}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer - Dual Print Actions */}
        <div className="p-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <div className="text-xs text-gray-500 text-center sm:text-left">
            {isThermalConnected ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-600" />
                Ready to print on {printerState.device?.name}
              </span>
            ) : (
              <span>Plug thermal printer via USB or use Browser System Print.</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-50 cursor-pointer"
            >
              Close
            </button>

            {/* System Print Dialog Option */}
            <button
              type="button"
              onClick={handleSystemPrint}
              disabled={isPrinting}
              className="px-3.5 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              title="Print via Windows / macOS system print dialog or save as PDF"
            >
              <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
              <span>System Print</span>
            </button>

            {/* Direct Hardware Thermal Print Button */}
            <button
              type="button"
              onClick={handleDirectThermalPrint}
              disabled={isPrinting}
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
                  ? `Print ${copies} Label${copies === 1 ? '' : 's'} (Thermal)`
                  : `Connect & Print ${copies} Labels`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

