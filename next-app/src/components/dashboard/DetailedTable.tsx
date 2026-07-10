'use client';

import type { DashboardFilters, DashboardStats } from '@/hooks/useDashboard';

type RowData = {
  total: number;
  approved: number;
  rejected: number;
  inProcess: number;
  supported: number;
  notSupported: number;
  rate: number;
};

type DetailedTableData = {
  type: 'yearly';
  rows: Array<RowData & { month: string }>;
} | {
  type: 'daily';
  total: number;
} | {
  type: 'monthly';
  rows: Array<RowData & { week: string }>;
};

interface Props {
  data: DetailedTableData;
  filters: DashboardFilters;
  stats: DashboardStats;
}

export default function DetailedTable({ data, filters, stats }: Props) {
  if (data.type === 'daily') {
    const today = new Date(filters.year, filters.month - 1, filters.day);
    const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
    return (
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 text-center">
        <p className="text-white/60 text-sm">
          Paparan Harian: {days[today.getDay()]}, {today.toLocaleDateString('ms-MY')}
        </p>
        <p className="text-white text-2xl font-bold mt-2">{data.total} rekod</p>
      </div>
    );
  }

  const rows = data.rows;

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left text-white/60 font-semibold py-3 px-2">
              {data.type === 'yearly' ? 'Bulan' : 'Minggu'}
            </th>
            <th className="text-right text-white/60 font-semibold py-3 px-2">Jumlah</th>
            <th className="text-right text-emerald-400 font-semibold py-3 px-2">{stats.labelSuccess || 'Lulus'}</th>
            <th className="text-right text-red-400 font-semibold py-3 px-2">{stats.labelReject || 'Tolak'}</th>
            <th className="text-right text-amber-400 font-semibold py-3 px-2">Proses</th>
            <th className="text-right text-blue-400 font-semibold py-3 px-2">Kadar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="text-white font-medium py-2.5 px-2">
                {'month' in row ? (row as { month: string }).month : (row as { week: string }).week}
              </td>
              <td className="text-white text-right py-2.5 px-2">{row.total}</td>
              <td className="text-emerald-400 text-right py-2.5 px-2">{row.approved}</td>
              <td className="text-red-400 text-right py-2.5 px-2">{row.rejected}</td>
              <td className="text-amber-400 text-right py-2.5 px-2">{row.inProcess}</td>
              <td className="text-blue-400 text-right py-2.5 px-2 font-bold">{row.rate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
