'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { gasPost } from '@/lib/gas';
import { type ApplicationRecord } from '@/types';
import { useSearchParams } from 'next/navigation';

const KEPUTUSAN_OPTIONS = ['', 'LULUS', 'LULUS BERSYARAT', 'PEMUTIHAN', 'TOLAK', 'TOLAK & BEKU'];
const ALASAN_OPTIONS = [
  '', 'Syarikat tidak aktif', 'Dokumen tidak lengkap', 'Gred tidak sesuai',
  'CIDB tidak sah', 'Tatatertib', 'Lain-lain',
];

export default function PelulusActionPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const rowId = searchParams.get('id');

  const [record, setRecord] = useState<ApplicationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [keputusan, setKeputusan] = useState('');
  const [alasan, setAlasan] = useState('');
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!rowId || !user?.email) return;
    (async () => {
      try {
        const result = await gasPost<{ status: string; data?: { records?: ApplicationRecord[] } }>({
          action: 'getRow', row: parseInt(rowId), email: user.email,
        });
        if (result.status === 'success' && result.data?.records?.length) {
          setRecord(result.data.records[0]);
        }
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, [rowId, user?.email]);

  const handleSubmit = async () => {
    if (!keputusan) { setMsg('Sila pilih keputusan.'); return; }
    if (!record) return;
    setSaving(true);
    setMsg('');
    try {
      const result = await gasPost<{ status: string; message?: string }>({
        action: 'submitData', row: record.row, email: user?.email,
        keputusan, alasan, catatan, syor_lawatan: record.syor_lawatan,
        pelulus: user?.name,
      });
      if (result.status === 'success') {
        setMsg('Keputusan berjaya dihantar!');
      } else {
        setMsg(result.message || 'Gagal menghantar keputusan.');
      }
    } catch { setMsg('Ralat rangkaian.'); } finally { setSaving(false); }
  };

  if (loading) return <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-white/30 border-t-white rounded-full" /></div>;

  if (!record) return (
    <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 text-center">
        <p className="text-4xl mb-2">📭</p>
        <p className="font-bold text-slate-700">Rekod tidak dijumpai.</p>
        <button onClick={() => window.location.href = '/pelulus-view'} className="mt-4 text-blue-600 underline text-sm">Kembali</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-white font-bold text-lg">⚖️ Keputusan Pelulus</h1>
            <p className="text-white/50 text-xs">{user?.name} — {user?.email}</p>
          </div>
          <button onClick={() => window.location.href = '/pelulus-view'}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-sm font-semibold transition">🔙 Kembali</button>
        </div>

        {/* Ringkasan */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">📄 Ringkasan Permohonan</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="font-semibold text-slate-600">Syarikat:</span> <span className="text-slate-800">{record.syarikat}</span></div>
            <div><span className="font-semibold text-slate-600">CIDB:</span> <span className="text-slate-800">{record.cidb}</span></div>
            <div><span className="font-semibold text-slate-600">Jenis:</span> <span className="text-slate-800">{record.jenis}</span></div>
            <div><span className="font-semibold text-slate-600">Gred:</span> <span className="text-slate-800">{record.gred}</span></div>
            <div><span className="font-semibold text-slate-600">Pengesyor:</span> <span className="text-slate-800">{record.pengesyor}</span></div>
            <div><span className="font-semibold text-slate-600">Syor:</span>
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${record.syor_status === 'SOKONG' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {record.syor_status}
              </span>
            </div>
          </div>
        </div>

        {/* Borang Keputusan */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">✍️ Keputusan</h2>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Keputusan</label>
            <select value={keputusan} onChange={(e) => setKeputusan(e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500">
              {KEPUTUSAN_OPTIONS.map((o) => <option key={o} value={o}>{o || '- Pilih -'}</option>)}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Alasan (jika Tolak)</label>
            <select value={alasan} onChange={(e) => setAlasan(e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500">
              {ALASAN_OPTIONS.map((o) => <option key={o} value={o}>{o || '- Pilih -'}</option>)}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Catatan Pelulus</label>
            <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500 resize-none" />
          </div>

          {msg && <p className={`text-sm font-bold mb-3 ${msg.includes('berjaya') ? 'text-emerald-600' : 'text-red-600'}`}>{msg}</p>}

          <button onClick={handleSubmit} disabled={saving}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-400 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition">
            {saving ? 'Menghantar...' : '📨 Hantar Keputusan'}
          </button>
        </div>
      </div>
    </div>
  );
}
