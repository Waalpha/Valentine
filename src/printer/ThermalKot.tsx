import React from 'react';
import { RestaurantOrder, BusinessConfig } from '../types';
import { PrinterFontSettings, getStoredFontSettings } from './printerTypes';

interface ThermalKotProps {
  order: RestaurantOrder;
  businessConfig?: BusinessConfig | null;
  fontSettings?: PrinterFontSettings;
}

export function ThermalKot({ order, businessConfig, fontSettings: propsFontSettings }: ThermalKotProps) {
  const settings = propsFontSettings || businessConfig?.printerFontSettings || getStoredFontSettings();
  const businessName = businessConfig?.name || 'Club Paxx';

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

  const fontStyleClass = getFontStyleClass();
  const boldClass = settings.bold ? 'font-bold' : '';
  const italicClass = settings.italic ? 'italic' : 'not-italic';

  return (
    <div
      className={`thermal-receipt-container w-[58mm] max-w-[58mm] bg-white text-black leading-tight p-2 mx-auto shadow-xs rounded-lg border border-gray-300 ${fontStyleClass} text-[11px] ${boldClass} ${italicClass}`}
    >
      {/* Header */}
      <div className="text-center space-y-0.5 mb-2">
        <h1 className="text-xs font-black uppercase tracking-wider text-black">{businessName}</h1>
        <div className="inline-block bg-black text-white text-[9.5px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider">
          BAR ORDER TICKET
        </div>
      </div>

      {/* Meta Information */}
      <div className="border-t border-dashed border-gray-400 pt-1.5 mb-2 text-[10px] space-y-0.5">
        <div className="flex justify-between font-black text-xs text-black">
          <span>Order #:</span>
          <span>#{order.orderNumber}</span>
        </div>
        <div className="flex justify-between font-black text-sm text-black">
          <span>Table:</span>
          <span className="uppercase">{order.tableName}</span>
        </div>
        <div className="flex justify-between text-gray-800">
          <span>Waiter:</span>
          <span className="font-bold">{order.waiterName}</span>
        </div>
        {order.customerName && (
          <div className="flex justify-between text-gray-800">
            <span>Guest:</span>
            <span>{order.customerName}</span>
          </div>
        )}
        <div className="flex justify-between text-gray-700 text-[9px]">
          <span>Time:</span>
          <span>{order.time} ({order.date})</span>
        </div>
        <div className="flex justify-between text-[9px]">
          <span>Bar Status:</span>
          <span className="font-bold uppercase text-amber-900">{order.kitchenStatus}</span>
        </div>
      </div>

      {/* Items Section - Qty x Item */}
      <div className="border-t-2 border-black pt-1.5 mb-2">
        <div className="text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1 flex justify-between">
          <span>Item</span>
          <span>Qty</span>
        </div>
        <div className="space-y-1.5 divide-y divide-dashed divide-gray-300">
          {order.items.map((item, idx) => (
            <div key={idx} className="pt-1 first:pt-0">
              <div className="flex justify-between items-baseline text-xs font-black text-black">
                <span className="truncate pr-1">{item.productName}</span>
                <span className="text-sm font-black shrink-0 px-1 bg-gray-100 rounded">
                  {item.quantity} ×
                </span>
              </div>
              {item.notes && (
                <div className="text-[9px] font-semibold text-gray-800 bg-gray-50 p-1 rounded mt-0.5 border-l-2 border-amber-600">
                  Note: {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* General Special Instructions */}
      {order.notes && (
        <div className="border-t border-dashed border-gray-400 pt-1.5 mb-2 text-[9.5px]">
          <span className="font-bold block text-gray-900">Order Note:</span>
          <p className="bg-amber-50 p-1 rounded border border-amber-200 text-amber-950 font-medium">
            {order.notes}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="border-t-2 border-dashed border-gray-400 pt-1.5 mt-2 text-center text-[8.5px] text-gray-600 space-y-1">
        <p className="font-bold uppercase tracking-wider text-black">*** BAR TICKET — NOT A BILL ***</p>
        <p>Sent to Cashier for Payment</p>
        <p className="font-bold text-[9px] uppercase tracking-wide text-black pt-0.5">
          Powered by Davetech Solutions
        </p>
        <p className="text-[7.5px] text-gray-400">Printed: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
}
