import React from 'react';
import { ShieldCheck, Cpu } from 'lucide-react';

interface AppFooterProps {
  theme?: 'light' | 'dark' | 'glass';
  className?: string;
  showDetails?: boolean;
}

export function AppFooter({ theme = 'light', className = '', showDetails = true }: AppFooterProps) {
  const currentYear = new Date().getFullYear();

  const themeClasses = {
    light: 'bg-white border-t border-slate-200/80 text-slate-600',
    dark: 'bg-slate-900/90 border-t border-slate-800 text-slate-400',
    glass: 'bg-slate-900/60 backdrop-blur-md border-t border-white/10 text-slate-300'
  }[theme];

  const brandClasses = {
    light: 'text-slate-900 font-extrabold hover:text-amber-600',
    dark: 'text-white font-extrabold hover:text-amber-400',
    glass: 'text-amber-400 font-extrabold hover:text-amber-300'
  }[theme];

  return (
    <footer
      id="app-global-footer"
      className={`w-full py-3 px-4 sm:px-6 transition-colors mt-auto select-none ${themeClasses} ${className}`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
        {/* Brand & Dev Credit */}
        <div className="flex items-center space-x-2 text-center sm:text-left">
          <div className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-500 flex items-center justify-center font-black text-[10px] shrink-0">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <p className="tracking-tight">
            Powered by{' '}
            <span className={`${brandClasses} transition-colors tracking-wide`}>
              Davetech Solutions
            </span>
            <span className="hidden md:inline text-slate-400 dark:text-slate-500 ml-1.5 font-medium">
              • Enterprise POS & Business Management Systems
            </span>
          </p>
        </div>

        {/* System & Support Details */}
        {showDetails && (
          <div className="flex items-center space-x-3 text-[11px] opacity-90">
            <div className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">Davetech Secure Core</span>
            </div>
            <span>•</span>
            <span>© {currentYear} Davetech Solutions</span>
          </div>
        )}
      </div>
    </footer>
  );
}
