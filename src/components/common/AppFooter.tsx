import React from 'react';

interface AppFooterProps {
  theme?: 'light' | 'dark' | 'glass';
  className?: string;
  showDetails?: boolean;
}

export function AppFooter({ theme = 'light', className = '' }: AppFooterProps) {
  const currentYear = new Date().getFullYear();

  const themeClasses = {
    light: 'bg-white border-t border-slate-200/80 text-slate-500',
    dark: 'bg-slate-900/90 border-t border-slate-800 text-slate-400',
    glass: 'bg-slate-900/60 backdrop-blur-md border-t border-white/10 text-slate-300'
  }[theme];

  return (
    <footer
      id="app-global-footer"
      className={`w-full py-3 px-4 sm:px-6 transition-colors mt-auto select-none text-center ${themeClasses} ${className}`}
    >
      <p className="text-xs font-medium">
        Copyright © {currentYear} Davetech Solutions
      </p>
    </footer>
  );
}
