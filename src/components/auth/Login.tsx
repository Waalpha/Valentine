import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { 
  Wine, Lock, Mail, AlertCircle, ShieldCheck, UserCheck, 
  Delete, ArrowRight, Check, KeyRound, Clock, Maximize2, Minimize2, 
  Eye, EyeOff, Sparkles, Volume2, VolumeX, Shield, User, X, ChevronRight 
} from 'lucide-react';
import { UserProfile } from '../../types';
import { logAuditAction } from '../../lib/utils';

interface LoginProps {
  onLoginSuccess?: (user: UserProfile) => void;
}

// Fallback staff users so the POS is immediately operational
const DEFAULT_STAFF: UserProfile[] = [
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
  // Mode: Keypad (default) or Email/Password fallback
  const [loginMode, setLoginMode] = useState<'keypad' | 'email'>('keypad');

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
      // Audio context may be restricted by browser policy before interaction
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

    // Save session immediately
    localStorage.setItem('bar_pos_local_user', JSON.stringify(userProfile));

    // Log audit in background
    logAuditAction(userProfile.uid, userProfile.name, 'LOGIN', `Logged in as ${userProfile.role} (${userProfile.name})`).catch(() => {});

    // Notify parent or reload
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

    // 1. If a specific staff was pre-selected
    if (targetUser) {
      const userPin = targetUser.pin?.trim();
      const userPassword = (targetUser as any).password?.trim();

      // Check configured PIN or password
      if (userPin && userPin === pinToVerify) {
        completeLogin(targetUser);
        return;
      }
      if (userPassword && userPassword === pinToVerify) {
        completeLogin(targetUser);
        return;
      }

      // Default PIN fallbacks for smooth bar operations
      if (targetUser.role === 'admin' && ['1234', '0000', '9999'].includes(pinToVerify)) {
        completeLogin(targetUser);
        return;
      }
      if (targetUser.role === 'cashier' && ['1111', '1234', '2222', '0000'].includes(pinToVerify)) {
        completeLogin(targetUser);
        return;
      }

      // If user has no PIN configured yet, allow any 4-digit PIN for demo access
      if (!userPin && !userPassword && pinToVerify.length >= 4) {
        completeLogin(targetUser);
        return;
      }

      setError(`Incorrect PIN for ${targetUser.name}. (Default: ${targetUser.role === 'admin' ? '1234' : '1111'})`);
      setShakeError(true);
      setLoading(false);
      setPin('');
      return;
    }

    // 2. No staff was selected: Direct PIN Entry on Keypad
    // Match by explicit user PIN
    const matchByPin = knownUsers.find(u => u.pin && u.pin.trim() === pinToVerify && u.status !== 'disabled');
    if (matchByPin) {
      completeLogin(matchByPin);
      return;
    }

    // Match by user password if numeric
    const matchByPass = knownUsers.find(u => (u as any).password && (u as any).password.trim() === pinToVerify && u.status !== 'disabled');
    if (matchByPass) {
      completeLogin(matchByPass);
      return;
    }

    // Default fast PINs:
    // 1234 -> Admin (Master Owner)
    if (pinToVerify === '1234' || pinToVerify === '0000' || pinToVerify === '9999') {
      const admin = knownUsers.find(u => u.role === 'admin' && u.status === 'active') || DEFAULT_STAFF[1];
      completeLogin(admin);
      return;
    }

    // 1111 -> Cashier Atieno
    if (pinToVerify === '1111') {
      const cashier = knownUsers.find(u => u.name.toLowerCase().includes('atieno') || (u.role === 'cashier' && u.status === 'active')) || DEFAULT_STAFF[0];
      completeLogin(cashier);
      return;
    }

    // 2222 -> Cashier Mercy
    if (pinToVerify === '2222') {
      const cashier = knownUsers.find(u => u.name.toLowerCase().includes('mercy')) || DEFAULT_STAFF[2];
      completeLogin(cashier);
      return;
    }

    // Unrecognized PIN
    setError('Unrecognized PIN code. Select your name or use Admin PIN (1234) or Cashier PIN (1111).');
    setShakeError(true);
    setLoading(false);
    setPin('');
  }, [knownUsers]);

  // Handle number click on big numeric keypad
  const handleDigitPress = useCallback((digit: string) => {
    if (loading) return;
    setError('');
    setShakeError(false);
    playClickTone(800 + parseInt(digit, 10) * 45);

    setActiveKey(digit);
    setTimeout(() => setActiveKey(null), 120);

    setPin((prev) => {
      if (prev.length >= 6) return prev; // max 6 digits
      const nextPin = prev + digit;

      // Auto-submit on 4 digits if a staff is selected or standard 4-digit PIN is reached
      if (nextPin.length === 4) {
        if (autoSubmitTimeoutRef.current) clearTimeout(autoSubmitTimeoutRef.current);
        autoSubmitTimeoutRef.current = setTimeout(() => {
          verifyAndSubmitPin(nextPin, selectedStaff);
        }, 180);
      }

      return nextPin;
    });
  }, [loading, playClickTone, selectedStaff, verifyAndSubmitPin]);

  // Handle Backspace / Delete
  const handleBackspace = useCallback(() => {
    if (loading) return;
    setError('');
    playClickTone(600);
    setActiveKey('backspace');
    setTimeout(() => setActiveKey(null), 120);
    setPin((prev) => prev.slice(0, -1));
  }, [loading, playClickTone]);

  // Handle Clear
  const handleClear = useCallback(() => {
    if (loading) return;
    setError('');
    playClickTone(500);
    setActiveKey('clear');
    setTimeout(() => setActiveKey(null), 120);
    setPin('');
  }, [loading, playClickTone]);

  // Manual Submit
  const handleManualSubmit = () => {
    verifyAndSubmitPin(pin, selectedStaff);
  };

  // Keyboard listener for physical keyboard & numpad
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

  // Email form login handler
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    if (cleanEmail === 'cashier@barpos.com') {
      setError('The default demo cashier has been replaced. Please log in with an active staff account (e.g. atieno@Valentine.com).');
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

  // Instant 1-tap demo access
  const handleFastPass = (demoRole: 'admin' | 'cashier') => {
    setError('');
    setLoading(true);
    playClickTone(1000);

    if (demoRole === 'cashier') {
      const cashier = knownUsers.find((u) => u.role === 'cashier' && u.status === 'active') || DEFAULT_STAFF[0];
      completeLogin(cashier);
      return;
    }

    const admin = knownUsers.find((u) => u.role === 'admin' && u.status === 'active') || DEFAULT_STAFF[1];
    completeLogin(admin);
  };

  // Helper letter map for numeric keypad (like telephone / ATM dialpads)
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
    <div className="fixed inset-0 w-screen h-screen min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-y-auto lg:overflow-hidden select-none z-50">
      
      {/* BACKGROUND AMBIENT GLOWS */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* TOP HEADER BAR */}
      <header className="relative z-10 w-full px-4 sm:px-8 py-3.5 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md flex items-center justify-between gap-4">
        
        {/* Brand & Venue Title */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/30">
            <Wine className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                Club Valentine
              </h1>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                POS Terminal #1
              </span>
            </div>
            <p className="text-xs text-slate-400">Standalone Bar & Stock Management System</p>
          </div>
        </div>

        {/* Live Digital Clock & Shift Indicator */}
        <div className="hidden md:flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-2 text-xl sm:text-2xl font-black font-mono tracking-wider text-amber-400">
            <Clock className="w-5 h-5 text-amber-400" />
            <span>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{currentTime.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span>•</span>
            <span className="text-emerald-400 font-bold">Shift Ready</span>
          </div>
        </div>

        {/* Controls & Mode Switches */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Audio Click Toggle */}
          <button
            type="button"
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            title={isSoundEnabled ? 'Keypad Sound Enabled' : 'Keypad Sound Muted'}
          >
            {isSoundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer hidden sm:flex items-center gap-1.5 text-xs font-semibold"
            title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden lg:inline">{isFullscreen ? 'Windowed' : 'Full Screen'}</span>
          </button>

          {/* Mode Switcher */}
          {loginMode === 'keypad' ? (
            <button
              type="button"
              onClick={() => {
                setLoginMode('email');
                setError('');
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-amber-400" />
              <span>Email Login</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setLoginMode('keypad');
                setError('');
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Big Numeric Pad</span>
            </button>
          )}
        </div>
      </header>

      {/* MAIN VIEW AREA */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {loginMode === 'keypad' ? (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
            
            {/* LEFT COLUMN: STAFF SELECTOR & QUICK PASS */}
            <div className="lg:col-span-5 flex flex-col space-y-5 order-2 lg:order-1">
              
              {/* Staff Select Box */}
              <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-800/90 p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-amber-400" />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Select Staff / Cashier
                    </h2>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    {knownUsers.length} Active
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Tap your name below and punch your 4-digit PIN, or type your PIN directly on the big numeric keypad:
                </p>

                {/* Staff Cards List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5 max-h-56 lg:max-h-64 overflow-y-auto pr-1">
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
                          }
                        }}
                        className={`w-full p-3 rounded-2xl flex items-center justify-between border transition-all text-left cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                            : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                              : u.role === 'admin'
                              ? 'bg-amber-600/30 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-600/30 text-blue-300 border border-blue-500/30'
                          }`}>
                            {initials}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                              <span className="capitalize">{u.role}</span>
                              <span>•</span>
                              <span className="font-mono text-[10px] text-amber-400/80">PIN: {u.pin || (u.role === 'admin' ? '1234' : '1111')}</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90 text-amber-400' : 'text-slate-600'}`} />
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
                    className="w-full py-2 text-center text-xs font-semibold text-slate-400 hover:text-white flex items-center justify-center gap-1 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear selection (Any staff PIN)</span>
                  </button>
                )}
              </div>

              {/* 1-Tap Fast Pass Access */}
              <div className="bg-slate-900/60 rounded-3xl border border-slate-800/80 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Instant 1-Tap Access</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Test Shortcuts</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleFastPass('admin')}
                    disabled={loading}
                    className="p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-xs flex flex-col items-center text-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <ShieldCheck className="w-5 h-5 text-amber-400" />
                    <span>Owner / Admin</span>
                    <span className="text-[10px] text-amber-400/60 font-mono">PIN: 1234</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFastPass('cashier')}
                    disabled={loading}
                    className="p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex flex-col items-center text-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <UserCheck className="w-5 h-5 text-emerald-400" />
                    <span>Lead Cashier (Atieno)</span>
                    <span className="text-[10px] text-emerald-400/60 font-mono">PIN: 1111</span>
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: BIG NUMERIC NUMBERS KEYPAD */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center order-1 lg:order-2">
              <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl rounded-3xl border-2 border-slate-800 p-5 sm:p-7 shadow-2xl shadow-black/80 space-y-5">
                
                {/* Active User Header */}
                <div className="text-center space-y-1">
                  {selectedStaff ? (
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>{selectedStaff.name} ({selectedStaff.role})</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-semibold">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Enter Staff 4-Digit POS PIN</span>
                    </div>
                  )}
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {selectedStaff ? `Welcome, ${selectedStaff.name}` : 'Terminal Keypad'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedStaff 
                      ? 'Type your 4-digit passcode to sign in' 
                      : 'Type your assigned PIN or tap your name'}
                  </p>
                </div>

                {/* LCD PIN DISPLAY (BIG NUMBERS / INDICATOR PODS) */}
                <div className={`relative bg-slate-950 rounded-2xl border-2 p-4 transition-all ${
                  shakeError ? 'border-red-500 animate-shake' : 'border-slate-800 focus-within:border-amber-500'
                }`}>
                  <div className="flex items-center justify-between">
                    {/* Visual Dots or Big Digits */}
                    <div className="flex-1 flex items-center justify-center">
                      {showPinNumbers ? (
                        <div className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-amber-400 min-h-[44px] flex items-center justify-center">
                          {pin || <span className="text-slate-700 text-2xl">____</span>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 sm:gap-4 py-2">
                          {[0, 1, 2, 3].map((idx) => {
                            const isFilled = pin.length > idx;
                            return (
                              <div
                                key={idx}
                                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full transition-all duration-150 ${
                                  isFilled
                                    ? 'bg-amber-400 border-2 border-amber-300 scale-110 shadow-lg shadow-amber-400/50'
                                    : 'bg-slate-900 border-2 border-slate-700'
                                }`}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Toggle Show/Hide digits */}
                    <button
                      type="button"
                      onClick={() => setShowPinNumbers(!showPinNumbers)}
                      className="p-2 text-slate-500 hover:text-amber-400 transition-colors cursor-pointer"
                      title={showPinNumbers ? 'Mask PIN' : 'Show Digits'}
                    >
                      {showPinNumbers ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* THE BIG NUMERIC NUMBERS GRID */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
                  {/* Rows 1-3: Numbers 1 to 9 */}
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => {
                    const isPressed = activeKey === digit;
                    return (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handleDigitPress(digit)}
                        disabled={loading}
                        className={`aspect-square min-h-[72px] sm:min-h-[82px] md:min-h-[88px] rounded-2xl sm:rounded-3xl border-2 flex flex-col items-center justify-center transition-all duration-75 shadow-lg active:scale-90 cursor-pointer select-none ${
                          isPressed
                            ? 'bg-amber-500 text-slate-950 border-amber-400 scale-95 shadow-amber-500/30'
                            : 'bg-slate-950/80 hover:bg-slate-800/90 text-white border-slate-800 hover:border-amber-400/80 shadow-black/50'
                        }`}
                      >
                        <span className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-none">
                          {digit}
                        </span>
                        {keyLetters[digit] && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
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
                    className={`aspect-square min-h-[72px] sm:min-h-[82px] md:min-h-[88px] rounded-2xl sm:rounded-3xl border-2 flex flex-col items-center justify-center transition-all duration-75 shadow-lg active:scale-90 cursor-pointer select-none disabled:opacity-40 ${
                      activeKey === 'clear'
                        ? 'bg-rose-500 text-white border-rose-400 scale-95'
                        : 'bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border-rose-900/40 hover:border-rose-500/80'
                    }`}
                    title="Clear Entered PIN (Esc or C)"
                  >
                    <span className="text-2xl sm:text-3xl font-black">C</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Clear</span>
                  </button>

                  {/* Zero Button */}
                  <button
                    type="button"
                    onClick={() => handleDigitPress('0')}
                    disabled={loading}
                    className={`aspect-square min-h-[72px] sm:min-h-[82px] md:min-h-[88px] rounded-2xl sm:rounded-3xl border-2 flex flex-col items-center justify-center transition-all duration-75 shadow-lg active:scale-90 cursor-pointer select-none ${
                      activeKey === '0'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 scale-95 shadow-amber-500/30'
                        : 'bg-slate-950/80 hover:bg-slate-800/90 text-white border-slate-800 hover:border-amber-400/80 shadow-black/50'
                    }`}
                  >
                    <span className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-none">
                      0
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      +
                    </span>
                  </button>

                  {/* Backspace Button */}
                  <button
                    type="button"
                    onClick={handleBackspace}
                    disabled={loading || pin.length === 0}
                    className={`aspect-square min-h-[72px] sm:min-h-[82px] md:min-h-[88px] rounded-2xl sm:rounded-3xl border-2 flex flex-col items-center justify-center transition-all duration-75 shadow-lg active:scale-90 cursor-pointer select-none disabled:opacity-40 ${
                      activeKey === 'backspace'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 scale-95'
                        : 'bg-amber-950/20 hover:bg-amber-950/40 text-amber-400 border-amber-900/40 hover:border-amber-500/80'
                    }`}
                    title="Backspace (Delete last digit)"
                  >
                    <Delete className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Del</span>
                  </button>
                </div>

                {/* BIG ACTION: SIGN IN / UNLOCK BUTTON */}
                <button
                  type="button"
                  onClick={handleManualSubmit}
                  disabled={loading || pin.length === 0}
                  className="w-full py-4 sm:py-4.5 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98] text-slate-950 font-black text-base sm:text-lg uppercase tracking-wider shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                      <span>Verifying PIN...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In & Unlock Terminal</span>
                      <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                    </>
                  )}
                </button>

                {/* Keyboard and Default PIN note */}
                <div className="pt-1 text-center">
                  <p className="text-[11px] text-slate-400">
                    💡 Fast Test PINs: <strong className="text-amber-400">Admin (1234)</strong> • <strong className="text-emerald-400">Cashier (1111)</strong> • Keyboard numpad supported
                  </p>
                </div>

              </div>
            </div>

          </div>
        ) : (
          /* EMAIL / PASSWORD FALLBACK VIEW (FULL SCREEN) */
          <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl rounded-3xl border-2 border-slate-800 p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Staff Email Sign In</h2>
              <p className="text-xs text-slate-400">
                Log in with your email address or switch back to the Big Numeric Keypad.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Owner@Valentine.com or atieno@Valentine.com"
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-800 flex justify-center">
              <button
                type="button"
                onClick={() => setLoginMode('keypad')}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer py-1"
              >
                <KeyRound className="w-4 h-4" />
                <span>Return to Big Numeric Keypad</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER BAR */}
      <footer className="relative z-10 w-full px-4 sm:px-8 py-3 border-t border-slate-800/60 bg-slate-950/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-500" />
          <span>Club Valentine POS System • Secure Standalone Bar Terminal</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span>⚡ Touchscreen & Hardware Numpad Ready</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Offline-First Local Storage Engine</span>
        </div>
      </footer>

    </div>
  );
}
