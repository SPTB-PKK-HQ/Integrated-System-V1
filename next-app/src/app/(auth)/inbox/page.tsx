'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { gasPost } from '@/lib/gas';
import { type InboxItem } from '@/types';

export default function InboxPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await gasPost<{ status: string; data?: InboxItem[] }>({
          action: 'getInbox', email: user.email,
        });
        if (!cancelled && result.status === 'success') setItems(result.data || []);
      } catch { /* ignore */ } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.email, refresh]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const markRead = async (id: string) => {
    await gasPost({ action: 'markInboxRead', email: user?.email, id });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, read: true } : i));
  };

  const deleteItem = async (id: string) => {
    await gasPost({ action: 'deleteInbox', email: user?.email, id });
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const markSelectedRead = async () => {
    for (const id of selected) await markRead(id);
    setSelected(new Set());
  };

  const deleteSelected = async () => {
    for (const id of selected) await deleteItem(id);
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 flex items-center justify-between">
          <h1 className="text-white font-bold text-lg">📥 Inbox Notifikasi</h1>
          <button onClick={() => setRefresh((r) => r + 1)} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-sm font-semibold transition">🔄 Refresh</button>
        </div>

        {selected.size > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-sm font-semibold text-amber-800">{selected.size} dipilih</span>
            <button onClick={markSelectedRead} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">✓ Tandakan Dibaca</button>
            <button onClick={deleteSelected} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">🗑️ Padam Pilihan</button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-500 font-bold">📭 Tiada notifikasi.</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id}
                className={`bg-white rounded-2xl border p-4 transition ${item.read ? 'border-slate-200 opacity-70' : 'border-blue-300 shadow-md'}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)}
                    className="mt-1 rounded" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${item.read ? 'text-slate-600' : 'font-bold text-slate-800'}`}>{item.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>{item.type}</span>
                      <span>{new Date(item.timestamp).toLocaleString('ms-MY')}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!item.read && <button onClick={() => markRead(item.id)} className="text-blue-600 hover:text-blue-800 text-xs font-semibold px-2 py-1">✓ Baca</button>}
                    <button onClick={() => deleteItem(item.id)} className="text-red-500 hover:text-red-700 text-xs px-2 py-1">✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
