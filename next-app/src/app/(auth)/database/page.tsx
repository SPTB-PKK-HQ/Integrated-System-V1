'use client';

import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DatabaseForm from '@/components/database/DatabaseForm';
import { useProfileVisibility } from '@/hooks/useProfileVisibility';
import { useToast } from '@/hooks/useToast';
import { useSound } from '@/hooks/useSound';

export default function DatabasePage() {
  const { user } = useAuth();
  const { showProfile } = useProfileVisibility();
  const { showToast } = useToast();
  const { play } = useSound();

  const handleCreateProfile = () => {
    showProfile();
    play('click');
    showToast('Tab Profil Syarikat telah diaktifkan di sidebar', 'info');
    window.location.href = '/profile';
  };

  return (
    <ProtectedRoute>
      <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
            <div>
              <p className="text-white/60 text-xs">Selamat Datang</p>
              <h1 className="text-white font-bold text-lg">{user?.name}</h1>
              <p className="text-white/50 text-xs">{user?.role} — {user?.email}</p>
            </div>
          </div>

          {/* Profile Button */}
          <div className="text-right">
            <button onClick={handleCreateProfile}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg transition">
              🏢 Cipta Profile Syarikat
            </button>
          </div>

          {/* Database Form */}
          {user?.email && (
            <DatabaseForm userEmail={user.email} userName={user.name} />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
