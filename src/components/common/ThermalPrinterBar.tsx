import React, { useState, useEffect } from 'react';
import { thermalPrinterService } from '../../printer/ThermalPrinterService';
import { PrinterConnectionState, PrinterType } from '../../printer/printerTypes';
import { BusinessConfig } from '../../types';
import { 
  Printer, 
  Usb, 
  Bluetooth, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  HelpCircle, 
  PowerOff,
  ChevronDown,
  ChevronUp
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
      // If user simply closed the picker dialog, don't show angry error
      if (err?.name !== 'NotFoundError') {
        console.warn('Printer connection failed:', err);
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
      setLocalMsg('Test print sent!');
      setTimeout(() => setLocalMsg(null), 3000);
    } catch (err: any) {
      setLocalMsg(`Test print failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isConnected = state.status === 'connected' && !!state.device;

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-3 sm:p-3.5 border border-slate-700 shadow-sm print:hidden">
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
                Thermal Hardware Printer:
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
                  Not Connected
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-300 mt-0.5 truncate max-w-xs sm:max-w-md">
              {isConnected
                ? `${state.device?.name || 'Thermal POS Printer'} • Ready for ESC/POS instant barcode printing`
                : 'Connect via USB or Bluetooth to send barcodes directly to your thermal printer'}
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
              >
                <Usb className="w-3.5 h-3.5" />
                <span>Connect USB</span>
              </button>
              <button
                type="button"
                onClick={() => handleConnect('bluetooth')}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600 transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Bluetooth className="w-3.5 h-3.5 text-blue-400" />
                <span>Connect BT</span>
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
          <button onClick={() => setLocalMsg(null)} className="text-amber-400 hover:text-white font-bold ml-2">×</button>
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
          <ul className="list-disc pl-5 space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
            <li>
              <strong>Direct USB Connection:</strong> Connect your thermal printer with its USB cable, turn the power switch ON, and click <strong>"Connect USB"</strong> above. A browser popup will appear allowing you to select your printer.
            </li>
            <li>
              <strong>Supported Browsers:</strong> Direct WebUSB and Web Bluetooth require <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.
            </li>
            <li>
              <strong>Already installed in Windows/macOS?</strong> If your printer is installed as a regular Windows/Mac printer driver (e.g. POS-58, XP-58, Generic/Text Only), you can also switch the format to <strong>"Browser System Print"</strong> below to print via the standard print dialog!
            </li>
            <li>
              <strong>Bluetooth Printers:</strong> Make sure Bluetooth is turned on in your device settings. If your printer uses Bluetooth Classic SPP, connect it via USB or standard Windows printer pairing.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
