'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Hero from '@/components/landing/Hero';
import Changelog from '@/components/landing/Changelog';
import FeatureCards from '@/components/landing/FeatureCards';

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/80 font-medium">Memuatkan data...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/80 font-medium">Mengarahkan ke dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-6">
        <Hero />
        <Changelog />
        <FeatureCards />
        <footer className="text-center pt-8 pb-4">
          <p className="text-white/40 text-xs">
            Sistem Bersepadu SPTB (HQ) &copy; 2026 KUSKOP. Hak Cipta Terpelihara.
          </p>
        </footer>
      </div>
    </div>
  );
}
