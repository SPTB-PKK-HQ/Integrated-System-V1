'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { gasPost } from '@/lib/gas';
import { getFirestoreDb } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, Timestamp } from 'firebase/firestore';

interface BakulItem {
  id: string;
  syarikat?: string;
  nama?: string;
  cidb?: string;
  gred?: string;
  jenis?: string;
  daerah?: string;
  negeri?: string;
  pengesyor?: string;
  tarikh?: string;
  createdAt?: Timestamp;
  [key: string]: unknown;
}

export default function BakulPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<BakulItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user?.email) return;
    const dbFire = getFirestoreDb();
    const q = query(
      collection(dbFire, 'bakul'),
      where('pengesyor', '==', user.email),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: BakulItem[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as BakulItem));
      setItems(list);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user?.email]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  const processItem = (item: BakulItem) => {
    const params = new URLSearchParams();
    if (item.syarikat || item.nama) params.set('syarikat', (item.syarikat || item.nama || '').toUpperCase());
    if (item.cidb) params.set('cidb', item.cidb);
    if (item.gred) params.set('gred', item.gred);
    if (item.jenis) params.set('jenis', item.jenis);
    if (item.tarikh) params.set('tarikh', item.tarikh);
    router.push(`/checker?${params.toString()}`);
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Padamkan item ini daripada bakul?')) return;
    try {
      await deleteDoc(doc(getFirestoreDb(), 'bakul', id));
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch { /* ignore */ }
  };

  const sendToSPI = async () => {
    const selectedItems = items.filter((i) => selected.has(i.id));
    if (selectedItems.length === 0) { setMsg('Sila pilih item untuk dihantar ke SPI.'); return; }
    if (!confirm(`Hantar ${selectedItems.length} item ke Queue SPI?`)) return;

    setSending(true);
    setMsg('');

    const today = new Date().toISOString().slice(0, 10);
    let success = 0;
    let fail = 0;

    for (const item of selectedItems) {
      try {
        await gasPost({
          action: 'updateRecord',
          syarikat: item.syarikat || item.nama || '',
          cidb: item.cidb || '',
          gred: item.gred || '',
          jenis: item.jenis || '',
          syor_lawatan: 'YA',
          date_submit: today,
          hantar_emel_spi: true,
          pengesyor: user?.name || '',
          email: user?.email || '',
        });
        await deleteDoc(doc(getFirestoreDb(), 'bakul', item.id));
        success++;
      } catch {
        fail++;
      }
    }

    setMsg(`${success} dihantar ke SPI.${fail > 0 ? ` ${fail} gagal.` : ''}`);
    setSending(false);
    setSelected(new Set());
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-white font-bold text-lg">🛒 Bakul Permohonan</h1>
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{items.length}</span>
          </div>
        </div>

        {msg && (
          <div className={`bg-white rounded-2xl p-4 text-center font-bold ${msg.includes('gagal') ? 'text-red-600' : 'text-emerald-600'}`}>
            {msg}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <p className="text-4xl mb-2">🛒</p>
            <p className="text-slate-500 font-bold">Bakul kosong.</p>
            <p className="text-slate-400 text-sm">Guna Tapisan Excel untuk tambah item ke bakul.</p>
          </div>
        ) : (
          <>
            {/* Batch Actions */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex items-center flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={toggleAll} className="rounded" />
                <span className="font-semibold">Pilih Semua ({items.length})</span>
              </label>
              <span className="text-xs text-slate-400">|</span>
              <span className="text-sm text-slate-500">{selected.size} dipilih</span>
              <button onClick={sendToSPI} disabled={sending || selected.size === 0}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1">
                {sending ? '⏳ Menghantar...' : '📤 Hantar ke SPI'}
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b-2 border-slate-200">
                  <th className="px-3 py-3 w-10"><input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={toggleAll} className="rounded" /></th>
                  <th className="px-3 py-3 text-left font-bold text-slate-700">Syarikat</th>
                  <th className="px-3 py-3 text-left font-bold text-slate-700">CIDB</th>
                  <th className="px-3 py-3 text-left font-bold text-slate-700">Gred</th>
                  <th className="px-3 py-3 text-left font-bold text-slate-700">Jenis</th>
                  <th className="px-3 py-3 text-left font-bold text-slate-700">Daerah</th>
                  <th className="px-3 py-3 text-left font-bold text-slate-700">Tarikh</th>
                  <th className="px-3 py-3 text-center font-bold text-slate-700">Tindakan</th>
                </tr></thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className={`border-b border-slate-100 transition ${selected.has(item.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                      <td className="px-3 py-3"><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} className="rounded" /></td>
                      <td className="px-3 py-3 font-semibold text-slate-800">{item.syarikat || item.nama || '-'}</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-600">{item.cidb || '-'}</td>
                      <td className="px-3 py-3">{item.gred || '-'}</td>
                      <td className="px-3 py-3">{item.jenis || '-'}</td>
                      <td className="px-3 py-3">{item.daerah || item.negeri || '-'}</td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {item.createdAt ? new Date(item.createdAt.toMillis()).toLocaleDateString('ms-MY') : item.tarikh || '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => processItem(item)}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition">⚡ Proses</button>
                          <button onClick={() => deleteItem(item.id)}
                            className="text-red-500 hover:text-red-700 text-[10px] font-semibold hover:underline">✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
