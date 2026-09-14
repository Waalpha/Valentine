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
  ExternalLink,
  Info,
  HelpCircle,
  Laptop,
  Cable
} from 'lucide-react';
import { printBarcodeDirectly, isAppInsideIframe } from '../../lib/barcodePrintService';
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
  // Printing Method: 'system' (Installed Windows/Mac POS driver) vs 'direct' (WebUSB/Bluetooth)
  const [printMethod, setPrintMethod] = useState<'system' | 'direct'>('system');
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
  const [showDriverHelp, setShowDriverHelp] = useState<boolean>(false);

  const printContainerRef = useRef<HTMLDivElement>(null);
  const isInIframe = isAppInsideIframe();

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

  // 1. Browser System Print (Works with ANY installed printer: POS-58, POS-80, Epson, Xprinter, CUPS)
  const handleSystemPrint = async (customCopies?: number) => {
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
        title: `Barcode Labels - ${product.name}`,
        layout,
        labelSize,
        columns: layout === 'sheet' ? 3 : 1
      });
      const count = customCopies ?? copies;
      setPrintSuccessMsg(`Print dialog opened! Select your thermal printer (e.g. POS-58 or POS-80) to print ${count} label${count === 1 ? '' : 's'}.`);
      setTimeout(() => setPrintSuccessMsg(null), 6000);
    } catch (err: any) {
      console.warn('In-DOM print error:', err);
      setPrintErrorMsg(err.message || 'Could not open print dialog.');
    } finally {
      setIsPrinting(false);
    }
  };

  // 2. Direct Thermal Hardware Printing (ESC/POS via WebUSB / WebBluetooth)
  const handleDirectThermalPrint = async (customCopies?: number) => {
    const targetCopies = customCopies ?? copies;
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

      await thermalPrinterService.printBarcodeLabels(product, targetCopies, {
        showPrice,
        showBusinessName,
        businessName,
        currency
      });

      const devName = thermalPrinterService.getState().device?.name || 'Thermal Printer';
      setPrintSuccessMsg(`Printed ${targetCopies} barcode label${targetCopies === 1 ? '' : 's'} directly to ${devName}!`);
      setTimeout(() => setPrintSuccessMsg(null), 5000);
    } catch (err: any) {
      console.warn('Direct thermal print error:', err);
      if (err?.name !== 'NotFoundError') {
        const msg = err.message || 'Direct thermal print failed.';
        setPrintErrorMsg(msg);
        // Show driver help since 90% of failures are because an OS driver has claimed the USB port
        setShowDriverHelp(true);
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

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  // Generate copies array
  const labelList = Array.from({ length: Math.max(1, Math.min(copies, 100)) });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto border border-gray-200 print:border-none print:shadow-none print:rounded-none print:m-0 print:p-0">
        
        {/* Header */}
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
                <span>Open in New Tab</span>
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

        {/* "Printer not in list" Help Card */}
        {showDriverHelp && (
          <div className="mx-5 mt-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
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
              If your thermal printer is plugged in and already recognized in your Windows/Mac control panel (e.g. POS-58, XP-58, Rongta, Epson), the operating system locks the USB port so WebUSB cannot see it.
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

        {/* Controls - Screen only */}
        <div className="p-5 border-b border-gray-100 bg-gray-50 space-y-4 print:hidden">
          {/* Paper Format Segmented Tabs */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                Paper Roll Format:
              </label>
              <span className="text-[11px] text-gray-500 font-medium">
                {layout === 'roll58' ? 'Standard 58mm POS Receipt Paper (Continuous)' : layout === 'roll80' ? 'Standard 80mm POS Receipt Paper (Continuous)' : 'A4 / Letter Sticker Sheet'}
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

        {/* Live Labels Visual Preview Area */}
        <div className="p-6 bg-gray-100 overflow-y-auto max-h-[38vh] print:p-0 print:bg-white print:max-h-none">
          <div className="flex items-center justify-between mb-3 text-xs text-gray-500 print:hidden">
            <span className="font-bold uppercase tracking-wider text-gray-600">
              Live Label Preview ({labelList.length} {labelList.length === 1 ? 'label' : 'labels'} on {layout === 'sheet' ? 'A4 sheet' : `${layout === 'roll58' ? '58mm' : '80mm'} thermal roll`}):
            </span>
            <span className="text-[11px] text-gray-400">Crisp vector 1D CODE128 for laser/camera scanners</span>
          </div>

          <div
            ref={printContainerRef}
            className={`print-container bg-white p-4 rounded-2xl shadow-inner border border-gray-200 mx-auto transition-all ${
              layout === 'roll58'
                ? 'max-w-[240px] flex flex-col items-center gap-3'
                : layout === 'roll80'
                ? 'max-w-[320px] flex flex-col items-center gap-4'
                : 'w-full grid grid-cols-2 sm:grid-cols-3 gap-3'
            }`}
          >
            {labelList.map((_, idx) => (
              <div
                key={idx}
                className={`barcode-label-card bg-white border border-dashed border-gray-400 rounded-md p-2 flex flex-col items-center justify-between text-center transition-all ${
                  layout !== 'sheet' ? 'w-full' : ''
                } ${
                  labelSize === 'jewelry'
                    ? 'min-h-[70px]'
                    : labelSize === 'compact'
                    ? 'min-h-[85px]'
                    : 'min-h-[105px]'
                }`}
              >
                {showBusinessName && (
                  <span className="business-name text-[9px] font-black uppercase text-gray-700 tracking-wider truncate max-w-full">
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

        {/* Footer - Print Actions */}
        <div className="p-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <div className="text-xs text-gray-500 text-center sm:text-left">
            {printMethod === 'system' ? (
              <span className="text-slate-700 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 inline text-emerald-600 shrink-0" />
                <span>Installed Thermal Printer mode: Opens print dialog with {layout === 'roll58' ? '58mm' : layout === 'roll80' ? '80mm' : 'A4'} roll formatting.</span>
              </span>
            ) : isThermalConnected ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 inline text-emerald-600 shrink-0" />
                <span>Ready to print via ESC/POS on {printerState.device?.name}</span>
              </span>
            ) : (
              <span className="text-amber-700 font-medium flex items-center gap-1.5">
                <Info className="w-4 h-4 inline text-amber-500 shrink-0" />
                <span>Direct USB/BT mode requires pair. (Or switch to Installed Thermal Printer above)</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-50 cursor-pointer"
            >
              Close
            </button>

            {/* Test 1 Label button */}
            <button
              type="button"
              onClick={() => printMethod === 'system' ? handleSystemPrint(1) : handleDirectThermalPrint(1)}
              disabled={isPrinting}
              className="px-3.5 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50"
              title="Print just 1 label to test paper alignment"
            >
              <span>Test 1 Label</span>
            </button>

            {/* Primary Print Button */}
            {printMethod === 'system' ? (
              <button
                type="button"
                onClick={() => handleSystemPrint()}
                disabled={isPrinting}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {isPrinting ? 'Opening...' : `Print ${copies} Label${copies === 1 ? '' : 's'} (Thermal)`}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleDirectThermalPrint()}
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
                    ? 'Sending...'
                    : isThermalConnected
                    ? `Print ${copies} Label${copies === 1 ? '' : 's'} (Direct)`
                    : `Connect & Print ${copies} Labels`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
