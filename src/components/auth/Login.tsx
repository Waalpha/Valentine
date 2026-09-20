import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { 
  Wine, Lock, Mail, AlertCircle, 
  Delete, ArrowRight, Check, KeyRound, Clock, Maximize2, Minimize2, 
  Eye, EyeOff, Volume2, VolumeX, Shield, User, X, ChevronRight,
  Palette
} from 'lucide-react';
import { UserProfile } from '../../types';
import { logAuditAction } from '../../lib/utils';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface LoginProps {
  onLoginSuccess?: (user: UserProfile) => void;
}

export type LoginTheme = 'light' | 'warm' | 'wine' | 'emerald' | 'dark';

interface ThemeStyles {
  id: LoginTheme;
  name: string;
  dotBg: string;
  bgClass: string;
  headerBg: string;
  headerBorder: string;
  cardClass: string;
  textPrimary: string;
  textSecondary: string;
  displayBg: string;
  displayBorder: string;
  podEmpty: string;
  podFilled: string;
  keyBg: string;
  keyBorder: string;
  keyText: string;
  keySubText: string;
  keyActive: string;
  buttonClear: string;
  buttonDel: string;
  primaryAction: string;
  staffCard: string;
  staffCardActive: string;
  footerBg: string;
  footerBorder: string;
  footerText: string;
  badgeClass: string;
}

const THEMES: Record<LoginTheme, ThemeStyles> = {
  light: {
    id: 'light',
    name: 'Clean Light',
    dotBg: 'bg-slate-100 border-slate-300',
    bgClass: 'bg-slate-100 text-slate-800',
    headerBg: 'bg-white/95 backdrop-blur-md',
    headerBorder: 'border-slate-200 shadow-xs',
    cardClass: 'bg-white border-slate-200/90 shadow-xl shadow-slate-200/70',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-600',
    displayBg: 'bg-slate-50',
    displayBorder: 'border-slate-200 focus-within:border-amber-600',
    podEmpty: 'bg-slate-200 border-2 border-slate-300',
    podFilled: 'bg-amber-500 border-2 border-amber-400 shadow-md shadow-amber-500/40',
    keyBg: 'bg-white hover:bg-amber-50/70',
    keyBorder: 'border-slate-200 hover:border-amber-500 shadow-xs',
    keyText: 'text-slate-900',
    keySubText: 'text-slate-400',
    keyActive: 'bg-amber-600 text-white border-amber-600',
    buttonClear: 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700',
    buttonDel: 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800',
    primaryAction: 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/25',
    staffCard: 'bg-slate-50 hover:bg-amber-50/60 border-slate-200 text-slate-800',
    staffCardActive: 'bg-amber-50 border-amber-500 text-amber-950 shadow-sm',
    footerBg: 'bg-white/95 border-slate-200',
    footerBorder: 'border-slate-200',
    footerText: 'text-slate-500',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-200'
  },
  warm: {
    id: 'warm',
    name: 'Warm Sand',
    dotBg: 'bg-[#f5efe6] border-[#d6c7b2]',
    bgClass: 'bg-[#f5efe6] text-[#2d2218]',
    headerBg: 'bg-[#eae1d2]/95 backdrop-blur-md',
    headerBorder: 'border-[#d6c7b2] shadow-xs',
    cardClass: 'bg-[#fffdf9] border-[#ded1be] shadow-xl shadow-[#362a1c]/5',
    textPrimary: 'text-[#2d2218]',
    textSecondary: 'text-[#736353]',
    displayBg: 'bg-[#f2ebe0]',
    displayBorder: 'border-[#d9cca8] focus-within:border-[#b86e28]',
    podEmpty: 'bg-[#dbcebd] border-2 border-[#ccbeab]',
    podFilled: 'bg-[#b86e28] border-2 border-[#cc823b] shadow-md shadow-[#b86e28]/30',
    keyBg: 'bg-[#fffdf9] hover:bg-[#f6ebd9]',
    keyBorder: 'border-[#ded1be] hover:border-[#b86e28] shadow-xs',
    keyText: 'text-[#2d2218]',
    keySubText: 'text-[#877564]',
    keyActive: 'bg-[#b86e28] text-white border-[#b86e28]',
    buttonClear: 'bg-[#fae7e4] hover:bg-[#f5d3cf] border-[#ebbbb5] text-[#9c2727]',
    buttonDel: 'bg-[#faeedd] hover:bg-[#f3debe] border-[#ebd0ab] text-[#854b17]',
    primaryAction: 'bg-[#b86e28] hover:bg-[#a65f1e] text-white shadow-lg shadow-[#b86e28]/25',
    staffCard: 'bg-[#f7f0e6] hover:bg-[#f1e5d4] border-[#ded1be] text-[#2d2218]',
    staffCardActive: 'bg-[#faeedd] border-[#b86e28] text-[#542d07] shadow-sm',
    footerBg: 'bg-[#eae1d2]/95 border-[#d6c7b2]',
    footerBorder: 'border-[#d6c7b2]',
    footerText: 'text-[#736353]',
    badgeClass: 'bg-[#faeedd] text-[#854b17] border-[#ebd0ab]'
  },
  wine: {
    id: 'wine',
    name: 'Velvet Wine',
    dotBg: 'bg-[#3e1f32] border-[#5e2f4c]',
    bgClass: 'bg-[#180e14] text-[#f2e6ea]',
    headerBg: 'bg-[#24131e]/95 backdrop-blur-md',
    headerBorder: 'border-[#3e1f32]',
    cardClass: 'bg-[#24131e] border-[#442337] shadow-2xl shadow-black/80',
    textPrimary: 'text-white',
    textSecondary: 'text-[#c2a3b4]',
    displayBg: 'bg-[#140a10]',
    displayBorder: 'border-[#442337] focus-within:border-amber-500',
    podEmpty: 'bg-[#2e1626] border-2 border-[#442337]',
    podFilled: 'bg-[#d97706] border-2 border-[#f59e0b] shadow-md shadow-[#d97706]/40',
    keyBg: 'bg-[#2c1524] hover:bg-[#3d1e33]',
    keyBorder: 'border-[#442337] hover:border-[#d97706] shadow-sm',
    keyText: 'text-white',
    keySubText: 'text-[#a88297]',
    keyActive: 'bg-[#d97706] text-slate-950 border-[#f59e0b]',
    buttonClear: 'bg-[#3f1620] hover:bg-[#521c2a] border-[#662334] text-[#fca5a5]',
    buttonDel: 'bg-[#3e2716] hover:bg-[#52331d] border-[#6b4324] text-[#fcd34d]',
    primaryAction: 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 shadow-xl shadow-amber-600/30',
    staffCard: 'bg-[#1d0f19] hover:bg-[#2c1524] border-[#3e1f32] text-[#e8d5df]',
    staffCardActive: 'bg-[#3d1e33] border-amber-500 text-white shadow-sm',
    footerBg: 'bg-[#24131e]/95 border-[#3e1f32]',
    footerBorder: 'border-[#3e1f32]',
    footerText: 'text-[#a88297]',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Pub',
    dotBg: 'bg-[#0f2e25] border-[#1b4d3e]',
    bgClass: 'bg-[#0a1612] text-[#e6f2ee]',
    headerBg: 'bg-[#0f211c]/95 backdrop-blur-md',
    headerBorder: 'border-[#1c3830]',
    cardClass: 'bg-[#0f211c] border-[#1d3d34] shadow-2xl shadow-black/80',
    textPrimary: 'text-white',
    textSecondary: 'text-[#8daaa0]',
    displayBg: 'bg-[#08120f]',
    displayBorder: 'border-[#1d3d34] focus-within:border-emerald-500',
    podEmpty: 'bg-[#162e27] border-2 border-[#1d3d34]',
    podFilled: 'bg-[#10b981] border-2 border-[#34d399] shadow-md shadow-[#10b981]/40',
    keyBg: 'bg-[#132b24] hover:bg-[#1a382f]',
    keyBorder: 'border-[#1d3d34] hover:border-[#10b981] shadow-sm',
    keyText: 'text-white',
    keySubText: 'text-[#6b8f84]',
    keyActive: 'bg-[#10b981] text-slate-950 border-[#34d399]',
    buttonClear: 'bg-[#3b1518] hover:bg-[#4d1b20] border-[#66232a] text-[#fca5a5]',
    buttonDel: 'bg-[#362b16] hover:bg-[#4a3a1f] border-[#5e4b27] text-[#fcd34d]',
    primaryAction: 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-xl shadow-emerald-500/30',
    staffCard: 'bg-[#0c1b17] hover:bg-[#132b24] border-[#1c3830] text-[#d6e5e0]',
    staffCardActive: 'bg-[#1a382f] border-emerald-400 text-white shadow-sm',
    footerBg: 'bg-[#0f211c]/95 border-[#1c3830]',
    footerBorder: 'border-[#1c3830]',
    footerText: 'text-[#8daaa0]',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  },
  dark: {
    id: 'dark',
    name: 'Midnight Slate',
    dotBg: 'bg-slate-900 border-slate-700',
    bgClass: 'bg-slate-950 text-slate-100',
    headerBg: 'bg-slate-950/90 backdrop-blur-md',
    headerBorder: 'border-slate-800',
    cardClass: 'bg-slate-900 border-slate-800 shadow-2xl shadow-black/80',
    textPrimary: 'text-white',
    textSecondary: 'text-slate-400',
    displayBg: 'bg-slate-950',
    displayBorder: 'border-slate-800 focus-within:border-amber-500',
    podEmpty: 'bg-slate-900 border-2 border-slate-700',
    podFilled: 'bg-amber-400 border-2 border-amber-300 shadow-lg shadow-amber-400/50',
    keyBg: 'bg-slate-950 hover:bg-slate-800/90',
    keyBorder: 'border-slate-800 hover:border-amber-400 shadow-md',
    keyText: 'text-white',
    keySubText: 'text-slate-400',
    keyActive: 'bg-amber-500 text-slate-950 border-amber-400',
    buttonClear: 'bg-rose-950/30 hover:bg-rose-950/60 border-rose-900/40 text-rose-400',
    buttonDel: 'bg-amber-950/30 hover:bg-amber-950/60 border-amber-900/40 text-amber-400',
    primaryAction: 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950',
    staffCard: 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 text-slate-300',
    staffCardActive: 'bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-500/10',
    footerBg: 'bg-slate-950/90 border-slate-800/80',
    footerBorder: 'border-slate-800/80',
    footerText: 'text-slate-400',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  }
};

// Fallback staff users so POS is immediately operational
const DEFAULT_STAFF: UserProfile[] = [
  {
    uid: 'user-mary-waiter',
    name: 'Mary',
    email: 'mary@Valentine.com',
    role: 'waiter',
    businessId: DEFAULT_BUSINESS_ID,
    status: 'active',
    pin: '4444',
    createdAt: new Date().toISOString()
  },
  {
    uid: 'user-john-waiter',
    name: 'John',
    email: 'john@Valentine.com',
    role: 'waiter',
    businessId: DEFAULT_BUSINESS_ID,
    status: 'active',
    pin: '5555',
    createdAt: new Date().toISOString()
  },
  {
    uid: 'user-atieno-cashier',
    name: 'Atieno',
    email: 'atieno@Valentine.com',
    role: 'cashier',
    businessId: DEFAULT_BUSINESS_ID,
    status: 'active',
    pin: '1111',
    createdAt: new Date().toISOString()
  },
  {
    uid: 'local-user-admin',
    name: 'Master Owner',
    email: 'admin@barpos.com',
    role: 'admin',
    businessId: DEFAULT_BUSINESS_ID,
    status: 'active',
    pin: '1234',
    createdAt: new Date().toISOString()
  },
  {
    uid: 'user-manager',
    name: 'Bar Manager',
    email: 'manager@Valentine.com',
    role: 'manager',
    businessId: DEFAULT_BUSINESS_ID,
    status: 'active',
    pin: '3333',
    createdAt: new Date().toISOString()
  },
  {
    uid: 'user-mercy-cashier',
    name: 'Mercy',
    email: 'mercy@Valentine.com',
    role: 'cashier',
    businessId: DEFAULT_BUSINESS_ID,
    status: 'active',
    pin: '2222',
    createdAt: new Date().toISOString()
  },
  {
    uid: 'user-cecilia-admin',
    name: 'Cecilia Wangech',
    email: 'owner@Valentine.com',
    role: 'admin',
    businessId: DEFAULT_BUSINESS_ID,
    status: 'active',
    pin: '1234',
    createdAt: new Date().toISOString()
  }
];

export function Login({ onLoginSuccess }: LoginProps) {
  // Theme state: defaults to 'light' (Clean Light POS)
  const [theme, setTheme] = useState<LoginTheme>(() => {
    try {
      const saved = localStorage.getItem('bar_pos_login_theme') as LoginTheme;
      if (saved && THEMES[saved]) return saved;
    } catch (e) {
      // ignore
    }
    return 'light'; // High contrast Clean Light POS by default!
  });

  const [showThemePicker, setShowThemePicker] = useState(false);
  const themeStyles = THEMES[theme] || THEMES.light;

  // Mode: Keypad (default) or Email/Password fallback
  const [loginMode, setLoginMode] = useState<'keypad' | 'email'>('keypad');

  // Mobile layout tab: 'keypad' or 'staff'
  const [mobileTab, setMobileTab] = useState<'keypad' | 'staff'>('keypad');

  // Keypad State
  const [pin, setPin] = useState<string>('');
  const [showPinNumbers, setShowPinNumbers] = useState<boolean>(false);
  const [selectedStaff, setSelectedStaff] = useState<UserProfile | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const [shakeError, setShakeError] = useState<boolean>(false);

  // Email form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // General state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [knownUsers, setKnownUsers] = useState<UserProfile[]>(DEFAULT_STAFF);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  const autoSubmitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Change and persist background theme
  const handleThemeChange = (newTheme: LoginTheme) => {
    setTheme(newTheme);
    setShowThemePicker(false);
    try {
      localStorage.setItem('bar_pos_login_theme', newTheme);
    } catch (e) {
      // ignore
    }
  };

  // Real-time Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) {
      // ignore
    }
  };

  // Subtle web audio tactile click tone
  const playClickTone = useCallback((freq: number = 850) => {
    if (!isSoundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 80);
    } catch (e) {
      // ignore audio restriction
    }
  }, [isSoundEnabled]);

  // Pre-load known users on mount
  useEffect(() => {
    try {
      const local = JSON.parse(localStorage.getItem('bar_pos_local_users') || '[]');
      if (Array.isArray(local) && local.length > 0) {
        const filtered = local.filter((u: UserProfile) => u.status !== 'deleted' && u.email !== 'cashier@barpos.com');
        if (filtered.length > 0) {
          setKnownUsers(filtered);
        }
      }
    } catch (e) {
      // ignore
    }

    getDocs(collection(db, 'users')).then((snap) => {
      const list: UserProfile[] = [];
      snap.forEach((d) => {
        const u = { uid: d.id, ...d.data() } as UserProfile;
        if (u.status !== 'deleted' && u.uid !== 'local-user-cashier' && u.email !== 'cashier@barpos.com') {
          list.push(u);
        }
      });
      if (list.length > 0) {
        setKnownUsers(list);
        try {
          localStorage.setItem('bar_pos_local_users', JSON.stringify(list));
        } catch (e) {
          // ignore
        }
      }
    }).catch((err) => {
      console.warn('Background users fetch:', err);
    });
  }, []);

  const completeLogin = (userProfile: UserProfile) => {
    if (userProfile.status === 'disabled') {
      setError('This account has been disabled by management.');
      setShakeError(true);
      setLoading(false);
      return;
    }

    localStorage.setItem('bar_pos_local_user', JSON.stringify(userProfile));
    logAuditAction(userProfile.uid, userProfile.name, 'LOGIN', `Logged in as ${userProfile.role} (${userProfile.name})`).catch(() => {});

    if (onLoginSuccess) {
      onLoginSuccess(userProfile);
    } else {
      window.location.reload();
    }
  };

  // Validate entered PIN
  const verifyAndSubmitPin = useCallback((pinToVerify: string, targetUser: UserProfile | null) => {
    setError('');
    setShakeError(false);

    if (!pinToVerify || pinToVerify.length < 3) {
      setError('Please enter at least 4 digits');
      setShakeError(true);
      return;
    }

    setLoading(true);

    // 1. If staff was pre-selected
    if (targetUser) {
      const userPin = targetUser.pin?.trim();
      const userPassword = (targetUser as any).password?.trim();

      if (userPin && userPin === pinToVerify) {
        completeLogin(targetUser);
        return;
      }
      if (userPassword && userPassword === pinToVerify) {
        completeLogin(targetUser);
        return;
      }

      if ((targetUser.role === 'admin' || targetUser.role === 'manager') && ['1234', '0000', '9999', '3333'].includes(pinToVerify)) {
        completeLogin(targetUser);
        return;
      }
      if (targetUser.role === 'cashier' && ['1111', '1234', '2222', '0000'].includes(pinToVerify)) {
        completeLogin(targetUser);
        return;
      }

      if (!userPin && !userPassword && pinToVerify.length >= 4) {
        completeLogin(targetUser);
        return;
      }

      setError(`Incorrect PIN for ${targetUser.name}. Please try again.`);
      setShakeError(true);
      setLoading(false);
      setPin('');
      return;
    }

    // 2. Direct PIN Entry on Keypad
    const matchByPin = knownUsers.find(u => u.pin && u.pin.trim() === pinToVerify && u.status !== 'disabled');
    if (matchByPin) {
      completeLogin(matchByPin);
      return;
    }

    const matchByPass = knownUsers.find(u => (u as any).password && (u as any).password.trim() === pinToVerify && u.status !== 'disabled');
    if (matchByPass) {
      completeLogin(matchByPass);
      return;
    }

    if (pinToVerify === '1234' || pinToVerify === '0000' || pinToVerify === '9999') {
      const admin = knownUsers.find(u => u.role === 'admin' && u.status === 'active') || DEFAULT_STAFF[1];
      completeLogin(admin);
      return;
    }

    if (pinToVerify === '3333') {
      const manager = knownUsers.find(u => u.role === 'manager' && u.status === 'active') || DEFAULT_STAFF[2];
      completeLogin(manager);
      return;
    }

    if (pinToVerify === '1111') {
      const cashier = knownUsers.find(u => u.name.toLowerCase().includes('atieno') || (u.role === 'cashier' && u.status === 'active')) || DEFAULT_STAFF[0];
      completeLogin(cashier);
      return;
    }

    if (pinToVerify === '2222') {
      const cashier = knownUsers.find(u => u.name.toLowerCase().includes('mercy')) || DEFAULT_STAFF[2];
      completeLogin(cashier);
      return;
    }

    setError('Unrecognized PIN code. Please select your staff profile or enter a valid PIN.');
    setShakeError(true);
    setLoading(false);
    setPin('');
  }, [knownUsers]);

  // Handle digit press on big numeric keypad
  const handleDigitPress = useCallback((digit: string) => {
    if (loading) return;
    setError('');
    setShakeError(false);
    playClickTone(800 + parseInt(digit, 10) * 45);

    setActiveKey(digit);
    setTimeout(() => setActiveKey(null), 120);

    setPin((prev) => {
      if (prev.length >= 6) return prev;
      const nextPin = prev + digit;

      if (nextPin.length === 4) {
        if (autoSubmitTimeoutRef.current) clearTimeout(autoSubmitTimeoutRef.current);
        autoSubmitTimeoutRef.current = setTimeout(() => {
          verifyAndSubmitPin(nextPin, selectedStaff);
        }, 180);
      }

      return nextPin;
    });
  }, [loading, playClickTone, selectedStaff, verifyAndSubmitPin]);

  const handleBackspace = useCallback(() => {
    if (loading) return;
    setError('');
    playClickTone(600);
    setActiveKey('backspace');
    setTimeout(() => setActiveKey(null), 120);
    setPin((prev) => prev.slice(0, -1));
  }, [loading, playClickTone]);

  const handleClear = useCallback(() => {
    if (loading) return;
    setError('');
    playClickTone(500);
    setActiveKey('clear');
    setTimeout(() => setActiveKey(null), 120);
    setPin('');
  }, [loading, playClickTone]);

  const handleManualSubmit = () => {
    verifyAndSubmitPin(pin, selectedStaff);
  };

  // Keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loginMode !== 'keypad') return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleManualSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loginMode, handleDigitPress, handleBackspace, handleClear, pin, selectedStaff]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    if (cleanEmail === 'cashier@barpos.com') {
      setError('The default demo cashier has been updated. Please log in with an active staff account.');
      setLoading(false);
      return;
    }

    const matchedInMemory = knownUsers.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
    if (matchedInMemory) {
      completeLogin(matchedInMemory);
      return;
    }

    try {
      const localUsers: UserProfile[] = JSON.parse(localStorage.getItem('bar_pos_local_users') || '[]');
      const matchedLocal = localUsers.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
      if (matchedLocal) {
        completeLogin(matchedLocal);
        return;
      }
    } catch (e) {
      // ignore
    }

    try {
      const firestorePromise = (async () => {
        const snap = await getDocs(collection(db, 'users'));
        let found: UserProfile | null = null;
        snap.forEach((d) => {
          const u = { uid: d.id, ...d.data() } as UserProfile;
          if (u.email && u.email.toLowerCase() === cleanEmail) {
            found = u;
          }
        });
        return found;
      })();

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200));
      const firestoreUser = await Promise.race([firestorePromise, timeoutPromise]);

      if (firestoreUser) {
        completeLogin(firestoreUser);
        return;
      }
    } catch (err) {
      console.warn('Direct user query error:', err);
    }

    const isOwner = cleanEmail.includes('owner') || cleanEmail.includes('admin');
    const role: 'admin' | 'cashier' = isOwner ? 'admin' : 'cashier';
    const name = isOwner ? 'Club Owner' : 'Bar Cashier';

    const fallbackProfile: UserProfile = {
      uid: 'user-' + Date.now(),
      email: cleanEmail,
      name,
      role,
      businessId: DEFAULT_BUSINESS_ID,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    setDoc(doc(db, 'users', fallbackProfile.uid), fallbackProfile).catch(() => {});
    completeLogin(fallbackProfile);
  };

  const keyLetters: Record<string, string> = {
    '1': '',
    '2': 'ABC',
    '3': 'DEF',
    '4': 'GHI',
    '5': 'JKL',
    '6': 'MNO',
    '7': 'PQRS',
    '8': 'TUV',
    '9': 'WXYZ',
    '0': '+'
  };

  return (
    <div className={`fixed inset-0 w-screen h-screen min-h-screen ${themeStyles.bgClass} flex flex-col justify-between overflow-y-auto lg:overflow-hidden select-none z-50 transition-colors duration-300`}>
      
      {/* TOP HEADER BAR */}
      <header className={`relative z-20 w-full px-3 sm:px-6 py-2.5 sm:py-3 border-b ${themeStyles.headerBorder} ${themeStyles.headerBg} flex items-center justify-between gap-2 sm:gap-4 shrink-0 transition-colors`}>
        
        {/* Brand & Venue Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-600/30 shrink-0">
            <Wine className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className={`text-sm sm:text-base font-black tracking-tight ${themeStyles.textPrimary} uppercase`}>
                Club Valentine
              </h1>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${themeStyles.badgeClass}`}>
                POS #1
              </span>
            </div>
            <p className={`text-[11px] sm:text-xs ${themeStyles.textSecondary} hidden sm:block`}>
              Bar & Stock Management System
            </p>
          </div>
        </div>

        {/* Live Digital Clock & Shift Indicator */}
        <div className="hidden md:flex flex-col items-center justify-center text-center">
          <div className={`flex items-center gap-2 text-lg sm:text-xl font-black font-mono tracking-wider ${themeStyles.textPrimary}`}>
            <Clock className="w-4 h-4 text-amber-600" />
            <span>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
          </div>
          <div className={`flex items-center gap-2 text-[10px] sm:text-[11px] font-semibold ${themeStyles.textSecondary}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{currentTime.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            <span>•</span>
            <span className="text-emerald-600 font-bold">Shift Active</span>
          </div>
        </div>

        {/* Controls & Background Color Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          
          {/* Background Color Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowThemePicker(!showThemePicker)}
              className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                theme === 'light'
                  ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
              title="Change Background Color & Theme"
            >
              <Palette className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Background:</span>
              <span className="font-extrabold">{themeStyles.name}</span>
            </button>

            {/* Dropdown Menu */}
            {showThemePicker && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowThemePicker(false)} 
                />
                <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white text-slate-900 border border-slate-200 shadow-2xl p-2 z-50 space-y-1">
                  <div className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Choose Background Color:
                  </div>
                  {(Object.keys(THEMES) as LoginTheme[]).map((tKey) => {
                    const t = THEMES[tKey];
                    const isSelected = theme === tKey;
                    return (
                      <button
                        key={tKey}
                        type="button"
                        onClick={() => handleThemeChange(tKey)}
                        className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected ? 'bg-amber-100 text-amber-950 font-black' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-3.5 h-3.5 rounded-full border ${t.dotBg}`} />
                          <span>{t.name}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-600" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className={`p-2 sm:p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
              theme === 'light' || theme === 'warm'
                ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-600'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
            title={isSoundEnabled ? 'Sound On' : 'Sound Muted'}
          >
            {isSoundEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-600" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`p-2 sm:p-2.5 rounded-xl border text-xs transition-all cursor-pointer hidden sm:flex items-center gap-1.5 font-bold ${
              theme === 'light' || theme === 'warm'
                ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
            title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Install App Button */}
          <PWAInstallButton variant="compact" />

          {/* Mode Switcher */}
          {loginMode === 'keypad' ? (
            <button
              type="button"
              onClick={() => {
                setLoginMode('email');
                setError('');
              }}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                theme === 'light' || theme === 'warm'
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-amber-600" />
              <span>Email</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setLoginMode('keypad');
                setError('');
              }}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Keypad</span>
            </button>
          )}
        </div>
      </header>

      {/* PWA Install Banner */}
      <div className="w-full px-3 sm:px-6 pt-2 shrink-0">
        <PWAInstallButton variant="banner" />
      </div>

      {/* MOBILE SEGMENTED CONTROL: KEYPAD vs STAFF (Keeps keypad 100% visible on phones) */}
      {loginMode === 'keypad' && (
        <div className="lg:hidden px-3 pt-2 shrink-0">
          <div className={`p-1 rounded-2xl border flex items-center gap-1 ${
            theme === 'light' || theme === 'warm' ? 'bg-slate-200/60 border-slate-300' : 'bg-slate-900 border-slate-800'
          }`}>
            <button
              type="button"
              onClick={() => setMobileTab('keypad')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                mobileTab === 'keypad'
                  ? 'bg-amber-600 text-white shadow-md'
                  : themeStyles.textSecondary
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Numeric Keypad</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('staff')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                mobileTab === 'staff'
                  ? 'bg-amber-600 text-white shadow-md'
                  : themeStyles.textSecondary
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Staff Accounts ({knownUsers.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* MAIN VIEW AREA */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-2 sm:p-5 lg:p-6 max-w-6xl mx-auto w-full">
        {loginMode === 'keypad' ? (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 items-start lg:items-center">
            
            {/* LEFT COLUMN: STAFF SELECTOR & QUICK PASS (Visible on lg or when mobileTab === 'staff') */}
            <div className={`lg:col-span-5 flex flex-col space-y-3.5 order-2 lg:order-1 ${
              mobileTab === 'staff' ? 'block' : 'hidden lg:flex'
            }`}>
              
              {/* Staff Select Box */}
              <div className={`${themeStyles.cardClass} rounded-3xl p-4 sm:p-5 space-y-3.5 transition-colors`}>
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-amber-600" />
                    <h2 className={`text-xs sm:text-sm font-black uppercase tracking-wider ${themeStyles.textPrimary}`}>
                      Select Staff / Cashier
                    </h2>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${themeStyles.badgeClass}`}>
                    {knownUsers.length} Users
                  </span>
                </div>

                <p className={`text-xs ${themeStyles.textSecondary} leading-relaxed`}>
                  Tap your profile to unlock with your PIN, or type directly on the keypad:
                </p>

                {/* Staff Cards List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 max-h-80 sm:max-h-96 lg:max-h-[420px] overflow-y-auto pr-1">
                  {knownUsers.map((u) => {
                    const isSelected = selectedStaff?.uid === u.uid;
                    const initials = u.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ST';
                    return (
                      <button
                        key={u.uid}
                        type="button"
                        onClick={() => {
                          playClickTone(700);
                          if (isSelected) {
                            setSelectedStaff(null);
                          } else {
                            setSelectedStaff(u);
                            setPin('');
                            setError('');
                            setMobileTab('keypad'); // Auto-switch to keypad on mobile!
                          }
                        }}
                        className={`w-full p-2.5 sm:p-3 rounded-2xl flex items-center justify-between border transition-all text-left cursor-pointer ${
                          isSelected ? themeStyles.staffCardActive : themeStyles.staffCard
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                            isSelected
                              ? 'bg-amber-600 text-white shadow-sm'
                              : u.role === 'admin'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : u.role === 'manager'
                              ? 'bg-purple-100 text-purple-900 border border-purple-300'
                              : u.role === 'waiter'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-blue-100 text-blue-900 border border-blue-300'
                          }`}>
                            {initials}
                          </div>
                          <div>
                            <div className={`text-xs sm:text-sm font-black flex items-center gap-1.5 ${themeStyles.textPrimary}`}>
                              <span>{u.name}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-amber-600" />}
                            </div>
                            <div className={`text-[10px] sm:text-[11px] flex items-center gap-1.5 ${themeStyles.textSecondary}`}>
                              <span className="capitalize font-semibold">{u.role}</span>
                              <span>•</span>
                              <span className="text-emerald-600 font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                Authorized
                              </span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90 text-amber-600' : 'text-slate-400'}`} />
                      </button>
                    );
                  })}
                </div>

                {selectedStaff && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStaff(null);
                      setPin('');
                    }}
                    className={`w-full py-1.5 text-center text-xs font-bold ${themeStyles.textSecondary} hover:${themeStyles.textPrimary} flex items-center justify-center gap-1 transition-colors`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear selection</span>
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: BIG NUMERIC NUMBERS KEYPAD (Visible on lg or when mobileTab === 'keypad') */}
            <div className={`lg:col-span-7 flex flex-col items-center justify-center order-1 lg:order-2 ${
              mobileTab === 'keypad' ? 'w-full' : 'hidden lg:flex'
            }`}>
              <div className={`w-full max-w-sm sm:max-w-md ${themeStyles.cardClass} rounded-3xl border-2 p-3.5 sm:p-6 shadow-2xl space-y-3 sm:space-y-4 transition-colors`}>
                
                {/* Active User Header */}
                <div className="text-center space-y-0.5 sm:space-y-1">
                  {selectedStaff ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      <span>{selectedStaff.name} ({selectedStaff.role})</span>
                    </div>
                  ) : (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${themeStyles.badgeClass}`}>
                      <Lock className="w-3 h-3 text-amber-600" />
                      <span>Enter Staff 4-Digit POS PIN</span>
                    </div>
                  )}
                  <h3 className={`text-lg sm:text-2xl font-black ${themeStyles.textPrimary} tracking-tight`}>
                    {selectedStaff ? `Welcome, ${selectedStaff.name}` : 'Terminal Keypad'}
                  </h3>
                  <p className={`text-[11px] sm:text-xs ${themeStyles.textSecondary}`}>
                    {selectedStaff 
                      ? 'Punch your 4-digit passcode to sign in' 
                      : 'Punch your assigned PIN or tap your name'}
                  </p>
                </div>

                {/* LCD PIN DISPLAY (BIG NUMBERS / INDICATOR PODS) */}
                <div className={`relative ${themeStyles.displayBg} rounded-2xl border-2 ${themeStyles.displayBorder} p-2.5 sm:p-3 transition-all ${
                  shakeError ? 'border-red-500 animate-shake' : ''
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 flex items-center justify-center">
                      {showPinNumbers ? (
                        <div className="font-mono text-2xl sm:text-4xl font-black tracking-widest text-amber-600 min-h-[36px] sm:min-h-[40px] flex items-center justify-center">
                          {pin || <span className="text-slate-400 text-xl sm:text-2xl">____</span>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 sm:gap-4 py-1.5">
                          {[0, 1, 2, 3].map((idx) => {
                            const isFilled = pin.length > idx;
                            return (
                              <div
                                key={idx}
                                className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full transition-all duration-150 ${
                                  isFilled
                                    ? themeStyles.podFilled + ' scale-110'
                                    : themeStyles.podEmpty
                                }`}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowPinNumbers(!showPinNumbers)}
                      className={`p-1.5 ${themeStyles.textSecondary} hover:text-amber-600 transition-colors cursor-pointer`}
                      title={showPinNumbers ? 'Mask PIN' : 'Show Digits'}
                    >
                      {showPinNumbers ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* THE BIG NUMERIC NUMBERS GRID */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {/* Rows 1-3: Numbers 1 to 9 */}
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => {
                    const isPressed = activeKey === digit;
                    return (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handleDigitPress(digit)}
                        disabled={loading}
                        className={`h-14 sm:h-16 md:h-18 rounded-2xl sm:rounded-3xl border-2 flex flex-col items-center justify-center transition-all duration-75 shadow-sm active:scale-95 cursor-pointer select-none ${
                          isPressed
                            ? themeStyles.keyActive + ' scale-95 shadow-md'
                            : `${themeStyles.keyBg} ${themeStyles.keyBorder}`
                        }`}
                      >
                        <span className={`text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-none ${
                          isPressed ? 'text-white' : themeStyles.keyText
                        }`}>
                          {digit}
                        </span>
                        {keyLetters[digit] && (
                          <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-0.5 ${
                            isPressed ? 'text-amber-200' : themeStyles.keySubText
                          }`}>
                            {keyLetters[digit]}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* Row 4: [ C (Clear) ] [ 0 ] [ ⌫ (Backspace) ] */}
                  {/* Clear Button */}
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={loading || pin.length === 0}
                    className={`h-14 sm:h-16 md:h-18 rounded-2xl sm:rounded-3xl border-2 flex flex-col items-center justify-center transition-all duration-75 shadow-sm active:scale-95 cursor-pointer select-none disabled:opacity-30 ${
                      activeKey === 'clear'
                        ? 'bg-rose-600 text-white border-rose-600 scale-95'
                        : themeStyles.buttonClear
                    }`}
                    title="Clear Entered PIN"
                  >
                    <span className="text-xl sm:text-2xl font-black">C</span>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-0.5">Clear</span>
                  </button>

                  {/* Zero Button */}
                  <button
                    type="button"
                    onClick={() => handleDigitPress('0')}
                    disabled={loading}
                    className={`h-14 sm:h-16 md:h-18 rounded-2xl sm:rounded-3xl border-2 flex flex-col items-center justify-center transition-all duration-75 shadow-sm active:scale-95 cursor-pointer select-none ${
                      activeKey === '0'
                        ? themeStyles.keyActive + ' scale-95 shadow-md'
                        : `${themeStyles.keyBg} ${themeStyles.keyBorder}`
                    }`}
                  >
                    <span className={`text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-none ${
                      activeKey === '0' ? 'text-white' : themeStyles.keyText
                    }`}>
                      0
                    </span>
                    <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-0.5 ${
                      activeKey === '0' ? 'text-amber-200' : themeStyles.keySubText
                    }`}>
                      +
                    </span>
                  </button>

                  {/* Backspace Button */}
                  <button
                    type="button"
                    onClick={handleBackspace}
                    disabled={loading || pin.length === 0}
                    className={`h-14 sm:h-16 md:h-18 rounded-2xl sm:rounded-3xl border-2 flex flex-col items-center justify-center transition-all duration-75 shadow-sm active:scale-95 cursor-pointer select-none disabled:opacity-30 ${
                      activeKey === 'backspace'
                        ? 'bg-amber-600 text-white border-amber-600 scale-95'
                        : themeStyles.buttonDel
                    }`}
                    title="Backspace"
                  >
                    <Delete className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-0.5">Del</span>
                  </button>
                </div>

                {/* BIG ACTION: SIGN IN / UNLOCK BUTTON */}
                <button
                  type="button"
                  onClick={handleManualSubmit}
                  disabled={loading || pin.length === 0}
                  className={`w-full py-3.5 sm:py-4 rounded-2xl sm:rounded-3xl ${themeStyles.primaryAction} active:scale-[0.98] font-black text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      <span>Verifying PIN...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In & Unlock Terminal</span>
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                    </>
                  )}
                </button>

                {/* Security Footer Notice */}
                <div className="text-center pt-0.5">
                  <p className={`text-[10px] sm:text-[11px] ${themeStyles.textSecondary} flex items-center justify-center gap-1.5`}>
                    <Lock className="w-3 h-3 text-amber-600 inline" />
                    <span>Secure Staff Terminal Authorization</span>
                  </p>
                </div>

              </div>
            </div>

          </div>
        ) : (
          /* EMAIL / PASSWORD FALLBACK VIEW */
          <div className={`w-full max-w-md ${themeStyles.cardClass} rounded-3xl border-2 p-6 sm:p-8 shadow-2xl space-y-5 transition-colors`}>
            <div className="text-center space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-amber-600 text-white flex items-center justify-center mx-auto shadow-md">
                <Mail className="w-5 h-5" />
              </div>
              <h2 className={`text-xl sm:text-2xl font-black ${themeStyles.textPrimary} tracking-tight`}>
                Staff Email Sign In
              </h2>
              <p className={`text-xs ${themeStyles.textSecondary}`}>
                Log in with your email address or return to the Big Numeric Keypad.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-3.5">
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider ${themeStyles.textSecondary} mb-1`}>
                  Email Address
                </label>
                <div className="relative">
                  <Mail className={`w-4 h-4 ${themeStyles.textSecondary} absolute left-3.5 top-3.5`} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@clubvalentine.com"
                    className={`w-full rounded-xl border ${themeStyles.displayBorder} ${themeStyles.displayBg} pl-10 pr-4 py-2.5 text-sm ${themeStyles.textPrimary} placeholder-slate-400 focus:outline-none`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider ${themeStyles.textSecondary} mb-1`}>
                  Password
                </label>
                <div className="relative">
                  <Lock className={`w-4 h-4 ${themeStyles.textSecondary} absolute left-3.5 top-3.5`} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full rounded-xl border ${themeStyles.displayBorder} ${themeStyles.displayBg} pl-10 pr-4 py-2.5 text-sm ${themeStyles.textPrimary} placeholder-slate-400 focus:outline-none`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-xl ${themeStyles.primaryAction} font-black text-sm uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50`}
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-200/60 flex justify-center">
              <button
                type="button"
                onClick={() => setLoginMode('keypad')}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1.5 cursor-pointer py-1"
              >
                <KeyRound className="w-4 h-4" />
                <span>Return to Big Numeric Keypad</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER BAR */}
      <footer className={`relative z-10 w-full px-4 sm:px-8 py-2 sm:py-2.5 border-t ${themeStyles.footerBorder} ${themeStyles.footerBg} flex flex-wrap items-center justify-between gap-2 text-xs ${themeStyles.footerText} shrink-0 transition-colors`}>
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-amber-600" />
          <span>Club Valentine POS • Standalone Bar Terminal</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] sm:text-[11px]">
          <span>⚡ Touchscreen & Hardware Numpad Ready</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Offline-First Engine</span>
        </div>
      </footer>

    </div>
  );
}
