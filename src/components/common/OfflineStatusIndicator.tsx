import React, { useState, useEffect, useRef } from 'react';
import {
  getOfflineStatus,
  subscribeOfflineStatus,
  syncAllOfflineData,
  OfflineStatus
} from '../../lib/offlineManager';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  CloudCheck, 
  ChevronDown, 
  Info,
  X
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export function OfflineStatusIndicator() {
  const [status, setStatus] = useState<OfflineStatus>(getOfflineStatus());
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const lastHandledResultTimestamp = useRef<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeOfflineStatus((newStatus) => {
      setStatus(newStatus);

      // Trigger automatic sync banner if a background sync completed
      if (
        newStatus.lastSyncResult &&
        newStatus.lastSyncResult.timestamp > lastHandledResultTimestamp.current
      ) {
        lastHandledResultTimestamp.current = newStatus.lastSyncResult.timestamp;
        setSyncFeedback(newStatus.lastSyncResult.message);
        const timer = setTimeout(() => {
          setSyncFeedback(null);
        }, 4000);
        return () => clearTimeout(timer);
      }
    });

    // Close dropdown on outside click
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDetails(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsub();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleManualSync = async () => {
    setSyncFeedback(null);
    const res = await syncAllOfflineData();
    if (res.totalSynced > 0) {
      setSyncFeedback(`Synced ${res.totalSynced} item${res.totalSynced > 1 ? 's' : ''} to cloud!`);
      setTimeout(() => setSyncFeedback(null), 3500);
    } else if (res.errors > 0) {
      setSyncFeedback(`Sync had ${res.errors} error(s). Retrying automatically.`);
      setTimeout(() => setSyncFeedback(null), 3500);
    } else {
      setSyncFeedback('All cloud data is up to date!');
      setTimeout(() => setSyncFeedback(null), 2500);
    }
  };

  const hasPending = status.pendingTotalCount > 0;

  return (
    <div className="relative flex items-center space-x-2" ref={dropdownRef}>
      {/* Install PWA Button across iOS & Android & Desktop */}
      <PWAInstallButton variant="compact" />

      {/* Online / Offline Status Badge (Clickable to view sync details) */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer select-none ${
          !status.isOnline
            ? 'bg-amber-950/80 border-amber-500/80 text-amber-300 animate-pulse'
            : status.isSyncing
            ? 'bg-amber-900/60 border-amber-500 text-amber-300'
            : hasPending
            ? 'bg-amber-900/40 border-amber-500/60 text-amber-200'
            : 'bg-slate-800/80 border-slate-700 text-emerald-400 hover:border-slate-600'
        }`}
        title="Click to view network & automatic sync status"
        aria-label="Cloud & Sync Status"
      >
        {!status.isOnline ? (
          <>
            <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Offline</span>
            {hasPending && (
              <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-full text-[10px]">
                {status.pendingTotalCount} queued
              </span>
            )}
          </>
        ) : status.isSyncing ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
            <span>Syncing...</span>
          </>
        ) : hasPending ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{status.pendingTotalCount} pending</span>
          </>
        ) : (
          <>
            <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden md:inline">Online</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse hidden sm:inline-block" />
          </>
        )}
        <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
      </button>

      {/* Manual Quick Sync Trigger when items are queued and online */}
      {status.isOnline && hasPending && !status.isSyncing && (
        <button
          onClick={handleManualSync}
          className="flex items-center space-x-1 bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1 rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer shadow-sm"
          title="Push pending records to cloud immediately"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Sync Now</span>
        </button>
      )}

      {/* Auto-Sync Toast / Feedback Pill */}
      {syncFeedback && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-emerald-500 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-black shadow-xl flex items-center space-x-1.5 whitespace-nowrap animate-in fade-in slide-in-from-top-1 duration-200">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Sync Status Diagnostic Popover */}
      {showDetails && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 z-50 text-slate-200 text-xs animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <div className="flex items-center space-x-1.5 font-bold text-slate-100 text-sm">
              <span>Cloud & Auto-Sync</span>
            </div>
            <button
              onClick={() => setShowDetails(false)}
              className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {/* Connection state */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-slate-400">Internet Connection</span>
              <div className="flex items-center space-x-1.5 font-bold">
                {status.isOnline ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-emerald-400">Connected</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-amber-400">Disconnected</span>
                  </>
                )}
              </div>
            </div>

            {/* Auto-Sync Engine status */}
            <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400">Automatic Sync</span>
                <span className="font-bold text-emerald-400 flex items-center space-x-1">
                  <span>Active</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Automatically pushes queued sales, shift stock, and orders the instant internet connects.
              </p>
            </div>

            {/* Breakdown of pending queue */}
            <div className="p-2 rounded-xl bg-slate-800/40 border border-slate-700/40 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400">Queue Breakdown:</div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex justify-between px-2 py-1 rounded bg-slate-800/80">
                  <span className="text-slate-400">Sales:</span>
                  <span className={`font-mono font-bold ${status.pendingSalesCount > 0 ? 'text-amber-300' : 'text-slate-300'}`}>
                    {status.pendingSalesCount}
                  </span>
                </div>
                <div className="flex justify-between px-2 py-1 rounded bg-slate-800/80">
                  <span className="text-slate-400">Openings:</span>
                  <span className={`font-mono font-bold ${status.pendingOpeningsCount > 0 ? 'text-amber-300' : 'text-slate-300'}`}>
                    {status.pendingOpeningsCount}
                  </span>
                </div>
                <div className="flex justify-between px-2 py-1 rounded bg-slate-800/80">
                  <span className="text-slate-400">Closings:</span>
                  <span className={`font-mono font-bold ${status.pendingClosingsCount > 0 ? 'text-amber-300' : 'text-slate-300'}`}>
                    {status.pendingClosingsCount}
                  </span>
                </div>
                <div className="flex justify-between px-2 py-1 rounded bg-slate-800/80">
                  <span className="text-slate-400">Orders:</span>
                  <span className={`font-mono font-bold ${status.pendingOrdersCount > 0 ? 'text-amber-300' : 'text-slate-300'}`}>
                    {status.pendingOrdersCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Last sync timestamp */}
            {status.lastSyncTime && (
              <div className="flex items-center justify-between text-[11px] px-1 text-slate-400">
                <span>Last Cloud Sync:</span>
                <span className="font-mono text-slate-300">{status.lastSyncTime}</span>
              </div>
            )}

            {/* Action button */}
            <button
              onClick={handleManualSync}
              disabled={!status.isOnline || status.isSyncing}
              className="w-full flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black transition-all cursor-pointer mt-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${status.isSyncing ? 'animate-spin' : ''}`} />
              <span>{status.isSyncing ? 'Syncing Now...' : 'Force Sync Now'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

