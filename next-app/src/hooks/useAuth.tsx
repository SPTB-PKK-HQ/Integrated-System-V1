'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '@/types';
import { gasPost } from '@/lib/gas';
import { storage } from '@/lib/storage';
import { decodeJwtPayload } from '@/lib/utils';
import { STORAGE_KEYS } from '@/lib/constants';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() =>
    storage.get<User>(STORAGE_KEYS.SESSION)
  );
  const [isLoading, setIsLoading] = useState(() => !user);

  // Async session verification (runs once on mount)
  useEffect(() => {
    const saved = storage.get<User>(STORAGE_KEYS.SESSION);
    if (!saved?.email) {
      queueMicrotask(() => setIsLoading(false));
      return;
    }

    let cancelled = false;

    gasPost<{ authenticated: boolean; user?: User }>({
      action: 'checkAuth',
      email: saved.email,
    })
      .then((res) => {
        if (cancelled) return;
        if (res.authenticated && res.user) {
          setUser(res.user);
          storage.set(STORAGE_KEYS.SESSION, res.user);
        } else {
          setUser(null);
          storage.remove(STORAGE_KEYS.SESSION);
        }
      })
      .catch(() => {
        // GAS unavailable, keep cached session
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    const decoded = decodeJwtPayload(credential);
    if (!decoded?.email) throw new Error('Token Google tidak sah atau tiada e-mel.');

    const userEmail = decoded.email as string;
    const result = await gasPost<{ authenticated: boolean; user?: User; error?: string }>({
      action: 'checkAuth',
      email: userEmail,
    });

    if (!result.authenticated || !result.user) {
      throw new Error(result.error || 'Akses Ditolak: E-mel tidak didaftarkan.');
    }

    const userData = {
      ...result.user,
      email: userEmail.toLowerCase(),
    } as User;

    setUser(userData);
    storage.set(STORAGE_KEYS.SESSION, userData);
    storage.set(STORAGE_KEYS.LOGIN_DATE, new Date().toDateString());
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    storage.remove(STORAGE_KEYS.SESSION);
    storage.remove(STORAGE_KEYS.LOGIN_DATE);
  }, []);

  const checkSession = useCallback(async (): Promise<boolean> => {
    const currentUser = user ?? storage.get<User>(STORAGE_KEYS.SESSION);
    if (currentUser?.email) {
      try {
        const res = await gasPost<{ authenticated: boolean }>({
          action: 'checkAuth',
          email: currentUser.email,
        });
        return res.authenticated;
      } catch {
        return false;
      }
    }
    return !!currentUser;
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      loginWithGoogle,
      logout,
      checkSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
