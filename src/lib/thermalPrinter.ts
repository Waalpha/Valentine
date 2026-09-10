import { Sale, BusinessConfig } from '../types';
import { formatCurrency } from './utils';

export interface PrinterDevice {
  name: string;
  type: 'bluetooth' | 'usb';
  id?: string;
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

export async function connectBluetoothPrinter(): Promise<PrinterDevice> {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or an Android browser.');
  }

  try {
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', // Common thermal printer service UUID
        '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile (SPP)
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455'
      ]
    });

    const printerInfo: PrinterDevice = {
      name: device.name || 'Bluetooth Thermal Printer',
      type: 'bluetooth',
      id: device.id
    };

    localStorage.setItem('bar_pos_saved_printer', JSON.stringify(printerInfo));
    return printerInfo;
  } catch (err: any) {
    throw new Error(err.message || 'Failed to connect Bluetooth printer');
  }
}

export async function connectUsbPrinter(): Promise<PrinterDevice> {
  const nav = navigator as any;
  if (!nav.usb) {
    throw new Error('Web USB is not supported in this browser.');
  }

  try {
    const device = await nav.usb.requestDevice({ filters: [] });
    await device.open();
    if (device.configuration === null && device.configurations.length > 0) {
      await device.selectConfiguration(device.configurations[0].configurationValue);
    }
    try {
      await device.claimInterface(0);
    } catch (e) {
      // Ignore if already claimed
    }

    const printerInfo: PrinterDevice = {
      name: device.productName || 'USB Thermal Printer',
      type: 'usb',
      id: String(device.serialNumber || device.vendorId)
    };

    localStorage.setItem('bar_pos_saved_printer', JSON.stringify(printerInfo));
    return printerInfo;
  } catch (err: any) {
    throw new Error(err.message || 'Failed to connect USB printer');
  }
}

export function getSavedPrinter(): PrinterDevice | null {
  try {
    const saved = localStorage.getItem('bar_pos_saved_printer');
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

export function clearSavedPrinter(): void {
  localStorage.removeItem('bar_pos_saved_printer');
}

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

export async function printToThermalPrinter(sale: Sale, businessConfig?: BusinessConfig | null): Promise<boolean> {
  const printer = getSavedPrinter();
  if (!printer) {
    throw new Error('No thermal printer paired. Please pair a Bluetooth or USB printer in Settings or the print dialog.');
  }

  const escPosData = generateReceiptEscPos(sale, businessConfig);
  const nav = navigator as any;

  if (printer.type === 'bluetooth') {
    if (!nav.bluetooth) throw new Error('Web Bluetooth not supported.');
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '00001101-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455'
      ]
    });
    const server = await device.gatt?.connect();
    if (!server) throw new Error('Could not connect to Bluetooth printer GATT server.');

    let characteristic: any = null;
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const c of characteristics) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            characteristic = c;
            break;
          }
        }
      } catch (e) {
        // ignore
      }
      if (characteristic) break;
    }

    if (!characteristic) {
      throw new Error('Could not find writable characteristic on Bluetooth printer.');
    }

    const chunkSize = 512;
    for (let i = 0; i < escPosData.length; i += chunkSize) {
      const chunk = escPosData.slice(i, i + chunkSize);
      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
    }
    return true;
  } else if (printer.type === 'usb') {
    if (!nav.usb) throw new Error('Web USB not supported.');
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

    await device.transferOut(endpointOut, escPosData);
    return true;
  }

  throw new Error('Unknown printer type');
}
