import { PrinterType, PrinterDevice, PrinterConnectionState, PrinterFontSettings } from './printerTypes';
import { UsbPrinterDriver } from './UsbPrinterDriver';
import { BluetoothPrinterDriver } from './BluetoothPrinterDriver';
import { EscPosFormatter } from './EscPosFormatter';
import { Sale, Product, BusinessConfig } from '../types';

export class ThermalPrinterService {
  private static instance: ThermalPrinterService;
  private usbDriver = new UsbPrinterDriver();
  private btDriver = new BluetoothPrinterDriver();

  private activeType: PrinterType = 'usb';
  private activeDevice: PrinterDevice | null = null;
  private connectionStatus: PrinterConnectionState['status'] = 'disconnected';
  private lastError: string | null = null;
  private listeners: Set<(state: PrinterConnectionState) => void> = new Set();

  private constructor() {
    // Listen for USB device plug/unplug if supported
    if (typeof navigator !== 'undefined' && 'usb' in navigator) {
      try {
        const usbObj = (navigator as any).usb;
        usbObj?.addEventListener?.('connect', () => {
          this.autoConnect().catch(() => {});
        });
        usbObj?.addEventListener?.('disconnect', (event: any) => {
          if (this.activeDevice && this.activeDevice.rawDevice === event?.device) {
            this.disconnect().catch(() => {});
          }
        });
      } catch {
        // Ignore event listener error in environments where not supported
      }
    }
  }

  public static getInstance(): ThermalPrinterService {
    if (!ThermalPrinterService.instance) {
      ThermalPrinterService.instance = new ThermalPrinterService();
    }
    return ThermalPrinterService.instance;
  }

  public subscribe(listener: (state: PrinterConnectionState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(currentState);
      } catch (e) {
        console.error('Printer listener error:', e);
      }
    });
  }

  public async getPairedDevices(): Promise<PrinterDevice[]> {
    const usb = await this.usbDriver.getPairedDevices();
    const bt = await this.btDriver.getPairedDevices();
    return [...usb, ...bt];
  }

  public async autoConnect(): Promise<PrinterDevice | null> {
    if (this.connectionStatus === 'connected' && this.activeDevice) {
      return this.activeDevice;
    }

    try {
      const paired = await this.getPairedDevices();
      if (paired.length > 0) {
        const first = paired[0];
        await this.connect(first);
        return first;
      }
    } catch (err: any) {
      console.warn('Auto-connect to thermal printer skipped:', err);
    }
    return null;
  }

  public async requestDevice(type: PrinterType): Promise<PrinterDevice> {
    this.activeType = type;
    this.lastError = null;
    try {
      if (type === 'usb') {
        const device = await this.usbDriver.requestDevice();
        this.activeDevice = device;
        this.notify();
        return device;
      } else {
        const device = await this.btDriver.requestDevice();
        this.activeDevice = device;
        this.notify();
        return device;
      }
    } catch (err: any) {
      this.lastError = err.message;
      this.notify();
      throw err;
    }
  }

  public async connect(device?: PrinterDevice): Promise<void> {
    if (device) {
      this.activeType = device.type;
      this.activeDevice = device;
    }

    if (!this.activeDevice) {
      throw new Error('No printer device selected.');
    }

    this.connectionStatus = 'connecting';
    this.lastError = null;
    this.notify();

    try {
      if (this.activeType === 'usb') {
        await this.usbDriver.connect(this.activeDevice);
      } else {
        await this.btDriver.connect(this.activeDevice);
      }
      this.connectionStatus = 'connected';
      this.notify();
    } catch (err: any) {
      this.connectionStatus = 'error';
      this.lastError = err.message;
      this.notify();
      throw err;
    }
  }

  public async sendData(data: Uint8Array): Promise<void> {
    if (this.connectionStatus !== 'connected') {
      await this.connect();
    }

    if (this.activeType === 'usb') {
      await this.usbDriver.sendData(data);
    } else {
      await this.btDriver.sendData(data);
    }
  }

  public async testPrint(
    businessConfig?: BusinessConfig | null,
    fontSettings?: PrinterFontSettings
  ): Promise<void> {
    const data = EscPosFormatter.formatTestReceipt(businessConfig, fontSettings);
    await this.sendData(data);
  }

  public async printSale(
    sale: Sale,
    businessConfig?: BusinessConfig | null,
    fontSettings?: PrinterFontSettings
  ): Promise<void> {
    const data = EscPosFormatter.formatSaleReceipt(sale, businessConfig, fontSettings);
    await this.sendData(data);
  }

  public async printBarcodeLabels(
    product: Product,
    copies: number = 1,
    options?: {
      showPrice?: boolean;
      showBusinessName?: boolean;
      businessName?: string;
      currency?: string;
    }
  ): Promise<void> {
    const data = EscPosFormatter.formatBarcodeLabels(product, copies, options);
    await this.sendData(data);
  }

  public async printCatalogBarcodeLabels(
    items: Array<{ product: Product; copies: number }>,
    options?: {
      showPrice?: boolean;
      showBusinessName?: boolean;
      businessName?: string;
      currency?: string;
    }
  ): Promise<void> {
    const data = EscPosFormatter.formatCatalogBarcodeLabels(items, options);
    await this.sendData(data);
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.activeType === 'usb') {
        await this.usbDriver.disconnect();
      } else {
        await this.btDriver.disconnect();
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.connectionStatus = 'disconnected';
      this.activeDevice = null;
      this.notify();
    }
  }

  public getState(): PrinterConnectionState {
    return {
      type: this.activeType,
      status: this.connectionStatus,
      device: this.activeDevice,
      error: this.lastError
    };
  }
}

export const thermalPrinterService = ThermalPrinterService.getInstance();
