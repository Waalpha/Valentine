import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw, AlertCircle, Volume2, CheckCircle2 } from 'lucide-react';
import { posAudio } from '../../lib/barcodeUtils';

interface CameraBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedBarcode: string) => void;
  title?: string;
}

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Product Barcode'
}) => {
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'dvt-pos-camera-scanner-view';
  const isScanningRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsInitializing(true);
    setPermissionError(null);
    setLastScanned(null);

    const startScanner = async () => {
      try {
        // Formats to support for professional retail
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.QR_CODE
        ];

        const html5QrCode = new Html5Qrcode(scannerContainerId, {
          formatsToSupport,
          verbose: false
        });
        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const width = Math.floor(Math.min(viewfinderWidth * 0.85, 320));
            const height = Math.floor(Math.min(viewfinderHeight * 0.65, 180));
            return { width, height };
          },
          aspectRatio: 1.333334
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (!isMounted) return;
            const cleanCode = decodedText.trim();
            if (cleanCode) {
              setLastScanned(cleanCode);
              posAudio.playSuccessBeep();
              onScan(cleanCode);
            }
          },
          () => {
            // Ignore ongoing frame decode misses
          }
        );

        if (isMounted) {
          isScanningRef.current = true;
          setIsInitializing(false);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setIsInitializing(false);
        const errMsg = err?.message || String(err);
        if (
          errMsg.includes('NotAllowedError') ||
          errMsg.includes('Permission') ||
          errMsg.includes('denied')
        ) {
          setPermissionError(
            'Camera permission was denied. Please allow camera access in your browser settings to scan barcodes directly.'
          );
        } else if (errMsg.includes('NotFoundError') || errMsg.includes('DevicesNotFoundError')) {
          setPermissionError('No camera found on this device. You can still use a USB/Bluetooth barcode scanner or manual entry.');
        } else {
          setPermissionError(`Camera initialization error: ${errMsg}`);
        }
      }
    };

    // Small delay to ensure DOM container is rendered
    const timer = setTimeout(() => {
      startScanner();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          if (isScanningRef.current) {
            isScanningRef.current = false;
            scannerRef.current.stop().then(() => {
              scannerRef.current?.clear();
            }).catch(() => {});
          } else {
            scannerRef.current.clear();
          }
        } catch (e) {
          // ignore cleanup errors
        }
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="text-[11px] text-slate-400">Position barcode within the frame</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport / Error State */}
        <div className="p-4 flex-1 flex flex-col items-center justify-center">
          {permissionError ? (
            <div className="text-center p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/30">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">Camera Access Notice</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{permissionError}</p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700"
              >
                Close & Use Manual / USB Scan
              </button>
            </div>
          ) : (
            <div className="w-full relative flex flex-col items-center">
              {isInitializing && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/90 rounded-2xl">
                  <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-2" />
                  <p className="text-xs text-slate-300 font-medium">Starting camera sensor...</p>
                </div>
              )}

              <div
                id={scannerContainerId}
                className="w-full rounded-2xl overflow-hidden bg-black border-2 border-slate-700 shadow-inner min-h-[240px]"
              />

              {/* Aiming guidelines indicator */}
              <div className="mt-3 flex items-center justify-center space-x-2 text-[11px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Supports Code 128, EAN-13, UPC, Code 39 & QR</span>
              </div>
            </div>
          )}

          {/* Last scanned banner */}
          {lastScanned && (
            <div className="mt-3 w-full p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Detected: <strong className="font-mono text-white">{lastScanned}</strong></span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">Added</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">
            Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-mono text-[10px]">ESC</kbd> to exit
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all border border-slate-700 cursor-pointer"
          >
            Done Scanning
          </button>
        </div>
      </div>
    </div>
  );
};
