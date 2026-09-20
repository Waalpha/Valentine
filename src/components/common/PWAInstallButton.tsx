import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Smartphone, Share2, PlusSquare, X, CheckCircle2, Monitor } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'header' | 'button' | 'compact' | 'banner';
  className?: string;
  onInstalled?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'button',
  className = '',
  onInstalled
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showInstructions, setShowInstructions] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  // If already running as an installed PWA on the home screen or app window, hide
  if (isInstalled) {
    return null;
  }

  const handleInstall = async () => {
    if (isInstallable) {
      const success = await install();
      if (success && onInstalled) {
        onInstalled();
      }
    } else {
      // Show guided instructions for manual install (Chrome 3-dot menu or Safari share)
      setShowInstructions(true);
    }
  };

  // Render Banner mode if requested
  if (variant === 'banner') {
    if (dismissedBanner) return null;
    return (
      <>
        <div className={`relative flex items-center justify-between gap-3 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 px-4 py-2.5 rounded-2xl shadow-lg border border-amber-400/50 ${className}`}>
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
              <Download className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <p className="text-xs font-black tracking-wide uppercase">Install Club Paxx POS</p>
              <p className="text-[11px] font-medium text-slate-900 leading-tight">
                Use offline anytime, fast fullscreen access, and works without internet!
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleInstall}
              className="bg-slate-950 hover:bg-slate-900 text-amber-300 font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center space-x-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isIOS ? 'Install (iOS)' : 'Install Now'}</span>
            </button>
            <button
              onClick={() => setDismissedBanner(true)}
              className="p-1 hover:bg-amber-700/20 text-slate-900 rounded-lg cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal for iOS or manual install instruction */}
        {showInstructions && renderGuideModal()}
      </>
    );
  }

  // Header / Compact Variant
  if (variant === 'compact' || variant === 'header') {
    return (
      <>
        <button
          onClick={handleInstall}
          type="button"
          className={`flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1 rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer ${className}`}
          title="Install Club Paxx POS App on this phone, tablet or PC"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isIOS ? 'Install iOS' : 'Install App'}</span>
        </button>

        {showInstructions && renderGuideModal()}
      </>
    );
  }

  // Default Button
  return (
    <>
      <button
        onClick={handleInstall}
        type="button"
        className={`flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-4 py-2 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer ${className}`}
      >
        <Download className="w-4 h-4" />
        <span>{isIOS ? 'Install on iPhone / iPad' : 'Install Club Paxx POS App'}</span>
      </button>

      {showInstructions && renderGuideModal()}
    </>
  );

  function renderGuideModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-slate-900 animate-in fade-in zoom-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                {isIOS ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              </div>
              <h3 className="font-extrabold text-base text-slate-900">
                {isIOS ? 'Install on iPhone / iPad' : 'Install on This Device'}
              </h3>
            </div>
            <button
              onClick={() => setShowInstructions(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isIOS ? (
            <div className="mt-4 space-y-3.5 text-xs text-slate-600">
              <div className="flex items-start space-x-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 text-xs">
                  1
                </div>
                <div>
                  <p className="font-bold text-slate-900 flex items-center gap-1">
                    Tap the Share button <Share2 className="w-3.5 h-3.5 text-blue-600 inline" />
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">At the bottom of your Safari screen.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 text-xs">
                  2
                </div>
                <div>
                  <p className="font-bold text-slate-900 flex items-center gap-1">
                    Tap "Add to Home Screen" <PlusSquare className="w-3.5 h-3.5 text-slate-700 inline" />
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Scroll down in the action sheet options.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 text-xs">
                  3
                </div>
                <div>
                  <p className="font-bold text-slate-900">Tap "Add" in top-right</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Club Paxx POS icon will be pinned to your home screen.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-xs text-slate-600">
              <p className="text-slate-700">
                To install <strong>Club Paxx POS</strong> as a standalone application on your Chrome, Edge, or Android device:
              </p>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Look for the Install icon (⊕) in your browser address bar</span>
                </div>
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Or open browser menu (⋮) and choose "Install App" / "Add to Phone"</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5">
            <button
              onClick={() => setShowInstructions(false)}
              className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }
};
