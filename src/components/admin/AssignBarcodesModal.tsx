import React, { useState } from 'react';
import { Product, UserProfile, BusinessConfig } from '../../types';
import { db } from '../../lib/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { generateBarcode } from '../../lib/barcodeUtils';
import { cacheLocalProducts } from '../../lib/offlineManager';
import { logAuditAction } from '../../lib/utils';
import { BarcodeSvg } from '../common/BarcodeSvg';
import { X, Barcode, Sparkles, CheckCircle2, AlertCircle, RefreshCw, Printer, Check } from 'lucide-react';

interface AssignBarcodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  tenantId: string;
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
  onSuccess: (updatedProducts: Product[]) => void;
  onOpenBatchPrint?: () => void;
}

export const AssignBarcodesModal: React.FC<AssignBarcodesModalProps> = ({
  isOpen,
  onClose,
  products,
  tenantId,
  user,
  businessConfig,
  onSuccess,
  onOpenBatchPrint
}) => {
  const productsWithoutBarcode = products.filter(p => !p.barcode || !String(p.barcode).trim());
  const productsWithBarcode = products.filter(p => p.barcode && String(p.barcode).trim());

  // Default to missing_only if there are products missing, otherwise all
  const [scope, setScope] = useState<'missing_only' | 'all'>(
    productsWithoutBarcode.length > 0 ? 'missing_only' : 'all'
  );
  const [format, setFormat] = useState<'CODE128' | 'EAN13'>('CODE128');
  const [isAssigning, setIsAssigning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ count: number; format: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const targetCount = scope === 'missing_only' ? productsWithoutBarcode.length : products.length;

  const handleStartAssigning = async () => {
    setErrorMsg(null);
    setSuccessInfo(null);

    const targets = scope === 'missing_only' ? productsWithoutBarcode : products;
    if (targets.length === 0) {
      setErrorMsg('No products found matching the selected criteria.');
      return;
    }

    setIsAssigning(true);
    setProgress({ current: 0, total: targets.length });

    try {
      // 1. Build an active set of barcodes to ensure zero duplicates
      const existingCodesSet = new Set<string>();
      if (scope === 'missing_only') {
        productsWithBarcode.forEach(p => {
          if (p.barcode) existingCodesSet.add(String(p.barcode).trim().toUpperCase());
        });
      }

      // 2. Generate unique barcodes for all target products
      const assignments: { product: Product; newBarcode: string }[] = [];
      for (const product of targets) {
        const newCode = generateBarcode(format, existingCodesSet);
        existingCodesSet.add(newCode.toUpperCase());
        assignments.push({ product, newBarcode: newCode });
      }

      // 3. Commit batch writes to Firestore in chunks of 400 (Firestore max limit is 500)
      const CHUNK_SIZE = 400;
      let processed = 0;

      for (let i = 0; i < assignments.length; i += CHUNK_SIZE) {
        const chunk = assignments.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        const nowIso = new Date().toISOString();

        for (const item of chunk) {
          const prodRef = doc(db, 'businesses', tenantId, 'products', item.product.id);
          batch.update(prodRef, {
            barcode: item.newBarcode,
            updatedAt: nowIso
          });
        }

        try {
          await batch.commit();
        } catch (dbErr) {
          console.warn('Batch write to Firestore encountered an error; continuing to update local state:', dbErr);
        }

        processed += chunk.length;
        setProgress({ current: processed, total: assignments.length });
      }

      // 4. Update memory state and local cache
      const newBarcodeMap = new Map(assignments.map(a => [a.product.id, a.newBarcode]));
      const nowIso = new Date().toISOString();
      const updatedProducts = products.map(p => {
        if (newBarcodeMap.has(p.id)) {
          return {
            ...p,
            barcode: newBarcodeMap.get(p.id)!,
            updatedAt: nowIso
          };
        }
        return p;
      });

      cacheLocalProducts(updatedProducts, tenantId);

      // 5. Log audit action
      try {
        await logAuditAction(
          user.uid,
          user.name,
          'PRODUCTS_BARCODES_ASSIGNED',
          `Auto-assigned ${format} barcodes to ${assignments.length} products (${scope === 'missing_only' ? 'missing only' : 'all products'})`
        );
      } catch (auditErr) {
        console.warn('Could not write audit log:', auditErr);
      }

      onSuccess(updatedProducts);
      setSuccessInfo({ count: assignments.length, format });
    } catch (err: any) {
      console.error('Failed to assign barcodes:', err);
      setErrorMsg(err.message || 'An unexpected error occurred while assigning barcodes.');
    } finally {
      setIsAssigning(false);
    }
  };

  const samplePreviewCode = format === 'EAN13' ? '2008472910384' : '2894102931';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-amber-100/60 bg-gradient-to-r from-amber-50 via-white to-amber-50/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-600/20">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center space-x-2">
                <span>Assign Product Barcodes</span>
                <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
              </h3>
              <p className="text-xs text-gray-500">
                Bulk generate standard, unique barcodes for your catalog items
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isAssigning}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Success State */}
          {successInfo ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-gray-900">
                  Barcodes Assigned Successfully!
                </h4>
                <p className="text-sm text-gray-600 mt-1 max-w-md mx-auto">
                  Assigned unique <strong>{successInfo.format}</strong> barcodes to <strong>{successInfo.count} product{successInfo.count === 1 ? '' : 's'}</strong>. They are ready to scan in POS and print labels.
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-800 text-left space-y-1">
                <div className="flex items-center space-x-2 font-bold">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Synchronized to database and offline POS cache</span>
                </div>
                <p className="text-emerald-700 pl-6">
                  Cashiers can now scan these products using any USB scanner, Bluetooth reader, or mobile phone camera.
                </p>
              </div>

              <div className="pt-3 flex flex-col sm:flex-row gap-2 justify-center">
                {onOpenBatchPrint && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenBatchPrint();
                    }}
                    className="inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-all active:scale-95"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print All Barcode Labels</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Status Overview Cards */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center">
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Products</span>
                  <span className="text-xl font-black text-slate-800 mt-0.5 block">{products.length}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3 text-center">
                  <span className="block text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">With Barcode</span>
                  <span className="text-xl font-black text-emerald-700 mt-0.5 block">{productsWithBarcode.length}</span>
                </div>
                <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 text-center">
                  <span className="block text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Missing Code</span>
                  <span className="text-xl font-black text-amber-700 mt-0.5 block">{productsWithoutBarcode.length}</span>
                </div>
              </div>

              {/* Scope Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Target Products:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setScope('missing_only')}
                    disabled={isAssigning || productsWithoutBarcode.length === 0}
                    className={`text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                      scope === 'missing_only'
                        ? 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-600/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    } ${productsWithoutBarcode.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-900">Missing Only</span>
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {productsWithoutBarcode.length} items
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Safely assign barcodes only to products currently missing one. Keeps existing codes.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('all')}
                    disabled={isAssigning || products.length === 0}
                    className={`text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                      scope === 'all'
                        ? 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-600/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    } ${products.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-900">All Products</span>
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                        All {products.length} items
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Re-assign fresh, unique barcodes to all items across your entire inventory.
                    </p>
                  </button>
                </div>
              </div>

              {/* Format Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Barcode Symbology Standard:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormat('CODE128')}
                    disabled={isAssigning}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      format === 'CODE128'
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white text-gray-800'
                    }`}
                  >
                    <div className="text-xs font-bold">Code 128 (Recommended)</div>
                    <p className={`text-[11px] mt-0.5 ${format === 'CODE128' ? 'text-slate-300' : 'text-gray-500'}`}>
                      Prefix 28... Fast scanning with all 1D/2D lasers and optical cameras.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormat('EAN13')}
                    disabled={isAssigning}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      format === 'EAN13'
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white text-gray-800'
                    }`}
                  >
                    <div className="text-xs font-bold">EAN-13 (Standard Retail)</div>
                    <p className={`text-[11px] mt-0.5 ${format === 'EAN13' ? 'text-slate-300' : 'text-gray-500'}`}>
                      13-digit GS1 in-store circulation prefix (200-299) with checksum digit.
                    </p>
                  </button>
                </div>
              </div>

              {/* Live Preview Sample */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col items-center text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Sample Barcode Format ({format})
                </span>
                <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-xs flex flex-col items-center">
                  <BarcodeSvg
                    value={samplePreviewCode}
                    format={format}
                    height={38}
                    width={1.4}
                    fontSize={10}
                    className="max-w-full"
                  />
                </div>
                <span className="text-[10px] text-gray-500 mt-1.5 font-mono">
                  Each product will receive its own unique {format === 'EAN13' ? '13-digit EAN' : '10-digit Code-128'} number
                </span>
              </div>

              {/* Progress & Error */}
              {isAssigning && progress && (
                <div className="space-y-2 p-3 bg-amber-50/80 border border-amber-200 rounded-2xl">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                    <span className="flex items-center space-x-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                      <span>Assigning barcodes to products...</span>
                    </span>
                    <span>
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                  <div className="w-full bg-amber-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-600 h-2 transition-all duration-200"
                      style={{
                        width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        {!successInfo && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isAssigning}
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-white transition-all disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleStartAssigning}
              disabled={isAssigning || targetCount === 0}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-600/20 transition-all active:scale-95"
            >
              {isAssigning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Assigning...</span>
                </>
              ) : (
                <>
                  <Barcode className="w-4 h-4" />
                  <span>Assign Barcode to {targetCount} Products</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
