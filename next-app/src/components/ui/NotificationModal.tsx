'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useSound } from '@/hooks/useSound';
import { gasPost } from '@/lib/gas';

interface NotifItem {
  id: string;
  message: string;
  type: string;
  read: boolean;
  timestamp: string;
}

export default function NotificationModal() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { play } = useSound();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (!open || !user?.email) return;
    let cancelled = false;
    gasPost<{ inbox: NotifItem[] }>({
      action: 'getNotifications',
      email: user.email,
      role: user.role,
    }).then(res => {
      if (!cancelled && res?.inbox) setItems(res.inbox);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, user?.email, user?.role]);

  const markRead = async (id: string) => {
    await gasPost({ action: 'markNotificationRead', id, email: user?.email }).catch(() => {});
    setItems(prev => prev.map(i => i.id === id ? { ...i, read: true } : i));
    play('click');
  };

  const markAllRead = async () => {
    await gasPost({ action: 'markAllNotificationsRead', email: user?.email }).catch(() => {});
    setItems(prev => prev.map(i => ({ ...i, read: true })));
    showToast('Semua notifikasi ditandakan telah dibaca', 'success');
    play('click');
  };

  const deleteNotif = async (id: string) => {
    await gasPost({ action: 'deleteNotification', id, email: user?.email }).catch(() => {});
    setItems(prev => prev.filter(i => i.id !== id));
    play('click');
  };

  const unreadCount = items.filter(i => !i.read).length;
  const filtered = filter === 'unread' ? items.filter(i => !i.read) : items;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pelulus': return '⚖️';
      case 'system': return '⚙️';
      case 'success': return '✅';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      default: return '📩';
    }
  };

  const getTypeBg = (type: string) => {
    switch (type) {
      case 'pelulus': return 'bg-purple-50 border-purple-200';
      case 'system': return 'bg-slate-50 border-slate-200';
      case 'success': return 'bg-emerald-50 border-emerald-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'info': return 'bg-blue-50 border-blue-200';
      default: return 'bg-white border-slate-200';
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); play('click'); }}
        className="relative text-lg p-1.5 rounded-lg transition"
        title="Notifikasi"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center pt-16 bg-black/50 backdrop-blur-sm animate-fadeIn"
          onClick={(e) => { if (e.target === e.currentTarget) { setOpen(false); play('click'); } }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg mx-4 max-h-[75vh] flex flex-col animate-slideDown"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-800">🔔 Notifikasi</h3>
                <p className="text-xs text-slate-500">
                  {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua telah dibaca'}
                </p>
              </div>
              <button
                onClick={() => { setOpen(false); play('click'); }}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none p-1"
              >
                ✕
              </button>
            </div>

            {/* Filter + Actions */}
            <div className="flex items-center justify-between px-5 py-2 border-b border-slate-100">
              <div className="flex gap-1">
                <button
                  onClick={() => { setFilter('all'); play('click'); }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${filter === 'all' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  Semua ({items.length})
                </button>
                <button
                  onClick={() => { setFilter('unread'); play('click'); }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${filter === 'unread' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  Belum Dibaca ({unreadCount})
                </button>
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition">
                  ✓ Tandakan Semua Dibaca
                </button>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {filtered.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-3xl mb-2">📭</p>
                  <p className="text-sm text-slate-400">Tiada notifikasi</p>
                </div>
              ) : (
                filtered.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition ${getTypeBg(item.type)} ${item.read ? 'opacity-60' : ''}`}
                  >
                    <span className="text-lg mt-0.5 shrink-0">{getTypeIcon(item.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.read ? 'text-slate-500' : 'text-slate-800 font-medium'}`}>
                        {item.message}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {item.timestamp ? new Date(item.timestamp).toLocaleString('ms-MY') : ''}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {!item.read && (
                        <button onClick={() => markRead(item.id)}
                          className="text-xs text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition"
                          title="Tandakan dibaca">
                          ✓
                        </button>
                      )}
                      <button onClick={() => deleteNotif(item.id)}
                        className="text-xs text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"
                        title="Padam">
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center">
              <button onClick={() => setOpen(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition">
                Tutup
              </button>
            </div>
          </div>
          <style jsx global>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            .animate-fadeIn { animation: fadeIn 0.15s ease-out; }
            .animate-slideDown { animation: slideDown 0.2s ease-out; }
          `}</style>
        </div>
      )}
    </>
  );
}
