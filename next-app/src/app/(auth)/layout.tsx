'use client';

import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/auth/Sidebar';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { useCallback } from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();

  const onTimeout = useCallback(() => {
    alert('Sesi anda telah tamat kerana tidak aktif. Sila log masuk semula.');
    logout();
  }, [logout]);

  useInactivityTimeout(onTimeout, true);
  useAutoRefresh(() => {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('app-refresh');
      window.dispatchEvent(event);
    }
  }, 30000, true);

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
