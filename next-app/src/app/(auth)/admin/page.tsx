'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { gasPost } from '@/lib/gas';
import { type ApplicationRecord } from '@/types';

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [records, setRecords] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const result = await gasPost<{ status: string; data: ApplicationRecord[] }>({
          action: 'getAllRecords',
          email: user.email,
        });
        if (!cancelled) {
          if (result.status === 'success' && Array.isArray(result.data)) {
            setRecords(result.data);
          } else {
            setRecords([]);
          }
        }
      } catch {
        if (!cancelled) {
          setError('Gagal mengambil data.');
          setRecords([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.email]);

  const stats = useMemo(() => {
    const total = records.length;
    const statusCount: Record<string, number> = {};
    const jenisCount: Record<string, number> = {};
    const negeriCount: Record<string, number> = {};
    const syorPending: ApplicationRecord[] = [];
    const tiadaPautan: ApplicationRecord[] = [];
    records.forEach((r) => {
      statusCount[r.status] = (statusCount[r.status] || 0) + 1;
      if (r.jenis) jenisCount[r.jenis] = (jenisCount[r.jenis] || 0) + 1;
      if (r.negeri) negeriCount[r.negeri] = (negeriCount[r.negeri] || 0) + 1;
      if (r.status === 'DRAF' || r.status === 'DISEMAK') syorPending.push(r);
      if (!r.pautan_drive) tiadaPautan.push(r);
    });
    return { total, statusCount, jenisCount, negeriCount, syorPending, tiadaPautan };
  }, [records]);

  const chartData = useMemo(() => {
    const labels = Object.keys(stats.statusCount);
    const values = Object.values(stats.statusCount);
    return { labels, values };
  }, [stats.statusCount]);

  const maxVal = Math.max(...chartData.values, 1);

  if (loading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-12 text-center shadow-xl">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-500 font-bold">Memuatkan data pentadbiran...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-12 text-center shadow-xl">
          <p className="text-red-600 font-bold text-lg">⚠️ {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-white/60 text-xs">Panel Pentadbir</p>
            <h1 className="text-white font-bold text-xl">⚙️ Admin Dashboard</h1>
            <p className="text-white/50 text-xs">{user?.name} — {user?.email}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.location.href = '/dashboard'}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-sm font-semibold transition">📊 Dashboard</button>
            <button onClick={() => window.location.href = '/list'}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-sm font-semibold transition">📋 List</button>
            <button onClick={logout}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 px-4 py-2 rounded-xl text-sm font-semibold transition">🚪 Logout</button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border-l-4 border-blue-500 p-4">
            <p className="text-xs text-slate-500 font-semibold">Jumlah Rekod</p>
            <p className="text-3xl font-bold text-blue-700">{stats.total}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border-l-4 border-amber-500 p-4">
            <p className="text-xs text-slate-500 font-semibold">Syor Pending</p>
            <p className="text-3xl font-bold text-amber-700">{stats.syorPending.length}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border-l-4 border-red-500 p-4">
            <p className="text-xs text-slate-500 font-semibold">Tiada Pautan Drive</p>
            <p className="text-3xl font-bold text-red-700">{stats.tiadaPautan.length}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border-l-4 border-emerald-500 p-4">
            <p className="text-xs text-slate-500 font-semibold">Jenis Berbeza</p>
            <p className="text-3xl font-bold text-emerald-700">{Object.keys(stats.jenisCount).length}</p>
          </div>
        </div>

        {/* Chart + Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-bold text-slate-700 mb-4">📊 Status Permohonan</h2>
            <div className="space-y-3">
              {chartData.labels.map((label, i) => (
                <div key={label}>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-700">{label || '(tiada status)'}</span>
                    <span className="text-blue-700">{chartData.values[i]}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${(chartData.values[i] / maxVal) * 100}%` }} />
                  </div>
                </div>
              ))}
              {chartData.labels.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-4">Tiada data</p>
              )}
            </div>
          </div>

          {/* Jenis Distribution */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-bold text-slate-700 mb-4">📁 Jenis Permohonan</h2>
            <div className="space-y-2">
              {Object.entries(stats.jenisCount).sort((a, b) => b[1] - a[1]).map(([jenis, count]) => (
                <div key={jenis} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                  <span className="text-sm font-medium text-slate-700">{jenis}</span>
                  <span className="text-sm font-bold text-blue-700">{count}</span>
                </div>
              ))}
              {Object.keys(stats.jenisCount).length === 0 && (
                <p className="text-slate-400 text-sm text-center py-4">Tiada data</p>
              )}
            </div>
          </div>
        </div>

        {/* Alerts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Syor Pending */}
          <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-6">
            <h2 className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              Syor Perlu Tindakan ({stats.syorPending.length})
            </h2>
            {stats.syorPending.length === 0 ? (
              <p className="text-slate-400 text-sm">Tiada rekod pending.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2">
                {stats.syorPending.slice(0, 20).map((r) => (
                  <div key={r.row}
                    className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-amber-100 transition"
                    onClick={() => window.location.href = `/database?id=${r.row}`}>
                    <span className="font-medium text-slate-700 truncate max-w-[200px]">{r.syarikat}</span>
                    <span className="text-xs text-amber-600 font-semibold">{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tiada Pautan Drive */}
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6">
            <h2 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Pautan Drive Hilang ({stats.tiadaPautan.length})
            </h2>
            {stats.tiadaPautan.length === 0 ? (
              <p className="text-slate-400 text-sm">Semua rekod ada pautan.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2">
                {stats.tiadaPautan.slice(0, 20).map((r) => (
                  <div key={r.row}
                    className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-red-100 transition"
                    onClick={() => window.location.href = `/database?id=${r.row}`}>
                    <span className="font-medium text-slate-700 truncate max-w-[200px]">{r.syarikat}</span>
                    <span className="text-xs text-red-600 font-mono">{r.cidb}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Negeri Distribution */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-700 mb-4">🗺️ Agihan Negeri</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(stats.negeriCount).sort((a, b) => b[1] - a[1]).map(([negeri, count]) => (
              <div key={negeri} className="bg-slate-50 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{count}</p>
                <p className="text-xs text-slate-500 font-medium">{negeri}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Log */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-700 mb-4">🕐 20 Rekod Terkini</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b-2 border-slate-200">
                  <th className="px-3 py-2 text-left font-bold text-slate-600">#</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-600">Syarikat</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-600">CIDB</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-600">Status</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-600">Tarikh</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-600">Pengesyor</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 20).map((r) => (
                  <tr key={r.row} className="border-b border-slate-100 hover:bg-blue-50 transition cursor-pointer"
                    onClick={() => window.location.href = `/database?id=${r.row}`}>
                    <td className="px-3 py-2 font-mono text-xs text-slate-400">{r.row}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{r.syarikat}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.cidb}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${
                        r.status === 'LULUS' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                        r.status === 'DITERIMA' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                        r.status === 'DITOLAK' ? 'bg-red-100 text-red-700 border-red-300' :
                        r.status === 'DRAF' ? 'bg-slate-100 text-slate-700 border-slate-300' :
                        'bg-amber-100 text-amber-700 border-amber-300'
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{r.date_submit}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{r.pengesyor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
