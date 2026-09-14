import React, { useState, useEffect } from 'react';
import { thermalPrinterService } from '../../printer/ThermalPrinterService';
import { PrinterConnectionState, PrinterType } from '../../printer/printerTypes';
import { BusinessConfig } from '../../types';
import { isAppInsideIframe } from '../../lib/barcodePrintService';
import { 
  Printer, 
  Usb, 
  Bluetooth, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  HelpCircle, 
  PowerOff,
  ExternalLink,
  Info
} from 'lucide-react';

interface ThermalPrinterBarProps {
  businessConfig?: BusinessConfig | null;
  onDeviceChange?: (state: PrinterConnectionState) => void;
  compact?: boolean;
}

export const ThermalPrinterBar: React.FC<ThermalPrinterBarProps> = ({
  businessConfig,
  onDeviceChange,
  compact = false
}) => {
  const [state, setState] = useState<PrinterConnectionState>(thermalPrinterService.getState());
  const [loading, setLoading] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [localMsg, setLocalMsg] = useState<string | null>(null);
  const isInIframe = isAppInsideIframe();

  useEffect(() => {
    // Subscribe to printer state changes
    const unsubscribe = thermalPrinterService.subscribe((newState) => {
      setState(newState);
      if (onDeviceChange) {
        onDeviceChange(newState);
      }
    });

    // Auto-detect previously paired USB devices on mount
    thermalPrinterService.autoConnect().then((dev) => {
      if (dev) {
        setLocalMsg(`Auto-detected ${dev.name}`);
        setTimeout(() => setLocalMsg(null), 3000);
      }
    }).catch(() => {});

    return () => {
      unsubscribe();
    };
  }, [onDeviceChange]);

  const handleConnect = async (type: PrinterType) => {
    setLoading(true);
    setLocalMsg(null);
    try {
      const device = await thermalPrinterService.requestDevice(type);
      await thermalPrinterService.connect(device);
      setLocalMsg(`Connected to ${device.name}!`);
      setTimeout(() => setLocalMsg(null), 4000);
    } catch (err: any) {
      if (err?.name !== 'NotFoundError') {
        setLocalMsg(err.message || 'Failed to connect printer');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await thermalPrinterService.disconnect();
      setLocalMsg('Printer disconnected.');
      setTimeout(() => setLocalMsg(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestPrint = async () => {
    setLoading(true);
    try {
      await thermalPrinterService.testPrint(businessConfig);
      setLocalMsg('Direct ESC/POS test receipt sent to printer!');
      setTimeout(() => setLocalMsg(null), 3000);
    } catch (err: any) {
      setLocalMsg(`Test print failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const isConnected = state.status === 'connected' && !!state.device;

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-3 sm:p-3.5 border border-slate-700 shadow-sm print:hidden">
      {/* Iframe Warning Banner if applicable */}
      {isInIframe && (
        <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Embedded Preview Frame:</strong> For direct USB cable or Bluetooth discovery, opening in a full tab provides full hardware access.
            </span>
          </div>
          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="shrink-0 ml-2 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Open in Full Tab</span>
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Status Indicator */}
        <div className="flex items-center space-x-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 transition-colors ${
              isConnected
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : state.status === 'connecting'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <Printer className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-white tracking-wide">
                Thermal Hardware Connection:
              </span>
              {isConnected ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400 shrink-0" />
                  Connected ({state.type.toUpperCase()})
                </span>
              ) : state.status === 'connecting' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin text-amber-400" />
                  Connecting...
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  Direct Cable: Not Connected
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-300 mt-0.5 truncate max-w-xs sm:max-w-md">
              {isConnected
                ? `${state.device?.name || 'Thermal POS Printer'} • Ready for ESC/POS instant barcode printing`
                : 'Installed in Windows/Mac? System Thermal Print prints to all drivers. Or connect USB/BT below for raw control.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          {isConnected ? (
            <>
              <button
                type="button"
                onClick={handleTestPrint}
                disabled={loading}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600 transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                title="Send test print to check roll and alignment"
              >
                <span>Test Roll</span>
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={loading}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-red-900/50 hover:text-red-300 hover:border-red-500/50 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                title="Disconnect thermal printer"
              >
                <PowerOff className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleConnect('usb')}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                title="Connect directly via WebUSB cable"
              >
                <Usb className="w-3.5 h-3.5" />
                <span>Pair USB</span>
              </button>
              <button
                type="button"
                onClick={() => handleConnect('bluetooth')}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600 transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                title="Connect directly via Bluetooth"
              >
                <Bluetooth className="w-3.5 h-3.5 text-blue-400" />
                <span>Pair BT</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowTroubleshooting(!showTroubleshooting)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Printer troubleshooting tips"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      {localMsg && (
        <div className="mt-2 text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-1.5 flex items-center justify-between">
          <span>{localMsg}</span>
          <button onClick={() => setLocalMsg(null)} className="text-amber-400 hover:text-white font-bold ml-2 cursor-pointer">×</button>
        </div>
      )}

      {state.error && (
        <div className="mt-2 text-xs font-medium text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-1.5 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span className="truncate">{state.error}</span>
        </div>
      )}

      {/* Troubleshooting Guide Collapsible */}
      {showTroubleshooting && (
        <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 space-y-2">
          <div className="font-bold text-amber-400 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Why is my thermal printer not showing up?</span>
          </div>
          <div className="space-y-2 text-slate-300 text-[11px] leading-relaxed">
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <strong className="text-white block mb-0.5">1. Using an Installed Printer (Windows/macOS Driver):</strong>
              If your printer (POS-58, XP-58, POS-80, Epson) is already installed as a regular printer on your computer, your operating system locks direct USB access.
              <span className="text-amber-300 font-semibold block mt-1">
                👉 Simply choose "Installed Thermal Printer (System Print)" mode when printing labels. It prints directly to your thermal printer without any pairing needed!
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <strong className="text-white block mb-0.5">2. Direct USB Cable (WebUSB):</strong>
              Connect your printer via USB, turn power ON, and click "Pair USB". Ensure you are using <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>. If running in an embedded preview, click <strong>"Open in Full Tab"</strong> above to grant USB permissions.
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <strong className="text-white block mb-0.5">3. Bluetooth Printers:</strong>
              Make sure Bluetooth is turned ON on your computer or tablet. If your thermal printer uses Bluetooth Classic SPP, pair it in Windows/Mac settings and use System Print.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
