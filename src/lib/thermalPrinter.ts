import { Sale, BusinessConfig } from '../types';
import { formatCurrency } from './utils';

export interface PrinterDevice {
  name: string;
  type: 'browser_print' | 'serial' | 'usb';
  id?: string;
  baudRate?: number;
}

export interface PrinterDiagnosticInfo {
  browserPrintSupported: boolean;
  serialSupported: boolean;
  usbSupported: boolean;
  printerDetected: string;
  connectionStatus: string;
  printingStatus: string;
  lastError: string;
}

let lastErrorMsg = '';
let printingStatusState = 'Idle';

export function getPrinterDiagnostics(): PrinterDiagnosticInfo {
  const nav = navigator as any;
  const saved = getSavedPrinter();
  return {
    browserPrintSupported: true,
    serialSupported: !!nav.serial,
    usbSupported: !!nav.usb,
    printerDetected: saved ? saved.name : 'Browser Direct Print (Windows Printer Queue)',
    connectionStatus: saved ? `Active: ${saved.name}` : 'Ready (Browser Print)',
    printingStatus: printingStatusState,
    lastError: lastErrorMsg
  };
}

export function getSavedPrinter(): PrinterDevice | null {
  try {
    const saved = localStorage.getItem('bar_pos_saved_printer');
    return saved ? JSON.parse(saved) : { name: 'Windows / P58E Thermal Printer (Direct)', type: 'browser_print' };
  } catch (e) {
    return { name: 'Windows / P58E Thermal Printer (Direct)', type: 'browser_print' };
  }
}

export function savePrinter(printer: PrinterDevice): void {
  localStorage.setItem('bar_pos_saved_printer', JSON.stringify(printer));
}

export function clearSavedPrinter(): void {
  localStorage.removeItem('bar_pos_saved_printer');
}

export async function connectSerialPrinter(): Promise<PrinterDevice> {
  const nav = navigator as any;
  if (!nav.serial) {
    throw new Error('Web Serial API is not supported in this browser. Please use Chrome or Edge.');
  }

  try {
    const port = await nav.serial.requestPort();
    await port.open({ baudRate: 9600 });

    const printerInfo: PrinterDevice = {
      name: 'Bluetooth SPP / Serial Printer (P58E)',
      type: 'serial',
      baudRate: 9600
    };

    savePrinter(printerInfo);
    return printerInfo;
  } catch (err: any) {
    lastErrorMsg = err.message || 'Failed to connect serial printer';
    throw new Error(lastErrorMsg);
  }
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

export function setBrowserPrintDefault(): PrinterDevice {
  const printerInfo: PrinterDevice = {
    name: 'Windows / P58E Thermal Printer (Direct)',
    type: 'browser_print'
  };
  savePrinter(printerInfo);
  return printerInfo;
}

export async function printToThermalPrinter(sale: Sale, businessConfig?: BusinessConfig | null): Promise<boolean> {
  printingStatusState = 'Preparing receipt...';
  lastErrorMsg = '';

  const printer = getSavedPrinter() || { name: 'Windows / P58E Thermal Printer (Direct)', type: 'browser_print' };

  // If browser print or fallback
  if (printer.type === 'browser_print' || !printer.type) {
    printingStatusState = 'Opening print dialog...';
    
    // Create printable receipt container
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) {
      throw new Error('Pop-up blocked. Please allow pop-ups to print receipts.');
    }

    const businessName = businessConfig?.name || 'Club Valentine';
    const address = businessConfig?.address || 'Nairobi CBD';
    const phone = businessConfig?.phone || '+254 712 345 678';
    const footer = businessConfig?.receiptFooter || 'Thank you! Please drink responsibly.';
    const currency = businessConfig?.currency || 'KSh';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${sale.id.slice(-8).toUpperCase()}</title>
          <style>
            @page {
              size: 58mm auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 58mm;
              margin: 0 auto;
              padding: 4mm;
              font-size: 11px;
              color: #000;
              background: #fff;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-bottom: 1px dashed #000; margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { text-align: left; padding: 2px 0; font-size: 11px; }
            th { border-bottom: 1px dashed #000; }
            .right { text-align: right; }
            .center-col { text-align: center; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 13px;">${businessName.toUpperCase()}</div>
          <div class="center">${address}</div>
          <div class="center">Tel: ${phone}</div>
          <div class="line"></div>
          <div>Receipt #: ${sale.id.slice(-8).toUpperCase()}</div>
          <div>Date: ${sale.date} ${sale.time}</div>
          <div>Cashier: ${sale.cashierName}</div>
          <div>Payment: ${sale.paymentMethod}</div>
          <div class="line"></div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="center-col">Qty</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${sale.items.map(item => `
                <tr>
                  <td>${item.productName}</td>
                  <td class="center-col">${item.quantity}</td>
                  <td class="right">${item.totalAmount}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="line"></div>
          <div class="bold" style="font-size: 12px; display: flex; justify-content: space-between;">
            <span>TOTAL:</span>
            <span>${currency} ${sale.totalAmount}</span>
          </div>
          ${sale.amountTendered ? `
            <div style="display: flex; justify-content: space-between;">
              <span>Paid:</span>
              <span>${currency} ${sale.amountTendered}</span>
            </div>
          ` : ''}
          ${sale.change ? `
            <div style="display: flex; justify-content: space-between;">
              <span>Change:</span>
              <span>${currency} ${sale.change}</span>
            </div>
          ` : ''}
          ${sale.referenceCode ? `<div>Ref: ${sale.referenceCode}</div>` : ''}
          <div class="line"></div>
          <div class="center" style="margin-top: 6px;">${footer}</div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    printingStatusState = 'Print dialog opened successfully';
    return true;
  }

  throw new Error('Unsupported printer type.');
}
