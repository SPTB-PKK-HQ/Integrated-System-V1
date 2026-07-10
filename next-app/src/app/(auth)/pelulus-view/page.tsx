'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { gasPost } from '@/lib/gas';
import { type ApplicationRecord } from '@/types';

export default function PelulusViewPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [jenisFilter, setJenisFilter] = useState('');

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await gasPost<{ status: string; data: ApplicationRecord[] }>({
          action: 'getData', email: user.email, role: user.role,
        });
        if (!cancelled && result.status === 'success') setRecords(result.data || []);
      } catch { /* ignore */ } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.email, user?.role]);

  const filtered = useMemo(() => {
    let list = records.filter((r) => r.status === 'DISEMAK' || r.status === 'DITERIMA' || r.status === 'LULUS' || r.status === 'DITOLAK');
    if (jenisFilter) list = list.filter((r) => r.jenis === jenisFilter);
    return list;
  }, [records, jenisFilter]);

  const jenisOptions = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.jenis).filter(Boolean))).sort();
  }, [records]);

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { LULUS: 'bg-emerald-100 text-emerald-700', DITERIMA: 'bg-blue-100 text-blue-700', DITOLAK: 'bg-red-100 text-red-700', DISEMAK: 'bg-amber-100 text-amber-700' };
    return map[s] || 'bg-slate-100 text-slate-700';
  };

  if (loading) return <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-white/30 border-t-white rounded-full" /></div>;

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
          <h1 className="text-white font-bold text-lg">👁️ Paparan Pelulus</h1>
          <p className="text-white/50 text-xs">Ringkasan permohonan untuk diluluskan</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
          <label className="text-sm font-semibold text-slate-700">Jenis:</label>
          <select value={jenisFilter} onChange={(e) => setJenisFilter(e.target.value)}
            className="px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500">
            <option value="">Semua</option>
            {jenisOptions.map((j) => <option key={j}>{j}</option>)}
          </select>
          <span className="text-xs text-slate-500">{filtered.length} permohonan</span>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-500 font-bold">Tiada permohonan untuk dipaparkan.</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 border-b-2 border-slate-200">
                <th className="px-3 py-3 text-left font-bold text-slate-700">Syarikat</th>
                <th className="px-3 py-3 text-left font-bold text-slate-700">CIDB</th>
                <th className="px-3 py-3 text-left font-bold text-slate-700">Jenis</th>
                <th className="px-3 py-3 text-left font-bold text-slate-700">Pengesyor</th>
                <th className="px-3 py-3 text-left font-bold text-slate-700">Syor</th>
                <th className="px-3 py-3 text-left font-bold text-slate-700">Status</th>
                <th className="px-3 py-3 text-left font-bold text-slate-700">Tindakan</th>
              </tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.row} className="border-b border-slate-100 hover:bg-blue-50 transition">
                    <td className="px-3 py-3 font-semibold text-slate-800">{r.syarikat}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-600">{r.cidb}</td>
                    <td className="px-3 py-3">{r.jenis}</td>
                    <td className="px-3 py-3">{r.pengesyor}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${r.syor_status === 'SOKONG' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.syor_status}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${statusBadge(r.status)}`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => window.location.href = `/pelulus-action?id=${r.row}`}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">Lulus / Tolak</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
