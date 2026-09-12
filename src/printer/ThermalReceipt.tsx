import React from 'react';
import { Sale, BusinessConfig } from '../types';
import { formatCurrency } from '../lib/utils';
import { PrinterFontSettings, getStoredFontSettings } from './printerTypes';

interface ThermalReceiptProps {
  sale: Sale;
  businessConfig?: BusinessConfig | null;
  fontSettings?: PrinterFontSettings;
}

export function ThermalReceipt({ sale, businessConfig, fontSettings: propsFontSettings }: ThermalReceiptProps) {
  const settings = propsFontSettings || businessConfig?.printerFontSettings || getStoredFontSettings();

  const currency = businessConfig?.currency || 'KSh';
  const businessName = businessConfig?.name || 'Club Valentine';
  const address = businessConfig?.address || 'Nairobi CBD';
  const phone = businessConfig?.phone || '+254 712 345 678';
  const footer = businessConfig?.receiptFooter || 'Thank you! Please drink responsibly.';

  const subtotal = sale.totalAmount;

  // Resolve font style class
  const getFontStyleClass = () => {
    switch (settings.fontStyle) {
      case 'sans':
        return 'font-sans';
      case 'serif':
        return 'font-serif';
      case 'condensed':
        return 'font-mono tracking-tighter';
      case 'monospace':
      default:
        return 'font-mono tracking-normal';
    }
  };

  // Resolve font size classes
  const getFontSizeConfig = () => {
    switch (settings.fontSize) {
      case 'small':
        return {
          container: 'text-[9.5px]',
          header: 'text-[11px]',
          meta: 'text-[8.5px]',
          table: 'text-[8.5px]',
          total: 'text-[11px]',
          footer: 'text-[8.5px]'
        };
      case 'large':
        return {
          container: 'text-[12.5px]',
          header: 'text-[15px]',
          meta: 'text-[11.5px]',
          table: 'text-[11.5px]',
          total: 'text-[14px]',
          footer: 'text-[11px]'
        };
      case 'normal':
      default:
        return {
          container: 'text-[11px]',
          header: 'text-xs',
          meta: 'text-[10px]',
          table: 'text-[10px]',
          total: 'text-xs',
          footer: 'text-[9.5px]'
        };
    }
  };

  const fontStyleClass = getFontStyleClass();
  const fontSizes = getFontSizeConfig();
  const boldClass = settings.bold ? 'font-bold' : '';
  const italicClass = settings.italic ? 'italic' : 'not-italic';

  return (
    <div
      className={`thermal-receipt-container w-[58mm] max-w-[58mm] bg-white text-black leading-tight p-2 mx-auto shadow-xs rounded-lg border border-gray-200 ${fontStyleClass} ${fontSizes.container} ${boldClass} ${italicClass}`}
    >
      {/* Header Section */}
      <div className="text-center space-y-0.5 mb-2">
        <h1 className={`${fontSizes.header} font-bold uppercase tracking-wider`}>{businessName}</h1>
        <p className={`${fontSizes.meta} text-gray-700`}>{address}</p>
        <p className={`${fontSizes.meta} text-gray-700`}>Tel: {phone}</p>
      </div>

      {/* Meta Information */}
      <div className={`border-t border-dashed border-gray-400 pt-1.5 mb-2 ${fontSizes.meta} space-y-0.5`}>
        <div className="flex justify-between">
          <span className="text-gray-600">Receipt:</span>
          <span className="font-bold">#{sale.id.slice(-8).toUpperCase()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Date:</span>
          <span>{sale.date} {sale.time}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Cashier:</span>
          <span>{sale.cashierName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Payment:</span>
          <span className="font-bold text-emerald-800">{sale.paymentMethod}</span>
        </div>
        {sale.referenceCode && (
          <div className="flex justify-between">
            <span className="text-gray-600">Ref Code:</span>
            <span>{sale.referenceCode}</span>
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="border-t border-dashed border-gray-400 pt-1.5 mb-2">
        <table className={`w-full text-left ${fontSizes.table}`}>
          <thead>
            <tr className="border-b border-gray-400 pb-0.5 text-gray-700">
              <th className="font-semibold pb-0.5">Item</th>
              <th className="text-center font-semibold pb-0.5">Qty</th>
              <th className="text-right font-semibold pb-0.5">Price</th>
              <th className="text-right font-semibold pb-0.5">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dotted divide-gray-300">
            {sale.items.map((item, idx) => (
              <tr key={idx} className="py-0.5">
                <td className="pr-1 font-medium text-gray-900 truncate max-w-[20mm]">{item.productName}</td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-right">{item.unitPrice}</td>
                <td className="text-right font-bold">{item.totalAmount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals Section */}
      <div className={`border-t border-dashed border-gray-400 pt-1.5 space-y-0.5 ${fontSizes.meta}`}>
        <div className="flex justify-between text-gray-700">
          <span>Subtotal:</span>
          <span>{formatCurrency(subtotal, currency)}</span>
        </div>
        <div className={`flex justify-between ${fontSizes.total} font-bold text-gray-900 pt-1 border-t border-gray-400`}>
          <span>TOTAL:</span>
          <span>{formatCurrency(sale.totalAmount, currency)}</span>
        </div>
        {sale.amountTendered !== undefined && sale.amountTendered > 0 && (
          <div className="flex justify-between text-gray-700 pt-0.5">
            <span>Tendered:</span>
            <span>{formatCurrency(sale.amountTendered, currency)}</span>
          </div>
        )}
        {sale.change !== undefined && sale.change > 0 && (
          <div className="flex justify-between font-bold text-emerald-800">
            <span>Change:</span>
            <span>{formatCurrency(sale.change, currency)}</span>
          </div>
        )}
      </div>

      {/* Footer Section */}
      <div className={`border-t border-dashed border-gray-400 pt-2.5 mt-2 text-center ${fontSizes.footer} text-gray-700 space-y-0.5`}>
        <p className="font-semibold">{footer}</p>
        <p className="text-[8px] tracking-wider text-gray-500">
          {settings.fontStyle.toUpperCase()} • {settings.fontSize.toUpperCase()}
          {settings.bold ? ' • BOLD' : ''}
          {settings.italic ? ' • ITALIC' : ''}
        </p>
      </div>
    </div>
  );
}
