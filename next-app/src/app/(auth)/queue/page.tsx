'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { gasPost } from '@/lib/gas';
import { type QueueData } from '@/types';

export default function QueueSpiPage() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    (async () => {
      try {
        const result = await gasPost<{ status: string } & QueueData>({
          action: 'getQueueData', email: user.email,
        });
        if (result.status === 'success') {
          setQueue({ status: result.status, siasat: result.siasat || [], pemutihan: result.pemutihan || [] });
        }
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, [user?.email]);

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
          <h1 className="text-white font-bold text-lg">📋 Queue SPI</h1>
          <p className="text-white/50 text-xs">Senarai Siasatan Biasa & Pemutihan</p>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>
        ) : !queue ? (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-500 font-bold">Tiada data queue.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Siasatan Biasa */}
            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-6">
              <h2 className="text-lg font-bold text-amber-700 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
                Siasatan Biasa ({Array.isArray(queue.siasat) ? queue.siasat.length : 0})
              </h2>
              {Array.isArray(queue.siasat) && queue.siasat.length > 0 ? (
                <div className="space-y-2">
                  {queue.siasat.map((item: unknown, i: number) => {
                    const row = item as Record<string, unknown>;
                    return (
                      <div key={i} className="bg-amber-50 rounded-lg px-4 py-3 text-sm border border-amber-100">
                        <p className="font-semibold text-slate-700">{row.syarikat as string || row.companyName as string || '-'}</p>
                        <p className="text-xs text-slate-500">CIDB: {row.cidb as string || row.cidbNumber as string || '-'}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">Tiada siasatan biasa.</p>
              )}
            </div>

            {/* Pemutihan */}
            <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6">
              <h2 className="text-lg font-bold text-red-700 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                Pemutihan ({Array.isArray(queue.pemutihan) ? queue.pemutihan.length : 0})
              </h2>
              {Array.isArray(queue.pemutihan) && queue.pemutihan.length > 0 ? (
                <div className="space-y-2">
                  {queue.pemutihan.map((item: unknown, i: number) => {
                    const row = item as Record<string, unknown>;
                    return (
                      <div key={i} className="bg-red-50 rounded-lg px-4 py-3 text-sm border border-red-100">
                        <p className="font-semibold text-slate-700">{row.syarikat as string || row.companyName as string || '-'}</p>
                        <p className="text-xs text-slate-500">CIDB: {row.cidb as string || row.cidbNumber as string || '-'}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">Tiada pemutihan.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
