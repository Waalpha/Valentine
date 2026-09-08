import React, { useState } from 'react';
import { auth, db, DEFAULT_BUSINESS_ID } from '../../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Wine, Lock, Mail, AlertCircle, ShieldCheck, UserCheck } from 'lucide-react';
import { UserProfile } from '../../types';
import { logAuditAction } from '../../lib/utils';
import { initializeDatabase } from '../../lib/dbSeeder';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await initializeDatabase(userCred.user);
      
      // Check user profile
      const userDocRef = doc(db, 'users', userCred.user.uid);
      const userSnap = await getDoc(userDocRef);
      let role = 'cashier';
      let name = userCred.user.email || 'User';
      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        role = data.role;
        name = data.name;
      } else {
        // Create default profile if missing
        role = email.includes('admin') ? 'admin' : 'cashier';
        const profile: UserProfile = {
          uid: userCred.user.uid,
          email: userCred.user.email || email,
          name: role === 'admin' ? 'Master Admin' : 'Bar Cashier',
          role: role as any,
          businessId: DEFAULT_BUSINESS_ID,
          status: 'active',
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, profile);
      }

      await logAuditAction(userCred.user.uid, name, 'LOGIN', `User logged in as ${role}`);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        const role = email.toLowerCase().includes('admin') ? 'admin' : 'cashier';
        const name = role === 'admin' ? 'Master Admin' : 'Bar Cashier';
        const fallbackUser: UserProfile = {
          uid: 'local-user-' + Date.now(),
          email: email.trim(),
          name,
          role,
          businessId: DEFAULT_BUSINESS_ID,
          status: 'active',
          createdAt: new Date().toISOString()
        };
        localStorage.setItem('bar_pos_local_user', JSON.stringify(fallbackUser));
        window.location.reload();
        return;
      }
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
      let userCred;
      try {
        userCred = await signInWithEmailAndPassword(auth, demoEmail, demoPass);
      } catch (err: any) {
        if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
          throw err;
        }
        userCred = await createUserWithEmailAndPassword(auth, demoEmail, demoPass);
      }

      await initializeDatabase(userCred.user);
      const role = demoEmail.includes('admin') ? 'admin' : 'cashier';
      const name = role === 'admin' ? 'Master Owner' : 'Main Cashier';

      const userDocRef = doc(db, 'users', userCred.user.uid);
      const profile: UserProfile = {
        uid: userCred.user.uid,
        email: demoEmail,
        name: name,
        role: role,
        businessId: DEFAULT_BUSINESS_ID,
        status: 'active',
        createdAt: new Date().toISOString()
      };
      await setDoc(userDocRef, profile, { merge: true });
      await logAuditAction(userCred.user.uid, name, 'LOGIN', `Demo login as ${role}`);
    } catch (err: any) {
      console.error(err);
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
      window.location.reload();
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
          <h1 className="text-2xl font-bold tracking-tight">Savanna Bar POS</h1>
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
