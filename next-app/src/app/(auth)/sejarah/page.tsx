'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { gasPost } from '@/lib/gas';
import { type ApplicationRecord } from '@/types';

export default function SejarahPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [jenisFilter, setJenisFilter] = useState('');

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await gasPost<{ status: string; data: ApplicationRecord[] }>({
          action: 'getAllRecords', email: user.email,
        });
        if (!cancelled && result.status === 'success') setRecords(result.data || []);
      } catch { /* ignore */ } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.email]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (r.status === 'DRAF') return false;
      if (search && !r.syarikat.toLowerCase().includes(search.toLowerCase()) && !r.cidb.includes(search)) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (jenisFilter && r.jenis !== jenisFilter) return false;
      return true;
    }).sort((a, b) => (b.date_submit || '').localeCompare(a.date_submit || ''));
  }, [records, search, statusFilter, jenisFilter]);

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { LULUS: 'bg-emerald-100 text-emerald-700', DITERIMA: 'bg-blue-100 text-blue-700', DITOLAK: 'bg-red-100 text-red-700', DISEMAK: 'bg-amber-100 text-amber-700' };
    return map[s] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
          <h1 className="text-white font-bold text-lg">📜 Sejarah Keputusan</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Carian</label>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Nama syarikat / CIDB..."
                className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500">
                <option value="">Semua</option>
                <option value="LULUS">LULUS</option>
                <option value="DITERIMA">DITERIMA</option>
                <option value="DITOLAK">DITOLAK</option>
                <option value="DISEMAK">DISEMAK</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Jenis</label>
              <select value={jenisFilter} onChange={(e) => setJenisFilter(e.target.value)}
                className="px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500">
                <option value="">Semua</option>
                <option value="BARU">BARU</option>
                <option value="PEMBAHARUAN">PEMBAHARUAN</option>
                <option value="UBAH MAKLUMAT">UBAH MAKLUMAT</option>
                <option value="UBAH GRED">UBAH GRED</option>
              </select>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">{filtered.length} rekod</p>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-500 font-bold">Tiada rekod.</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 border-b-2 border-slate-200">
                <th className="px-3 py-3 text-left font-bold text-slate-700">Syarikat</th>
                <th className="px-3 py-3 text-left font-bold text-slate-700">CIDB</th>
                <th className="px-3 py-3 text-left font-bold text-slate-700">Jenis</th>
                <th className="px-3 py-3 text-left font-bold text-slate-700">Pengesyor</th>
                <th className="px-3 py-3 text-left font-bold text-slate-700">Pelulus</th>
                <th className="px-3 py-3 text-left font-bold text-slate-700">Keputusan</th>
                <th className="px-3 py-3 text-left font-bold text-slate-700">Tarikh</th>
              </tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.row} className="border-b border-slate-100 hover:bg-blue-50 transition">
                    <td className="px-3 py-3 font-semibold text-slate-800">{r.syarikat}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-600">{r.cidb}</td>
                    <td className="px-3 py-3">{r.jenis}</td>
                    <td className="px-3 py-3 text-xs">{r.pengesyor}</td>
                    <td className="px-3 py-3 text-xs">{r.pelulus || '-'}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${statusBadge(r.status)}`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap">{r.date_submit}</td>
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
