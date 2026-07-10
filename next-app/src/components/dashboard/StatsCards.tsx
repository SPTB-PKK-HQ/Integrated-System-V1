'use client';

import type { DashboardStats } from '@/hooks/useDashboard';

interface Props {
  stats: DashboardStats;
  loading: boolean;
}

export default function StatsCards({ stats, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 animate-pulse">
            <div className="h-3 w-16 bg-white/20 rounded mb-3" />
            <div className="h-8 w-12 bg-white/20 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'JUMLAH',
      value: stats.total,
      color: 'from-blue-500 to-blue-600',
      icon: '📊',
    },
    {
      label: stats.labelSuccess || 'LULUS',
      value: stats.success,
      color: 'from-emerald-500 to-emerald-600',
      icon: '✅',
    },
    {
      label: stats.labelReject || 'TOLAK',
      value: stats.reject,
      color: 'from-red-500 to-red-600',
      icon: '❌',
    },
    {
      label: stats.labelStatus || 'PROSES',
      value: typeof stats.card4Value === 'number' ? stats.card4Value : stats.card4Value,
      color: 'from-amber-500 to-amber-600',
      icon: stats.labelStatus === 'PERATUS' ? '📈' : '⏳',
    },
  ];

  const isPercentage = stats.labelStatus === 'PERATUS';

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <div
            key={i}
            className="relative overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white/15 transition-all duration-300"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full bg-gradient-to-br ${card.color} opacity-10 translate-x-8 -translate-y-8`} />
            <p className="text-white/50 text-xs font-semibold tracking-wider mb-1">{card.label}</p>
            <p className="text-white text-3xl md:text-4xl font-bold">
              {card.value}
              {isPercentage && <span className="text-lg ml-1">%</span>}
            </p>
          </div>
        ))}
      </div>

      {stats.incompleteCount > 0 && (
        <div className="bg-red-500/20 border border-red-400/30 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="text-red-200 text-sm font-semibold">Dokumen Tidak Lengkap</p>
            <p className="text-red-100 text-xs">{stats.incompleteCount} item memerlukan perhatian</p>
          </div>
        </div>
      )}
    </>
  );
}
