import { Sale, BusinessConfig } from '../types';
import { formatCurrency } from './utils';

export interface PrinterDevice {
  name: string;
  type: 'bluetooth_bridge' | 'usb' | 'bluetooth_ble';
  id?: string;
  bridgeUrl?: string;
}

export interface PrinterDiagnosticInfo {
  bluetoothAvailable: boolean;
  bluetoothProtocol: string;
  compatibilityNote: string;
  printerDetected: string;
  connectionStatus: string;
  printingStatus: string;
  lastError: string;
  bridgeUrl: string;
}

let lastErrorMsg = '';
let printingStatusState = 'Idle';

export function getPrinterDiagnostics(): PrinterDiagnosticInfo {
  const nav = navigator as any;
  const saved = getSavedPrinter();
  return {
    bluetoothAvailable: !!nav.bluetooth,
    bluetoothProtocol: 'Bluetooth Classic (SPP) / Virtual COM Port (Incompatible with Web Bluetooth BLE/GATT)',
    compatibilityNote: 'P58E paired in Windows uses Bluetooth Classic SPP, which Web Bluetooth cannot access. Use USB or the Local Print Bridge.',
    printerDetected: saved ? saved.name : 'None configured',
    connectionStatus: saved ? `Configured for ${saved.type}` : 'Disconnected',
    printingStatus: printingStatusState,
    lastError: lastErrorMsg,
    bridgeUrl: localStorage.getItem('bar_pos_print_bridge_url') || 'http://localhost:9100/print'
  };
}

// Helper to encode text to Uint8Array (CP437 or ASCII friendly)
function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

// ESC/POS Command constants
const ESC = '\x1B';
const GS = '\x1D';
const INIT = ESC + '\x40';
const ALIGN_LEFT = ESC + '\x61\x00';
const ALIGN_CENTER = ESC + '\x61\x01';
const ALIGN_RIGHT = ESC + '\x61\x02';
const BOLD_ON = ESC + '\x45\x01';
const BOLD_OFF = ESC + '\x45\x00';
const CUT_PAPER = GS + '\x56\x41\x00';

export function generateReceiptEscPos(sale: Sale, businessConfig?: BusinessConfig | null): Uint8Array {
  const businessName = businessConfig?.name || 'Club Valentine';
  const address = businessConfig?.address || 'Nairobi CBD';
  const phone = businessConfig?.phone || '+254 712 345 678';
  const footer = businessConfig?.receiptFooter || 'Thank you! Please drink responsibly.';
  const currency = businessConfig?.currency || 'KSh';

  let raw = INIT;

  // Header
  raw += ALIGN_CENTER + BOLD_ON;
  raw += `${businessName.toUpperCase()}\n`;
  raw += BOLD_OFF;
  raw += `${address}\n`;
  raw += `Tel: ${phone}\n`;
  raw += '--------------------------------\n';

  // Meta
  raw += ALIGN_LEFT;
  raw += `Receipt #: ${sale.id.slice(-8).toUpperCase()}\n`;
  raw += `Date: ${sale.date} ${sale.time}\n`;
  raw += `Cashier: ${sale.cashierName}\n`;
  raw += `Payment: ${sale.paymentMethod}\n`;
  raw += '--------------------------------\n';

  // Items Header
  raw += 'Item               Qty    Total\n';
  raw += '--------------------------------\n';

  sale.items.forEach(item => {
    const name = item.productName.padEnd(18, ' ').substring(0, 18);
    const qty = String(item.quantity).padStart(3, ' ');
    const tot = String(item.totalAmount).padStart(6, ' ');
    raw += `${name}${qty}${tot}\n`;
  });

  raw += '--------------------------------\n';

  // Totals
  raw += BOLD_ON;
  raw += `TOTAL: ${currency} ${sale.totalAmount}\n`;
  if (sale.amountTendered) {
    raw += BOLD_OFF;
    raw += `Tendered: ${currency} ${sale.amountTendered}\n`;
    if (sale.change !== undefined && sale.change > 0) {
      raw += `Change: ${currency} ${sale.change}\n`;
    }
  }
  if (sale.referenceCode) {
    raw += `Ref: ${sale.referenceCode}\n`;
  }
  raw += BOLD_OFF;

  raw += '--------------------------------\n';
  raw += ALIGN_CENTER;
  raw += `${footer}\n`;
  raw += '\n\n\n';
  raw += CUT_PAPER;

  return encodeText(raw);
}

export function getSavedPrinter(): PrinterDevice | null {
  try {
    const saved = localStorage.getItem('bar_pos_saved_printer');
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

export function savePrinter(printer: PrinterDevice): void {
  localStorage.setItem('bar_pos_saved_printer', JSON.stringify(printer));
}

export function clearSavedPrinter(): void {
  localStorage.removeItem('bar_pos_saved_printer');
}

export async function connectUsbPrinter(): Promise<PrinterDevice> {
  const nav = navigator as any;
  if (!nav.usb) {
    throw new Error('Web USB is not supported in this browser.');
  }

  try {
    const device = await nav.usb.requestDevice({ filters: [] });
    if (!device.opened) {
      await device.open();
    }
    if (device.configuration === null && device.configurations.length > 0) {
      await device.selectConfiguration(device.configurations[0].configurationValue);
    }
    try {
      await device.claimInterface(0);
    } catch (e) {
      // ignore
    }

    const printerInfo: PrinterDevice = {
      name: device.productName || 'USB Thermal Printer',
      type: 'usb',
      id: String(device.serialNumber || device.vendorId)
    };

    savePrinter(printerInfo);
    return printerInfo;
  } catch (err: any) {
    lastErrorMsg = err.message || 'Failed to connect USB printer';
    throw new Error(lastErrorMsg);
  }
}

export async function connectBridgePrinter(bridgeUrl = 'http://localhost:9100/print'): Promise<PrinterDevice> {
  localStorage.setItem('bar_pos_print_bridge_url', bridgeUrl);
  const printerInfo: PrinterDevice = {
    name: 'P58E Windows Bluetooth (Print Bridge)',
    type: 'bluetooth_bridge',
    bridgeUrl
  };
  savePrinter(printerInfo);
  return printerInfo;
}

export async function printToThermalPrinter(sale: Sale, businessConfig?: BusinessConfig | null): Promise<boolean> {
  printingStatusState = 'Preparing receipt...';
  lastErrorMsg = '';

  const printer = getSavedPrinter();
  if (!printer) {
    lastErrorMsg = 'No printer configured. Please configure USB or Print Bridge in Settings.';
    printingStatusState = 'Error: No printer configured';
    throw new Error(lastErrorMsg);
  }

  const escPosData = generateReceiptEscPos(sale, businessConfig);
  const nav = navigator as any;

  if (printer.type === 'usb') {
    if (!nav.usb) throw new Error('Web USB not supported.');
    printingStatusState = 'Connecting to USB printer...';
    const devices = await nav.usb.getDevices();
    let device = devices.find((d: any) => String(d.serialNumber || d.vendorId) === printer.id) || devices[0];
    if (!device) {
      device = await nav.usb.requestDevice({ filters: [] });
    }
    if (!device.opened) {
      await device.open();
    }
    if (device.configuration === null && device.configurations.length > 0) {
      await device.selectConfiguration(device.configurations[0].configurationValue);
    }
    try {
      await device.claimInterface(0);
    } catch (e) {
      // ignore
    }

    let endpointOut = 1;
    const intf = device.configurations[0].interfaces[0];
    for (const alt of intf.alternates) {
      for (const ep of alt.endpoints) {
        if (ep.direction === 'out') {
          endpointOut = ep.endpointNumber;
          break;
        }
      }
    }

    printingStatusState = 'Sending data to USB printer...';
    await device.transferOut(endpointOut, escPosData);
    printingStatusState = 'Printed successfully via USB';
    return true;
  }

  if (printer.type === 'bluetooth_bridge') {
    printingStatusState = 'Sending to Windows Print Bridge...';
    const bridgeUrl = printer.bridgeUrl || localStorage.getItem('bar_pos_print_bridge_url') || 'http://localhost:9100/print';
    
    try {
      const base64Data = btoa(String.fromCharCode.apply(null, Array.from(escPosData)));
      
      const response = await fetch(bridgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          printerName: printer.name,
          dataBase64: base64Data,
          rawBytes: Array.from(escPosData)
        })
      });

      if (!response.ok) {
        throw new Error(`Print Bridge responded with status ${response.status}: ${response.statusText}`);
      }

      printingStatusState = 'Printed successfully via Windows Print Bridge';
      return true;
    } catch (err: any) {
      lastErrorMsg = `Print Bridge connection failed (${bridgeUrl}): ${err.message}. Ensure your local Windows print agent is running.`;
      printingStatusState = 'Error: Print Bridge failed';
      throw new Error(lastErrorMsg);
    }
  }

  throw new Error('Unsupported printer configuration type.');
}
