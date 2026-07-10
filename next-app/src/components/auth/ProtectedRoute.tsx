'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import type { Role } from '@/types';

interface Props {
  children: React.ReactNode;
  allowedRoles?: Role[];
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({ children, allowedRoles, fallback }: Props) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 z-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Memuatkan data...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback ? <>{fallback}</> : null;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center p-8 bg-red-50 rounded-2xl border border-red-200">
          <p className="text-4xl mb-4">🚫</p>
          <h2 className="text-xl font-bold text-red-700 mb-2">Akses Ditolak</h2>
          <p className="text-red-600">Role &ldquo;{user.role}&rdquo; tidak mempunyai kebenaran untuk halaman ini.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
