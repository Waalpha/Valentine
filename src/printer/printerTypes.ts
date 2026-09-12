export type PrinterType = 'usb' | 'bluetooth';

export type PrinterStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PrinterDevice {
  id: string;
  name: string;
  type: PrinterType;
  rawDevice?: USBDevice | BluetoothDevice;
}

export interface PrinterConnectionState {
  type: PrinterType;
  status: PrinterStatus;
  device: PrinterDevice | null;
  error: string | null;
  lastTestedAt?: string;
}

export interface PrinterDiagnostics {
  usbSupported: boolean;
  bluetoothSupported: boolean;
  bluetoothProtocolNote: string;
}

export type ReceiptFontStyle = 'monospace' | 'sans' | 'serif' | 'condensed';
export type ReceiptFontSize = 'small' | 'normal' | 'large';

export interface PrinterFontSettings {
  fontStyle: ReceiptFontStyle;
  fontSize: ReceiptFontSize;
  bold: boolean;
  italic: boolean;
}

export const DEFAULT_FONT_SETTINGS: PrinterFontSettings = {
  fontStyle: 'monospace',
  fontSize: 'normal',
  bold: false,
  italic: false,
};

export const PRINTER_FONT_STORAGE_KEY = 'pos_thermal_printer_font_settings';

export function getStoredFontSettings(): PrinterFontSettings {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(PRINTER_FONT_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        fontStyle: parsed.fontStyle || DEFAULT_FONT_SETTINGS.fontStyle,
        fontSize: parsed.fontSize || DEFAULT_FONT_SETTINGS.fontSize,
        bold: typeof parsed.bold === 'boolean' ? parsed.bold : DEFAULT_FONT_SETTINGS.bold,
        italic: typeof parsed.italic === 'boolean' ? parsed.italic : DEFAULT_FONT_SETTINGS.italic,
      };
    }
  } catch (e) {
    console.error('Failed to read stored font settings', e);
  }
  return DEFAULT_FONT_SETTINGS;
}

export function saveStoredFontSettings(settings: PrinterFontSettings): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(PRINTER_FONT_STORAGE_KEY, JSON.stringify(settings));
    }
  } catch (e) {
    console.error('Failed to save font settings', e);
  }
}
