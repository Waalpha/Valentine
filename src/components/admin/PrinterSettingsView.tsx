import React, { useState } from 'react';
import { UserProfile, BusinessConfig, Sale } from '../../types';
import { 
  PrinterType, 
  PrinterConnectionState, 
  PrinterFontSettings, 
  ReceiptFontStyle, 
  ReceiptFontSize, 
  DEFAULT_FONT_SETTINGS,
  getStoredFontSettings, 
  saveStoredFontSettings 
} from '../../printer/printerTypes';
import { thermalPrinterService } from '../../printer/ThermalPrinterService';
import { ThermalReceipt } from '../../printer/ThermalReceipt';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { logAuditAction } from '../../lib/utils';
import { 
  Printer, Usb, Bluetooth, CheckCircle2, AlertCircle, RefreshCw, Power, 
  Type, Bold, Italic, Sliders, Eye, RotateCcw, Save, Check 
} from 'lucide-react';

interface PrinterSettingsViewProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
  onConfigUpdated?: (newConfig: BusinessConfig) => void;
}

export function PrinterSettingsView({ user, businessConfig, onConfigUpdated }: PrinterSettingsViewProps) {
  const [connectionType, setConnectionType] = useState<PrinterType>('usb');
  const [state, setState] = useState<PrinterConnectionState>(thermalPrinterService.getState());
  const [loading, setLoading] = useState(false);
  const [savingFont, setSavingFont] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Font Settings State (initialized from businessConfig or localStorage)
  const [fontSettings, setFontSettings] = useState<PrinterFontSettings>(() => {
    return businessConfig?.printerFontSettings || getStoredFontSettings();
  });

  const refreshState = () => {
    setState(thermalPrinterService.getState());
  };

  const handlePair = async () => {
    setLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      const device = await thermalPrinterService.requestDevice(connectionType);
      setActionMessage(`Selected printer: ${device.name}. Connecting...`);
      await thermalPrinterService.connect(device);
      setActionMessage(`Successfully connected to ${device.name}!`);
      refreshState();
    } catch (err: any) {
      setError(err.message || 'Failed to pair or connect printer');
      refreshState();
    } finally {
      setLoading(false);
    }
  };

  const handleTestPrint = async () => {
    setLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      setActionMessage('Sending test print with your typography settings...');
      await thermalPrinterService.testPrint(businessConfig, fontSettings);
      setActionMessage('Test print sent successfully!');
      refreshState();
    } catch (err: any) {
      setError(err.message || 'Test print failed');
      refreshState();
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      await thermalPrinterService.disconnect();
      setActionMessage('Printer disconnected.');
      refreshState();
    } catch (err: any) {
      setError(err.message || 'Error disconnecting');
      refreshState();
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFontSettings = async () => {
    setSavingFont(true);
    setError(null);
    setActionMessage(null);

    try {
      // 1. Save to local browser storage
      saveStoredFontSettings(fontSettings);

      // 2. Persist to Firestore business config
      const bizRef = doc(db, 'businesses', DEFAULT_BUSINESS_ID);
      await setDoc(bizRef, { printerFontSettings: fontSettings }, { merge: true });

      await logAuditAction(
        user.uid,
        user.name,
        'PRINTER_FONT_UPDATED',
        `Updated printer font: style=${fontSettings.fontStyle}, size=${fontSettings.fontSize}, bold=${fontSettings.bold}, italic=${fontSettings.italic}`
      );

      if (onConfigUpdated && businessConfig) {
        onConfigUpdated({
          ...businessConfig,
          printerFontSettings: fontSettings
        });
      }

      setActionMessage('Font settings saved successfully! Receipts will print using these settings.');
    } catch (err: any) {
      console.warn('Could not save to cloud, saved locally:', err);
      saveStoredFontSettings(fontSettings);
      setActionMessage('Font settings saved locally on this terminal!');
    } finally {
      setSavingFont(false);
    }
  };

  const handleResetDefaults = () => {
    setFontSettings(DEFAULT_FONT_SETTINGS);
    saveStoredFontSettings(DEFAULT_FONT_SETTINGS);
    setActionMessage('Font settings reset to standard defaults.');
  };

  // Sample sale data for realistic live preview
  const sampleSale: Sale = {
    id: 'DEMO-74291',
    items: [
      {
        productId: 'p-1',
        productName: 'Tusker Lager 500ml',
        quantity: 2,
        unitPrice: 250,
        totalAmount: 500,
      },
      {
        productId: 'p-2',
        productName: 'Jameson Whiskey 50ml',
        quantity: 1,
        unitPrice: 350,
        totalAmount: 350,
      },
      {
        productId: 'p-3',
        productName: 'Mineral Water 500ml',
        quantity: 1,
        unitPrice: 150,
        totalAmount: 150,
      }
    ],
    totalAmount: 1000,
    paymentMethod: 'M-Pesa',
    amountTendered: 1000,
    change: 0,
    referenceCode: 'QD892JK12',
    cashierId: user.uid,
    cashierName: user.name || 'Bar Cashier',
    businessDayId: '2026-09-12',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: Date.now(),
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Thermal Printer & Receipt Formatting</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure physical printer connection and customize receipt font style, size, weight, and typography.
        </p>
      </div>

      {error && (
        <div className="flex items-center space-x-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {actionMessage && (
        <div className="flex items-center space-x-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Main Grid: Left = Typography Settings & Controls, Right = Live 58mm Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Font & Printer Settings (8 cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* Typography Settings Box */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700">
                  <Type className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Receipt Typography</h3>
                  <p className="text-xs text-gray-500">Configure font style, size, bold emphasis, and italic slant</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="flex items-center space-x-1 text-xs text-gray-400 hover:text-gray-600 cursor-pointer font-medium"
                title="Reset to standard defaults"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            {/* 1. Font Style */}
            <div className="space-y-2.5">
              <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-700">
                <span>Font Style</span>
                <span className="text-[11px] text-amber-700 font-semibold capitalize bg-amber-50 px-2 py-0.5 rounded-md">
                  {fontSettings.fontStyle}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'monospace' as ReceiptFontStyle, label: 'Monospace', sub: 'Classic POS thermal dot-matrix', fontClass: 'font-mono' },
                  { id: 'sans' as ReceiptFontStyle, label: 'Sans-Serif', sub: 'Clean modern smooth text', fontClass: 'font-sans' },
                  { id: 'serif' as ReceiptFontStyle, label: 'Serif', sub: 'Classic book elegance', fontClass: 'font-serif' },
                  { id: 'condensed' as ReceiptFontStyle, label: 'Condensed', sub: 'Narrow high-density spacing', fontClass: 'font-mono tracking-tighter' }
                ].map((item) => {
                  const isSelected = fontSettings.fontStyle === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFontSettings(prev => ({ ...prev, fontStyle: item.id }))}
                      className={`text-left p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-600 bg-amber-50/70 text-amber-950 shadow-xs'
                          : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${item.fontClass}`}>{item.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-amber-600" />}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1 leading-tight">{item.sub}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Font Size */}
            <div className="space-y-2.5 pt-2">
              <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-700">
                <span>Font Size</span>
                <span className="text-[11px] text-amber-700 font-semibold capitalize bg-amber-50 px-2 py-0.5 rounded-md">
                  {fontSettings.fontSize}
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'small' as ReceiptFontSize, label: 'Small', note: 'Compact / Saves Roll' },
                  { id: 'normal' as ReceiptFontSize, label: 'Normal', note: 'Standard 58mm' },
                  { id: 'large' as ReceiptFontSize, label: 'Large', note: 'High Visibility' }
                ].map((item) => {
                  const isSelected = fontSettings.fontSize === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFontSettings(prev => ({ ...prev, fontSize: item.id }))}
                      className={`text-center p-3 rounded-2xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-600 bg-amber-50/70 text-amber-950 shadow-xs font-bold'
                          : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <div className="text-sm font-bold">{item.label}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{item.note}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Bold & Italic Toggles */}
            <div className="pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-3">
                Weight & Style Toggles
              </label>
              <div className="grid grid-cols-2 gap-3">
                {/* Bold Toggle */}
                <button
                  type="button"
                  onClick={() => setFontSettings(prev => ({ ...prev, bold: !prev.bold }))}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                    fontSettings.bold
                      ? 'border-amber-600 bg-amber-50/80 text-amber-950 shadow-xs'
                      : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-1.5 rounded-xl ${fontSettings.bold ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      <Bold className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold">Bold Text</div>
                      <div className="text-[11px] text-gray-500">Enhanced emphasis</div>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${fontSettings.bold ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {fontSettings.bold ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Italic Toggle */}
                <button
                  type="button"
                  onClick={() => setFontSettings(prev => ({ ...prev, italic: !prev.italic }))}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                    fontSettings.italic
                      ? 'border-amber-600 bg-amber-50/80 text-amber-950 shadow-xs'
                      : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-1.5 rounded-xl ${fontSettings.italic ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      <Italic className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold italic">Italic Text</div>
                      <div className="text-[11px] text-gray-500">Slanted typography</div>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${fontSettings.italic ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {fontSettings.italic ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>

            {/* Save Font Settings Button */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Applies to all printed and previewed receipts
              </span>
              <button
                type="button"
                onClick={handleSaveFontSettings}
                disabled={savingFont}
                className="flex items-center space-x-2 rounded-2xl bg-amber-600 hover:bg-amber-700 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {savingFont ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Typography</span>
              </button>
            </div>
          </div>

          {/* Connection & Diagnostics Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 rounded-2xl ${state.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {state.device ? state.device.name : 'No Printer Paired'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Status: <span className={`font-semibold capitalize ${state.status === 'connected' ? 'text-emerald-600' : 'text-amber-600'}`}>{state.status}</span>
                    {state.device && ` (${state.device.type.toUpperCase()})`}
                  </p>
                </div>
              </div>
              {state.status === 'connected' && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-all cursor-pointer"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              )}
            </div>

            {/* Connection Type Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2.5">Connection Interface</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConnectionType('usb')}
                  className={`flex items-center justify-center space-x-2.5 p-3.5 rounded-2xl border-2 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                    connectionType === 'usb'
                      ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-xs'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Usb className="w-4 h-4 text-amber-600" />
                  <span>USB Thermal Printer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConnectionType('bluetooth')}
                  className={`flex items-center justify-center space-x-2.5 p-3.5 rounded-2xl border-2 font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                    connectionType === 'bluetooth'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-xs'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Bluetooth className="w-4 h-4 text-blue-600" />
                  <span>Bluetooth Printer</span>
                </button>
              </div>
            </div>

            {connectionType === 'bluetooth' && (
              <div className="rounded-2xl bg-amber-50 p-3.5 border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-bold">Bluetooth Protocol Note:</p>
                <p>Web Bluetooth supports BLE (Bluetooth Low Energy) GATT devices. For classic Bluetooth POS printers, connect via USB for direct browser printing without third-party drivers.</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={handlePair}
                disabled={loading}
                className="flex items-center space-x-2 rounded-2xl bg-slate-900 hover:bg-slate-800 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                <span>{state.device ? 'Change / Reconnect' : `Pair ${connectionType.toUpperCase()} Printer`}</span>
              </button>

              <button
                type="button"
                onClick={handleTestPrint}
                disabled={loading || state.status !== 'connected'}
                className="flex items-center space-x-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4" />
                <span>Test Print Receipt</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live 58mm Thermal Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-6">
          <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold tracking-tight">Live 58mm Receipt Preview</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-amber-400 px-2 py-0.5 rounded-md border border-slate-700">
                Real-time
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              This reflects the exact font, size, bold weighting, and italic slant on a standard 58mm paper roll.
            </p>

            {/* Receipt Preview Box */}
            <div className="bg-slate-950/70 p-4 rounded-2xl flex justify-center border border-slate-800/80 shadow-inner">
              <ThermalReceipt 
                sale={sampleSale} 
                businessConfig={businessConfig} 
                fontSettings={fontSettings} 
              />
            </div>

            {/* Current Active Specs Badge */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div>
                <span className="text-slate-500">Style: </span>
                <span className="text-white font-medium capitalize">{fontSettings.fontStyle}</span>
              </div>
              <div>
                <span className="text-slate-500">Size: </span>
                <span className="text-white font-medium capitalize">{fontSettings.fontSize}</span>
              </div>
              <div>
                <span className="text-slate-500">Bold: </span>
                <span className={fontSettings.bold ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                  {fontSettings.bold ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Italic: </span>
                <span className={fontSettings.italic ? 'text-blue-400 italic' : 'text-slate-400'}>
                  {fontSettings.italic ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
