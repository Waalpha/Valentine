import React, { useState, useEffect } from 'react';
import { UserProfile, BusinessConfig, RestaurantTable } from '../../types';
import { auth, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { logAuditAction } from '../../lib/utils';
import {
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  LogOut,
  Maximize2,
  Minimize2,
  Grid,
  Wine
} from 'lucide-react';
import { OfflineStatusIndicator } from '../common/OfflineStatusIndicator';
import { WaiterOrderScreen } from './WaiterOrderScreen';
import { WaiterOrdersList } from './WaiterOrdersList';
import { TablesView } from '../admin/TablesView';
import { subscribeOrders } from '../../lib/orderService';
import { AppFooter } from '../common/AppFooter';

type WaiterTab = 'new_order' | 'pending' | 'tables' | 'completed';

interface WaiterLayoutProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
  activeTab?: WaiterTab;
  setActiveTab?: (tab: WaiterTab) => void;
  pendingCount?: number;
  onLogout: () => void;
  children?: React.ReactNode;
}

export function WaiterLayout({
  user,
  businessConfig,
  activeTab: controlledActiveTab,
  setActiveTab: controlledSetActiveTab,
  pendingCount: controlledPendingCount,
  onLogout,
  children
}: WaiterLayoutProps) {
  const [internalTab, setInternalTab] = useState<WaiterTab>('new_order');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [livePendingCount, setLivePendingCount] = useState(0);
  const [selectedTableForOrder, setSelectedTableForOrder] = useState<RestaurantTable | null>(null);

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalTab;
  const setActiveTab = controlledSetActiveTab || setInternalTab;

  useEffect(() => {
    const tenantId = user.businessId || DEFAULT_BUSINESS_ID;
    const unsub = subscribeOrders(tenantId, (orders) => {
      // Pending orders submitted by this waiter (or all if user is manager)
      const myPending = orders.filter(
        (o) =>
          o.waiterId === user.uid &&
          o.orderStatus !== 'completed' &&
          o.orderStatus !== 'cancelled'
      );
      setLivePendingCount(myPending.length);
    });
    return () => unsub();
  }, [user.businessId, user.uid]);

  const pendingCount =
    controlledPendingCount !== undefined ? controlledPendingCount : livePendingCount;

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
      console.warn('Fullscreen request failed:', err);
      setIsFullscreen((prev) => !prev);
    }
  };

  const handleSignOut = () => {
    onLogout();
  };

  const navItems = [
    { id: 'new_order', label: 'Take Customer Order', icon: UtensilsCrossed, highlight: true },
    {
      id: 'pending',
      label: 'My Orders (Pending)',
      icon: Clock,
      badge: pendingCount
    },
    { id: 'tables', label: 'Table Status', icon: Grid },
    { id: 'completed', label: 'Completed Orders', icon: CheckCircle2 }
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none">
      {/* Top Header */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Wine className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>{businessConfig?.name || 'Club Paxx'}</span>
                <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  Waiter Terminal
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Floor Server: <strong className="text-amber-300">{user.name}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <OfflineStatusIndicator />

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
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

            {/* Logout */}
            <button
              id="waiter-signout-btn"
              onClick={handleSignOut}
              title="Sign Out"
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-red-950/40 hover:text-red-300 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-700 hover:border-red-500/40 transition-all cursor-pointer active:scale-95"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-800/95 border-t border-slate-700/60 px-4 sm:px-6">
          <div className="w-full flex space-x-1 sm:space-x-3 overflow-x-auto py-2 scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as WaiterTab)}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
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
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-1.5 px-2 py-0.5 text-xs font-black rounded-full bg-amber-500 text-slate-950">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full p-3 sm:p-5 lg:p-6 max-w-7xl mx-auto">
        {children ? (
          children
        ) : (
          <>
            {activeTab === 'new_order' && (
              <WaiterOrderScreen
                user={user}
                businessConfig={businessConfig}
                initialTable={selectedTableForOrder}
                onOrderSubmitted={() => {
                  setSelectedTableForOrder(null);
                  setActiveTab('pending');
                }}
              />
            )}
            {activeTab === 'pending' && (
              <WaiterOrdersList
                user={user}
                businessConfig={businessConfig}
                initialFilter="pending"
                onNewOrderClick={() => {
                  setSelectedTableForOrder(null);
                  setActiveTab('new_order');
                }}
              />
            )}
            {activeTab === 'tables' && (
              <TablesView
                user={user}
                businessConfig={businessConfig}
                isWaiterMode={true}
                onSelectTableForOrder={(table) => {
                  setSelectedTableForOrder(table);
                  setActiveTab('new_order');
                }}
              />
            )}
            {activeTab === 'completed' && (
              <WaiterOrdersList
                user={user}
                businessConfig={businessConfig}
                initialFilter="completed"
                onNewOrderClick={() => {
                  setSelectedTableForOrder(null);
                  setActiveTab('new_order');
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Davetech Solutions Footer */}
      <AppFooter theme="light" />
    </div>
  );
}
