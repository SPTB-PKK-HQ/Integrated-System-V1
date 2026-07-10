'use client';

import type { DashboardFilters as DF } from '@/hooks/useDashboard';

interface Props {
  filters: DF;
  onChange: <K extends keyof DF>(key: K, value: DF[K]) => void;
  role: string;
}

export default function DashboardFilters({ filters, onChange, role }: Props) {
  const years: number[] = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 5; y <= currentYear + 1; y++) years.push(y);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={filters.period}
        onChange={(e) => onChange('period', e.target.value as DF['period'])}
        className="bg-white/10 border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-400"
      >
        <option value="monthly" className="text-gray-800">Bulanan</option>
        <option value="yearly" className="text-gray-800">Tahunan</option>
        <option value="daily" className="text-gray-800">Harian</option>
      </select>

      <select
        value={filters.year}
        onChange={(e) => onChange('year', parseInt(e.target.value))}
        className="bg-white/10 border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-400"
      >
        {years.map((y) => (
          <option key={y} value={y} className="text-gray-800">{y}</option>
        ))}
      </select>

      {filters.period !== 'yearly' && (
        <select
          value={filters.month}
          onChange={(e) => onChange('month', parseInt(e.target.value))}
          className="bg-white/10 border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-400"
        >
          {['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'].map((m, i) => (
            <option key={i} value={i + 1} className="text-gray-800">{m}</option>
          ))}
        </select>
      )}

      {filters.period === 'daily' && (
        <>
          <select
            value={filters.day}
            onChange={(e) => onChange('day', parseInt(e.target.value))}
            className="bg-white/10 border border-white/20 text-white rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-400"
          >
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i} value={i + 1} className="text-gray-800">{String(i + 1).padStart(2, '0')}</option>
            ))}
          </select>
          <a href={`/laporan-harian?year=${filters.year}&month=${filters.month}&day=${filters.day}`} target="_blank"
            className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap">
            📄 Laporan Harian
          </a>
        </>
      )}

      <div className="ml-auto text-white/60 text-xs">
        {role === 'PENGESYOR' && 'Statistik berdasarkan syor anda (SOKONG/TIDAK DISOKONG)'}
        {role === 'PELULUS' && 'Statistik berdasarkan keputusan anda (LULUS/TOLAK)'}
        {['ADMIN', 'KETUA_SEKSYEN', 'PENGARAH'].includes(role) && 'Statistik keseluruhan sistem'}
      </div>
    </div>
  );
}
