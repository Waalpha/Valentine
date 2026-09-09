import React, { useState, useEffect } from 'react';
import { UserProfile, BusinessConfig } from '../../types';
import { auth } from '../../lib/firebase';
import { logAuditAction, formatCurrency } from '../../lib/utils';
import { LayoutDashboard, ShoppingCart, Receipt, Package, CalendarCheck, LogOut, Wine, Maximize2, Minimize2 } from 'lucide-react';
import { OfflineStatusIndicator } from '../common/OfflineStatusIndicator';

interface CashierLayoutProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
  activeTab: 'dashboard' | 'sell' | 'sales' | 'stock' | 'closing';
  setActiveTab: (tab: 'dashboard' | 'sell' | 'sales' | 'stock' | 'closing') => void;
  onLogout: () => void;
  children?: React.ReactNode;
}

export function CashierLayout({ user, businessConfig, activeTab, setActiveTab, onLogout, children }: CashierLayoutProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen request failed or restricted:', err);
      // Fallback: toggle expanded view state
      setIsFullscreen(prev => !prev);
    }
  };

  const handleSignOut = async () => {
    await logAuditAction(user.uid, user.name, 'LOGOUT', 'Cashier logged out');
    await auth.signOut();
    onLogout();
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sell', label: 'Record Sale', icon: ShoppingCart, highlight: true },
    { id: 'sales', label: "Today's Sales", icon: Receipt },
    { id: 'stock', label: 'Stock Status', icon: Package },
    { id: 'closing', label: 'End-of-Day', icon: CalendarCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Wine className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">
                {businessConfig?.name || 'Club Valentine'} <span className="text-xs font-normal text-amber-400 ml-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">Cashier POS</span>
              </h1>
              <p className="text-xs text-slate-400">Cashier: <strong className="text-slate-200">{user.name}</strong></p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <OfflineStatusIndicator />

            <div className="hidden sm:block text-right pr-1">
              <p className="text-xs text-slate-400">Active Currency</p>
              <p className="text-sm font-bold text-amber-400">{businessConfig?.currency || 'KSh'}</p>
            </div>

            {/* Full Screen Toggle Button */}
            <button
              onClick={toggleFullscreen}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 px-3 py-2 rounded-xl text-sm font-semibold border border-slate-700 transition-all active:scale-95 shadow-xs"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              id="cashier-fullscreen-toggle"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4 text-amber-400" />
                  <span className="hidden md:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-amber-400" />
                  <span className="hidden md:inline">Full Screen</span>
                </>
              )}
            </button>

            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-sm font-medium border border-slate-700 transition-all active:scale-95"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="bg-slate-800/90 border-t border-slate-700/60 px-4 sm:px-6 lg:px-8">
          <div className="w-full flex space-x-1 sm:space-x-4 overflow-x-auto py-2 scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? item.highlight
                        ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                        : 'bg-slate-700 text-white shadow-xs'
                      : item.highlight
                      ? 'bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-500/30'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area - Full screen width responsive container */}
      <main className="flex-1 w-full p-3 sm:p-5 lg:p-6">
        {children}
      </main>
    </div>
  );
}
