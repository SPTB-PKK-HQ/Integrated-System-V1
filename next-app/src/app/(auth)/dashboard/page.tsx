'use client';

import { useAuth } from '@/hooks/useAuth';
import { useDashboard } from '@/hooks/useDashboard';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import StatsCards from '@/components/dashboard/StatsCards';
import Charts from '@/components/dashboard/Charts';
import DetailedTable from '@/components/dashboard/DetailedTable';

export default function DashboardPage() {
  const { user } = useAuth();
  const {
    loading,
    error,
    filters,
    updateFilter,
    stats,
    statusData,
    typeData,
    reasonData,
    trendData,
    detailedTable,
    userRole,
    userName,
  } = useDashboard(user);

  return (
    <ProtectedRoute>
      <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
            <div>
              <p className="text-white/60 text-xs">Selamat Datang</p>
              <h1 className="text-white font-bold text-lg">{userName || user?.name}</h1>
              <p className="text-white/50 text-xs">{userRole} — {user?.email}</p>
            </div>
          </div>

          {/* Filters */}
          <DashboardFilters filters={filters} onChange={updateFilter} role={userRole} />

          {/* Error */}
          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-2xl p-4 text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Stats Cards */}
          <StatsCards stats={stats} loading={loading} />

          {/* Charts */}
          {!loading && (
            <Charts
              statusData={statusData}
              typeData={typeData}
              reasonData={reasonData}
              trendData={trendData}
              role={userRole}
            />
          )}

          {/* Detailed Table */}
          {!loading && (
            <DetailedTable data={detailedTable} filters={filters} stats={stats} />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
