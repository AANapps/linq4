import React, { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const ADMIN_EMAIL = 'info@adastranetwork.co.uk';

type PortalUser = {
  uid: string;
  email: string;
  role: 'vendor' | 'admin';
  name?: string;
  storeName?: string;
};

function LoginForm({ onLogin }: { onLogin: (user: PortalUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      const userEmail = cred.user.email ?? '';

      // Check admin first
      if (userEmail === ADMIN_EMAIL) {
        onLogin({ uid, email: userEmail, role: 'admin' });
        return;
      }

      // Check vendors collection
      const vendorSnap = await getDoc(doc(db, 'vendors', uid));
      if (vendorSnap.exists()) {
        const data = vendorSnap.data();
        if (data?.role === 'admin' || data?.isAdmin === true || userEmail === ADMIN_EMAIL) {
          onLogin({ uid, email: userEmail, role: 'admin', name: data?.displayName });
          return;
        }
        onLogin({
          uid,
          email: userEmail,
          role: 'vendor',
          name: data?.displayName,
          storeName: data?.storeName,
        });
        return;
      }

      // Check users collection for admin role
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data?.role === 'admin' || data?.isAdmin === true) {
          onLogin({ uid, email: userEmail, role: 'admin', name: data?.displayName });
          return;
        }
      }

      setError('This account does not have vendor or admin access.');
      await signOut(auth);
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Incorrect email or password.');
      } else {
        setError(err.message ?? 'Login failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Linq</h1>
          <p className="mt-1 text-gray-500 text-sm">Vendor & Admin Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-black text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          <a href="/" className="hover:text-gray-600">← Back to Linq</a>
        </p>
      </div>
    </div>
  );
}

function Dashboard({ user, onSignOut }: { user: PortalUser; onSignOut: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="font-bold text-lg">Linq</span>
          <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{user.role}</span>
        </div>
        <button
          onClick={onSignOut}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          Sign out
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 text-center">
        <h2 className="text-2xl font-bold">
          {user.role === 'admin' ? 'Admin Dashboard' : `Welcome, ${user.storeName || user.name || 'Vendor'}`}
        </h2>
        <p className="mt-3 text-gray-500 text-sm">
          {user.role === 'admin'
            ? 'Full dashboard coming soon.'
            : 'Your vendor dashboard is coming soon.'}
        </p>
        <p className="mt-1 text-gray-400 text-xs">{user.email}</p>
      </main>
    </div>
  );
}

export default function PortalApp() {
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (!firebaseUser) {
        setPortalUser(null);
        setChecking(false);
        return;
      }
      const uid = firebaseUser.uid;
      const email = firebaseUser.email ?? '';

      if (email === ADMIN_EMAIL) {
        setPortalUser({ uid, email, role: 'admin' });
        setChecking(false);
        return;
      }

      const vendorSnap = await getDoc(doc(db, 'vendors', uid));
      if (vendorSnap.exists()) {
        const data = vendorSnap.data();
        if (data?.role === 'admin' || data?.isAdmin === true) {
          setPortalUser({ uid, email, role: 'admin', name: data?.displayName });
        } else {
          setPortalUser({ uid, email, role: 'vendor', name: data?.displayName, storeName: data?.storeName });
        }
        setChecking(false);
        return;
      }

      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data?.role === 'admin' || data?.isAdmin === true) {
          setPortalUser({ uid, email, role: 'admin', name: data?.displayName });
          setChecking(false);
          return;
        }
      }

      // Not a vendor/admin — sign out
      await signOut(auth);
      setPortalUser(null);
      setChecking(false);
    });
    return unsub;
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    setPortalUser(null);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (portalUser) {
    return <Dashboard user={portalUser} onSignOut={handleSignOut} />;
  }

  return <LoginForm onLogin={setPortalUser} />;
}
