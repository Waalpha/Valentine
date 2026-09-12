import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  X,
  Camera,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Zap,
  ZapOff,
  ZoomIn,
  ZoomOut,
  SwitchCamera,
  Upload,
  Search,
  ShoppingCart,
  Sparkles,
  ExternalLink,
  Volume2,
  VolumeX,
  SlidersHorizontal
} from 'lucide-react';
import { posAudio, ScannerTonePreset } from '../../lib/barcodeUtils';
import { Product } from '../../types';

export interface CameraBarcodeScannerProps {
  isOpen?: boolean;
  onClose: () => void;
  onScan?: (decodedBarcode: string) => void;
  onScanSuccess?: (decodedBarcode: string) => void;
  title?: string;
  cartCount?: number;
  cartTotal?: number;
  currency?: string;
  allProducts?: Product[];
}

interface CameraInfo {
  id: string;
  label: string;
}

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  isOpen = true,
  onClose,
  onScan,
  onScanSuccess,
  title = 'Scan Product Barcode',
  cartCount,
  cartTotal,
  currency = 'KSh',
  allProducts = []
}) => {
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [lastScanned, setLastScanned] = useState<{
    code: string;
    product?: Product;
    time: Date;
  } | null>(null);
  const [continuousMode, setContinuousMode] = useState(true);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isZoomSupported, setIsZoomSupported] = useState(false);
  const [isSuccessFlash, setIsSuccessFlash] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [manualInputError, setManualInputError] = useState<string | null>(null);
  const [scannerTone, setScannerTone] = useState<ScannerTonePreset>(() => posAudio.getTone());
  const [scannerFreq, setScannerFreq] = useState<number>(() => posAudio.getFrequency());
  const [isMuted, setIsMuted] = useState<boolean>(() => posAudio.getIsMuted());
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const [isSoundPulse, setIsSoundPulse] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'dvt-pos-camera-scanner-view';
  const isScanningRef = useRef(false);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeDetectorLoopRef = useRef<number | null>(null);

  // Unify onScan and onScanSuccess callbacks
  const dispatchScan = useCallback(
    (code: string) => {
      const cleanCode = code.trim();
      if (!cleanCode) return;

      if (onScan) {
        onScan(cleanCode);
      }
      if (onScanSuccess) {
        onScanSuccess(cleanCode);
      }
    },
    [onScan, onScanSuccess]
  );

  // Handle successful barcode decode with cooldown and sensory feedback
  const handleDecoded = useCallback(
    (rawCode: string) => {
      const cleanCode = String(rawCode || '').trim();
      if (!cleanCode) return;

      const now = Date.now();
      // If same code scanned within 1200ms, ignore to avoid accidental duplicate scans
      if (cleanCode === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 1200) {
        return;
      }

      lastScannedTimeRef.current = now;
      lastScannedCodeRef.current = cleanCode;

      // Find matching product in catalog
      const matched = allProducts.find(
        (p) =>
          (p.barcode && String(p.barcode).trim().toLowerCase() === cleanCode.toLowerCase()) ||
          p.id.toLowerCase() === cleanCode.toLowerCase()
      );

      setLastScanned({
        code: cleanCode,
        product: matched,
        time: new Date()
      });

      // Sensory feedback (Authentic Supermarket High Tone Beep)
      posAudio.playSuccessBeep(scannerTone);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(80);
        } catch {
          // ignore
        }
      }

      setIsSuccessFlash(true);
      setTimeout(() => setIsSuccessFlash(false), 600);

      // Dispatch to parent handler
      dispatchScan(cleanCode);

      // If continuous mode is disabled, close modal immediately
      if (!continuousMode) {
        setTimeout(() => {
          onClose();
        }, 400);
      }
    },
    [allProducts, continuousMode, dispatchScan, onClose]
  );

  // Start hardware scanner
  const startScanner = useCallback(
    async (targetCameraId?: string) => {
      setIsInitializing(true);
      setPermissionError(null);

      try {
        // Stop any existing scanner instance
        if (scannerRef.current) {
          try {
            if (isScanningRef.current) {
              isScanningRef.current = false;
              await scannerRef.current.stop();
            }
            scannerRef.current.clear();
          } catch {
            // ignore
          }
        }

        // Check mediaDevices support
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error(
            'Camera API is not supported in this browser. Please use Chrome, Safari, or a modern browser over HTTPS.'
          );
        }

        // Query available camera devices if not yet done
        let availableCameras = cameras;
        if (availableCameras.length === 0) {
          try {
            const detected = await Html5Qrcode.getCameras();
            if (detected && detected.length > 0) {
              availableCameras = detected.map((c) => ({ id: c.id, label: c.label || 'Camera' }));
              setCameras(availableCameras);
            }
          } catch {
            // Camera enumeration might be restricted before permission is granted
          }
        }

        // Formats to support for professional retail
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE
        ];

        const html5QrCode = new Html5Qrcode(scannerContainerId, {
          formatsToSupport,
          verbose: false,
          useBarCodeDetectorIfSupported: true,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        });
        scannerRef.current = html5QrCode;

        // Configuration optimized for mobile phone 1D and 2D barcodes
        const config = {
          fps: 20, // 20 frames/sec for rapid barcode capture
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            // Generous wide horizontal framing suited for 1D bar strips (Code 128 / EAN 13)
            const w = Math.min(Math.floor(viewfinderWidth * 0.92), 460);
            const h = Math.min(Math.floor(viewfinderHeight * 0.72), 260);
            return { width: Math.max(w, 240), height: Math.max(h, 150) };
          },
          aspectRatio: 1.333334,
          disableFlip: false,
          videoConstraints: {
            facingMode: !targetCameraId ? 'environment' : undefined,
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 }
          }
        };

        // Determine camera target: specific camera ID, or environment facing mode
        let cameraTarget: any = { facingMode: 'environment' };

        if (targetCameraId) {
          cameraTarget = targetCameraId;
        } else if (availableCameras.length > 0) {
          // Find the best back camera
          const backCamIndex = availableCameras.findIndex((c) => {
            const lbl = c.label.toLowerCase();
            return (
              (lbl.includes('back') || lbl.includes('rear') || lbl.includes('environment')) &&
              !lbl.includes('wide') &&
              !lbl.includes('ultra')
            );
          });
          const initialIndex = backCamIndex !== -1 ? backCamIndex : 0;
          setSelectedCameraIndex(initialIndex);
          cameraTarget = availableCameras[initialIndex].id;
        }

        await html5QrCode.start(
          cameraTarget,
          config,
          (decodedText) => {
            handleDecoded(decodedText);
          },
          () => {
            // Ongoing frame misses are normal during active scanning
          }
        );

        isScanningRef.current = true;
        setIsInitializing(false);

        // Detect capabilities (Torch, Zoom) from active video track
        setTimeout(() => {
          try {
            const videoEl = document.querySelector(
              `#${scannerContainerId} video`
            ) as HTMLVideoElement | null;
            if (videoEl) {
              videoEl.setAttribute('playsinline', 'true');
              videoEl.setAttribute('webkit-playsinline', 'true');
              const stream = videoEl.srcObject as MediaStream | null;
              const track = stream?.getVideoTracks()[0];
              if (track) {
                const capabilities = (track.getCapabilities?.() as any) || {};
                if (capabilities.torch) {
                  setIsTorchSupported(true);
                }
                if (capabilities.zoom) {
                  setIsZoomSupported(true);
                }
              }
            }
          } catch {
            // ignore
          }
        }, 600);

        // Native BarcodeDetector parallel loop for ultra-fast native hardware decoding
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const BarcodeDetectorClass = (window as any).BarcodeDetector;
            const supported = await BarcodeDetectorClass.getSupportedFormats();
            const wantedFormats = [
              'code_128',
              'ean_13',
              'upc_a',
              'upc_e',
              'code_39',
              'ean_8',
              'qr_code'
            ].filter((f) => supported.includes(f));

            if (wantedFormats.length > 0) {
              const nativeDetector = new BarcodeDetectorClass({ formats: wantedFormats });
              const intervalId = window.setInterval(async () => {
                if (!isScanningRef.current) return;
                const videoEl = document.querySelector(
                  `#${scannerContainerId} video`
                ) as HTMLVideoElement | null;
                if (!videoEl || videoEl.readyState < 2) return;
                try {
                  const barcodes = await nativeDetector.detect(videoEl);
                  if (barcodes && barcodes.length > 0) {
                    const first = barcodes[0]?.rawValue;
                    if (first) {
                      handleDecoded(first);
                    }
                  }
                } catch {
                  // ignore frame read errors
                }
              }, 120);
              nativeDetectorLoopRef.current = intervalId;
            }
          } catch {
            // Native BarcodeDetector not available or restricted, html5-qrcode works as primary
          }
        }
      } catch (err: any) {
        setIsInitializing(false);
        const errMsg = err?.message || String(err);
        if (
          errMsg.includes('NotAllowedError') ||
          errMsg.includes('Permission') ||
          errMsg.includes('denied')
        ) {
          setPermissionError(
            'Camera permission was denied. Please allow camera access in your browser settings (tap the lock/tune icon near your address bar) and tap "Retry Camera".'
          );
        } else if (errMsg.includes('NotFoundError') || errMsg.includes('DevicesNotFoundError')) {
          setPermissionError(
            'No camera sensor was detected on this device. You can still use manual entry or snap a photo of the barcode below.'
          );
        } else if (errMsg.includes('NotReadableError') || errMsg.includes('OverconstrainedError')) {
          setPermissionError(
            'Camera is currently in use by another app, or device resolution constraint failed. Tap "Retry Camera" to switch lenses.'
          );
        } else {
          setPermissionError(`Camera initialization error: ${errMsg}`);
        }
      }
    },
    [cameras, handleDecoded]
  );

  // Lifecycle initialization
  useEffect(() => {
    if (!isOpen) return;

    // Pre-warm / unlock Web Audio API on mobile user gesture
    posAudio.unlock();

    const timer = setTimeout(() => {
      startScanner();
    }, 120);

    return () => {
      clearTimeout(timer);
      if (nativeDetectorLoopRef.current) {
        clearInterval(nativeDetectorLoopRef.current);
        nativeDetectorLoopRef.current = null;
      }
      if (scannerRef.current) {
        try {
          if (isScanningRef.current) {
            isScanningRef.current = false;
            scannerRef.current
              .stop()
              .then(() => {
                scannerRef.current?.clear();
              })
              .catch(() => {});
          } else {
            scannerRef.current.clear();
          }
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [isOpen]);

  // Switch between back/front or multiple rear cameras (wide vs standard)
  const handleSwitchCamera = async () => {
    if (cameras.length <= 1) {
      // Re-enumerate or toggle facing mode
      try {
        const detected = await Html5Qrcode.getCameras();
        if (detected && detected.length > 1) {
          const formatted = detected.map((c) => ({ id: c.id, label: c.label || 'Camera' }));
          setCameras(formatted);
          const nextIdx = (selectedCameraIndex + 1) % formatted.length;
          setSelectedCameraIndex(nextIdx);
          startScanner(formatted[nextIdx].id);
          return;
        }
      } catch {
        // ignore
      }
      return;
    }

    const nextIndex = (selectedCameraIndex + 1) % cameras.length;
    setSelectedCameraIndex(nextIndex);
    startScanner(cameras[nextIndex].id);
  };

  // Toggle Torch/Flashlight
  const handleToggleTorch = async () => {
    try {
      const videoEl = document.querySelector(
        `#${scannerContainerId} video`
      ) as HTMLVideoElement | null;
      const stream = videoEl?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()[0];
      if (track) {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setIsTorchOn(nextState);
      }
    } catch {
      // torch error
    }
  };

  // Toggle Digital Zoom (1x vs 2x)
  const handleToggleZoom = async () => {
    try {
      const videoEl = document.querySelector(
        `#${scannerContainerId} video`
      ) as HTMLVideoElement | null;
      const stream = videoEl?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()[0];
      if (track) {
        const nextZoom = zoomLevel === 1 ? 2 : 1;
        await (track as any).applyConstraints({
          advanced: [{ zoom: nextZoom }]
        });
        setZoomLevel(nextZoom);
      }
    } catch {
      // zoom error
    }
  };

  // File / Snapshot upload fallback
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !scannerRef.current) return;

    setIsInitializing(true);
    try {
      const decoded = await scannerRef.current.scanFile(file, true);
      if (decoded) {
        handleDecoded(decoded);
      }
    } catch {
      posAudio.playErrorBeep();
      setManualInputError('Could not detect barcode in that image. Please try a clearer photo.');
      setTimeout(() => setManualInputError(null), 4000);
    } finally {
      setIsInitializing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Manual Barcode Submission fallback
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualInput.trim();
    if (!clean) return;

    handleDecoded(clean);
    setManualInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2.5 sm:p-4 backdrop-blur-md">
      <div className="w-full max-w-lg bg-slate-900 rounded-3xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header with Title and Quick Stats */}
        <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white">{title}</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                  Live Scanner
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Position barcode inside frame</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Continuous Mode Toggle */}
            <button
              type="button"
              onClick={() => setContinuousMode(!continuousMode)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all flex items-center space-x-1.5 cursor-pointer ${
                continuousMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title={
                continuousMode
                  ? 'Continuous scan is active (keeps camera open for consecutive items)'
                  : 'Single scan mode (closes after 1 scan)'
              }
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xs:inline">
                {continuousMode ? 'Multi-Scan' : '1x Scan'}
              </span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Cart Header Summary (when in POS Cashier context) */}
        {cartCount != null && cartCount > 0 && (
          <div className="bg-amber-600/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-amber-300">
              <ShoppingCart className="w-4 h-4 text-amber-400" />
              <span className="font-semibold">
                Current Cart:{' '}
                <strong className="text-white font-bold">
                  {cartCount} item{cartCount === 1 ? '' : 's'}
                </strong>
              </span>
            </div>
            {cartTotal != null && (
              <span className="font-mono font-bold text-amber-400 text-xs">
                {currency} {cartTotal.toLocaleString()}
              </span>
            )}
          </div>
        )}

        {/* Main Viewport */}
        <div className="p-3 sm:p-4 flex-1 flex flex-col items-center justify-center overflow-y-auto">
          {permissionError ? (
            /* Permission / Hardware Error Box */
            <div className="text-center p-6 space-y-4 max-w-sm">
              <div className="w-14 h-14 rounded-3xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/40 shadow-lg shadow-red-900/20">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Camera Access Required</h4>
                <p className="text-xs text-slate-300 leading-relaxed mt-1.5">{permissionError}</p>
              </div>

              {/* Troubleshooting Tips */}
              <div className="bg-slate-950/80 rounded-2xl p-3 border border-slate-800 text-left text-[11px] text-slate-400 space-y-1.5">
                <p className="font-bold text-slate-200">How to fix in mobile browser:</p>
                <p>• Chrome / Android: Tap the lock/tune icon near URL ➔ Permissions ➔ Camera ➔ Allow</p>
                <p>• Safari / iPhone: Tap "aA" in address bar ➔ Website Settings ➔ Camera ➔ Allow</p>
                <p>• Ensure no other app (e.g. WhatsApp, Camera) is actively locking your lens</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => startScanner()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Take / Upload Photo</span>
                </button>
              </div>
            </div>
          ) : (
            /* Live Camera Feed & Interactive Viewfinder */
            <div className="w-full relative flex flex-col items-center">
              {/* Camera Controls Bar (Switch Camera, Torch, Zoom) */}
              <div className="w-full mb-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5">
                  {/* Camera Switcher */}
                  <button
                    type="button"
                    onClick={handleSwitchCamera}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold transition-all cursor-pointer text-xs"
                    title="Switch between front/back or wide/standard lenses"
                  >
                    <SwitchCamera className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {cameras.length > 1
                        ? `Lens (${selectedCameraIndex + 1}/${cameras.length})`
                        : 'Switch Lens'}
                    </span>
                  </button>

                  {/* Flashlight / Torch button */}
                  {isTorchSupported && (
                    <button
                      type="button"
                      onClick={handleToggleTorch}
                      className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        isTorchOn
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                          : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                      title="Toggle Torch / Flashlight"
                    >
                      {isTorchOn ? <Zap className="w-3.5 h-3.5 fill-current" /> : <ZapOff className="w-3.5 h-3.5" />}
                      <span className="hidden xs:inline">{isTorchOn ? 'Torch On' : 'Torch'}</span>
                    </button>
                  )}

                  {/* Zoom button */}
                  {isZoomSupported && (
                    <button
                      type="button"
                      onClick={handleToggleZoom}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                      title="Toggle 1x / 2x zoom"
                    >
                      {zoomLevel === 1 ? <ZoomIn className="w-3.5 h-3.5" /> : <ZoomOut className="w-3.5 h-3.5" />}
                      <span>{zoomLevel}x</span>
                    </button>
                  )}

                  {/* High Frequency Scanner Sound Button / Tone Selector */}
                  <div className="relative">
                    <div className="inline-flex items-center rounded-xl bg-slate-800/90 border border-slate-700 p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          posAudio.unlock();
                          posAudio.testSupermarketBeep(scannerTone, scannerFreq);
                          setIsSoundPulse(true);
                          setTimeout(() => setIsSoundPulse(false), 350);
                        }}
                        className={`inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isMuted
                            ? 'bg-slate-800 text-slate-500'
                            : isSoundPulse
                            ? 'bg-emerald-500 text-slate-950 font-black scale-105 shadow-md shadow-emerald-500/30'
                            : 'text-emerald-400 hover:text-emerald-300'
                        }`}
                        title={`High Frequency Beep (${scannerFreq} Hz) - Tap to test!`}
                      >
                        {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline font-mono">
                          {isMuted ? 'Muted' : `${scannerFreq}Hz`}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowSoundMenu(!showSoundMenu)}
                        className={`p-1 rounded-md text-xs transition-all cursor-pointer ${
                          showSoundMenu
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Scanner Pitch Frequency & Volume"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Sound Settings Popover */}
                    {showSoundMenu && (
                      <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 z-50 w-80 max-w-[92vw] rounded-2xl bg-slate-900 border border-slate-700 p-3.5 shadow-2xl space-y-3 text-left">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                            <span>High Frequency Scanner Sound</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowSoundMenu(false)}
                            className="text-slate-400 hover:text-white text-xs p-1"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Frequency Pitch Slider */}
                        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-semibold">Beep Pitch Frequency:</span>
                            <span className="font-mono font-bold text-emerald-400 text-sm bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                              {scannerFreq} Hz
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] text-slate-500 font-mono">2000Hz</span>
                            <input
                              type="range"
                              min="2000"
                              max="4800"
                              step="50"
                              value={scannerFreq}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setScannerFreq(val);
                                posAudio.setFrequency(val);
                              }}
                              onMouseUp={() => posAudio.testSupermarketBeep(scannerTone, scannerFreq)}
                              onTouchEnd={() => posAudio.testSupermarketBeep(scannerTone, scannerFreq)}
                              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                            />
                            <span className="text-[10px] text-slate-500 font-mono">4800Hz</span>
                          </div>
                        </div>

                        {/* Tone Presets */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            High Frequency Presets
                          </label>
                          {[
                            {
                              id: 'high_frequency' as ScannerTonePreset,
                              freq: 3500,
                              name: 'High Frequency Beep (3500 Hz)',
                              badge: 'Default',
                              desc: 'Crystal-clear supermarket checkout register pip'
                            },
                            {
                              id: 'piercing_high' as ScannerTonePreset,
                              freq: 3800,
                              name: 'Piercing High Tone (3800 Hz)',
                              badge: 'Ultra High',
                              desc: 'Loud high-pitch tone for crowded retail & noisy bars'
                            },
                            {
                              id: 'extreme_high' as ScannerTonePreset,
                              freq: 4200,
                              name: 'Extreme High Pitch (4200 Hz)',
                              badge: 'Max Pitch',
                              desc: 'Extra-high sharp micro-pip'
                            },
                            {
                              id: 'crisp_high' as ScannerTonePreset,
                              freq: 3200,
                              name: 'Crisp High Tone (3200 Hz)',
                              badge: '3200 Hz',
                              desc: 'Zebra / Honeywell commercial laser confirmation'
                            },
                            {
                              id: 'supermarket' as ScannerTonePreset,
                              freq: 2800,
                              name: 'Classic Supermarket (2800 Hz)',
                              badge: 'Standard',
                              desc: 'Traditional checkout register pip'
                            },
                            {
                              id: 'laser_chirp' as ScannerTonePreset,
                              freq: 3400,
                              name: 'Laser Frequency Chirp',
                              badge: 'Chirp',
                              desc: 'Fast 3000-3800 Hz rising high frequency sweep'
                            }
                          ].map((item) => {
                            const isSelected = scannerTone === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setScannerTone(item.id);
                                  setScannerFreq(item.freq);
                                  posAudio.setTone(item.id);
                                  posAudio.testSupermarketBeep(item.id, item.freq);
                                }}
                                className={`w-full p-2 rounded-xl text-left transition-all flex flex-col cursor-pointer border ${
                                  isSelected
                                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                                    : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-slate-300'
                                }`}
                              >
                                <span className="text-xs font-bold flex items-center justify-between">
                                  <span>{item.name}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${isSelected ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-700 text-slate-300'}`}>
                                    {item.badge}
                                  </span>
                                </span>
                                <span className="text-[10px] text-slate-400 mt-0.5">{item.desc}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Mute and Test Row */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              const next = posAudio.toggleMute();
                              setIsMuted(next);
                              if (!next) posAudio.testSupermarketBeep(scannerTone, scannerFreq);
                            }}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              isMuted
                                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                            }`}
                          >
                            {isMuted ? 'Unmute Sound' : 'Mute Sound'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              posAudio.unlock();
                              posAudio.testSupermarketBeep(scannerTone, scannerFreq);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-sm cursor-pointer"
                          >
                            Test High Beep
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Photo Snapshot fallback */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                  title="Upload or snap a barcode photo"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Photo</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Viewport Frame with Scanner Overlay */}
              <div className="w-full relative rounded-2xl overflow-hidden bg-black border-2 border-slate-700 shadow-2xl min-h-[260px] sm:min-h-[300px]">
                {/* Initializing Spinner */}
                {isInitializing && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xs">
                    <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-2" />
                    <p className="text-xs text-slate-200 font-bold">Connecting phone camera...</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Please allow camera permissions</p>
                  </div>
                )}

                {/* Video container injected by Html5Qrcode */}
                <div id={scannerContainerId} className="w-full h-full min-h-[260px] sm:min-h-[300px]" />

                {/* Viewfinder Target Framing Brackets & Laser */}
                {!isInitializing && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                    {/* Viewfinder Target Box */}
                    <div
                      className={`relative w-full max-w-[340px] h-[160px] sm:h-[180px] rounded-2xl border-2 transition-all duration-300 ${
                        isSuccessFlash
                          ? 'border-emerald-400 bg-emerald-500/20 shadow-lg shadow-emerald-500/40 scale-105'
                          : 'border-amber-400/80 shadow-lg shadow-black/60'
                      }`}
                    >
                      {/* Corner Target Accents */}
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-amber-400 rounded-tl-lg" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-amber-400 rounded-tr-lg" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-amber-400 rounded-bl-lg" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-amber-400 rounded-br-lg" />

                      {/* Animated Red Laser Scan Line */}
                      <div className="absolute left-2 right-2 scanner-laser-line h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_rgba(239,68,68,0.8)]" />

                      {/* Center Crosshair / Alignment Guide */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] text-amber-200/60 font-mono tracking-widest uppercase">
                          Align Barcode Here
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Supported Symbologies Footer Note */}
              <div className="mt-2.5 flex items-center justify-center space-x-2 text-[11px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Supports Code-128, EAN-13, UPC-A, Code-39 & QR codes</span>
              </div>
            </div>
          )}

          {/* Last Scanned Feedback Banner */}
          {lastScanned && (
            <div className="mt-3 w-full p-3 rounded-2xl bg-emerald-950/85 border border-emerald-500/60 flex items-center justify-between text-xs shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="truncate">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-white truncate">
                      {lastScanned.product ? lastScanned.product.name : 'Scanned Code'}
                    </span>
                    {lastScanned.product && (
                      <span className="text-[11px] text-emerald-300 font-mono font-bold">
                        • {currency} {lastScanned.product.sellingPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-emerald-400/90 truncate">
                    Barcode: {lastScanned.code}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-black uppercase tracking-wider border border-emerald-500/30">
                Added
              </span>
            </div>
          )}

          {/* Manual Input Form (Fallback for broken barcodes / low light) */}
          <form
            onSubmit={handleManualSubmit}
            className="mt-3 w-full flex items-center space-x-2"
          >
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Can't scan? Type barcode number..."
                className="w-full rounded-xl bg-slate-800/90 border border-slate-700 pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm"
            >
              Add
            </button>
          </form>

          {manualInputError && (
            <p className="mt-1.5 text-xs text-red-400 flex items-center space-x-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{manualInputError}</span>
            </p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 hidden sm:block">
            {continuousMode ? (
              <span>Point at any bottle or sticker to scan continuously</span>
            ) : (
              <span>Point at barcode to scan once</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all border border-slate-700 cursor-pointer shadow-sm active:scale-95"
          >
            {cartCount != null && cartCount > 0
              ? `Done (${cartCount} in Cart)`
              : 'Done Scanning'}
          </button>
        </div>
      </div>
    </div>
  );
};
