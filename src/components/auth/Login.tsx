import React, { useState } from 'react';
import { auth, db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { Wine, Lock, Mail, AlertCircle, ShieldCheck, UserCheck } from 'lucide-react';
import { UserProfile } from '../../types';
import { logAuditAction } from '../../lib/utils';
import { initializeDatabase } from '../../lib/dbSeeder';

interface LoginProps {
  onLoginSuccess?: (user: UserProfile) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    try {
      // 1. Try Firebase Auth sign-in silently if available
      let firebaseAuthSuccess = false;
      let authenticatedUid: string | null = null;
      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
        firebaseAuthSuccess = true;
        authenticatedUid = userCred.user.uid;
        await initializeDatabase(userCred.user);
      } catch (authErr: any) {
        // Suppress expected auth/operation-not-allowed or user-not-found so it doesn't log console error
        const isOpNotAllowed = authErr?.code === 'auth/operation-not-allowed' || authErr?.message?.includes('operation-not-allowed');
        if (!isOpNotAllowed) {
          console.info("Using database profile session authentication");
        }
      }

      // 2. Check user profile in Firestore
      let userProfile: UserProfile | null = null;
      if (authenticatedUid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', authenticatedUid));
          if (userDoc.exists()) {
            userProfile = userDoc.data() as UserProfile;
          }
        } catch (dbErr) {
          console.warn("Could not read user profile doc:", dbErr);
        }
      }

      // 3. If not found via UID, check by email in Firestore
      if (!userProfile) {
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          usersSnap.forEach((docSnap) => {
            const u = docSnap.data() as any;
            if (u.email && u.email.toLowerCase() === cleanEmail) {
              userProfile = u as UserProfile;
            }
          });
        } catch (err) {
          // Fallback to local storage
        }
      }

      // 4. If not found in Firestore, check local users
      if (!userProfile) {
        try {
          const localUsers: any[] = JSON.parse(localStorage.getItem('bar_pos_local_users') || '[]');
          const found = localUsers.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
          if (found) {
            userProfile = found;
          }
        } catch (e) {
          // ignore
        }
      }

      // 5. Fallback profile creation for known roles or custom credentials
      if (!userProfile) {
        const role = cleanEmail.includes('admin') ? 'admin' : 'cashier';
        const name = role === 'admin' ? 'Master Admin' : 'Bar Cashier';
        userProfile = {
          uid: authenticatedUid || ('local-user-' + Date.now()),
          email: cleanEmail,
          name,
          role,
          businessId: DEFAULT_BUSINESS_ID,
          status: 'active',
          createdAt: new Date().toISOString()
        };

        try {
          await setDoc(doc(db, 'users', userProfile.uid), userProfile);
        } catch (e) {
          // ignore
        }
      }

      if (userProfile.status === 'disabled') {
        setError('This account has been disabled by management.');
        setLoading(false);
        return;
      }

      // Save user session
      localStorage.setItem('bar_pos_local_user', JSON.stringify(userProfile));
      await logAuditAction(userProfile.uid, userProfile.name, 'LOGIN', `User logged in as ${userProfile.role}`);

      if (onLoginSuccess) {
        onLoginSuccess(userProfile);
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');
    setLoading(true);

    try {
      const role = demoEmail.includes('admin') ? 'admin' : 'cashier';
      const name = role === 'admin' ? 'Master Owner' : 'Main Cashier';

      // Silent Firebase Auth attempt if enabled
      try {
        await signInWithEmailAndPassword(auth, demoEmail, demoPass);
      } catch (authErr: any) {
        // Do not throw or log operation-not-allowed
      }

      const profile: UserProfile = {
        uid: 'local-user-' + role,
        email: demoEmail,
        name,
        role,
        businessId: DEFAULT_BUSINESS_ID,
        status: 'active',
        createdAt: new Date().toISOString()
      };

      try {
        await initializeDatabase({ uid: profile.uid, email: profile.email, displayName: profile.name });
        await setDoc(doc(db, 'users', profile.uid), profile, { merge: true });
      } catch (e) {
        // ignore offline errors
      }

      localStorage.setItem('bar_pos_local_user', JSON.stringify(profile));
      await logAuditAction(profile.uid, name, 'LOGIN', `Demo login as ${role}`);

      if (onLoginSuccess) {
        onLoginSuccess(profile);
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      const role = demoEmail.includes('admin') ? 'admin' : 'cashier';
      const name = role === 'admin' ? 'Master Owner' : 'Main Cashier';
      const fallbackUser: UserProfile = {
        uid: 'local-user-' + role,
        email: demoEmail,
        name,
        role,
        businessId: DEFAULT_BUSINESS_ID,
        status: 'active',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('bar_pos_local_user', JSON.stringify(fallbackUser));
      if (onLoginSuccess) {
        onLoginSuccess(fallbackUser);
      } else {
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-zinc-900 to-neutral-950 p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl overflow-hidden border border-white/20">
        
        {/* Header */}
        <div className="bg-amber-600 p-6 text-center text-white">
          <div className="mx-auto w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
            <Wine className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Club Valentine</h1>
          <p className="text-amber-100 text-xs mt-1">Standalone Bar & Stock Management System</p>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {error && (
            <div className="mb-6 flex items-center space-x-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-200 animate-shake">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
                Email / Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@barpos.com or cashier@barpos.com"
                  className="w-full rounded-xl border border-gray-300 bg-gray-50/50 py-3.5 pl-11 pr-4 text-sm text-gray-950 placeholder-gray-400 focus:border-amber-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-300 bg-gray-50/50 py-3.5 pl-11 pr-4 text-sm text-gray-950 placeholder-gray-400 focus:border-amber-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-amber-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-600/30 hover:bg-amber-700 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Quick Demo Login Buttons */}
          <div className="mt-8 border-t border-gray-100 pt-6">
            <p className="text-center text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">
              Quick Demo Access
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleDemoLogin('admin@barpos.com', 'admin123456')}
                disabled={loading}
                className="flex items-center justify-center space-x-2 rounded-xl border border-amber-200 bg-amber-50/60 py-3 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100/80 transition-all shadow-xs"
              >
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>Admin Owner</span>
              </button>
              <button
                onClick={() => handleDemoLogin('cashier@barpos.com', 'cashier123456')}
                disabled={loading}
                className="flex items-center justify-center space-x-2 rounded-xl border border-emerald-200 bg-emerald-50/60 py-3 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100/80 transition-all shadow-xs"
              >
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Cashier POS</span>
              </button>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
