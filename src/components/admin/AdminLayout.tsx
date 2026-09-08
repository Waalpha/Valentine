import React from 'react';
import { UserProfile, BusinessConfig } from '../../types';
import { auth } from '../../lib/firebase';
import { logAuditAction } from '../../lib/utils';
import { 
  LayoutDashboard, Package, Layers, Receipt, CalendarCheck, 
  Users, ShieldAlert, Settings, LogOut, Wine, TrendingUp 
} from 'lucide-react';

interface AdminLayoutProps {
  user: UserProfile;
  businessConfig?: BusinessConfig | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  children?: React.ReactNode;
}

export function AdminLayout({ user, businessConfig, activeTab, setActiveTab, onLogout, children }: AdminLayoutProps) {
  const handleSignOut = async () => {
    await logAuditAction(user.uid, user.name, 'LOGOUT', 'Admin logged out');
    await auth.signOut();
    onLogout();
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'stock', label: 'Stock & Additions', icon: Layers },
    { id: 'sales', label: 'Sales Reports', icon: Receipt },
    { id: 'closings', label: 'Daily Closings', icon: CalendarCheck },
    { id: 'cashiers', label: 'Cashier Accounts', icon: Users },
    { id: 'audit', label: 'Audit Logs', icon: ShieldAlert },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row font-sans">
      {/* Sidebar for Desktop / Header for Mobile */}
      <aside className="w-full lg:w-72 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 shadow-xl">
        <div>
          {/* Logo Brand Header */}
          <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Wine className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">{businessConfig?.name || 'Savanna Bar'}</h1>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                Admin Control
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-180px)] scrollbar-none">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                      : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Footer Profile & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="truncate pr-2">
            <p className="text-sm font-bold text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign Out"
            className="p-2.5 rounded-xl bg-slate-800 text-red-400 hover:bg-slate-700 hover:text-red-300 transition-all shrink-0"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
