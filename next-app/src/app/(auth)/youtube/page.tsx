'use client';

import { useState } from 'react';
import Image from 'next/image';
import { gasPost } from '@/lib/gas';

interface YouTubeItem {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    thumbnails: { medium?: { url: string }; high?: { url: string }; default?: { url: string } };
    channelTitle: string;
    publishedAt: string;
  };
}

export default function YouTubePortalPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setMsg('');
    setSelected(null);
    try {
      const res = await gasPost<{ success: boolean; data?: YouTubeItem[]; message?: string }>({
        action: 'searchYoutube',
        query: query.trim(),
      });
      if (res.success && res.data) {
        setResults(res.data);
        if (res.data.length === 0) setMsg('Tiada hasil carian.');
      } else {
        setMsg(res.message || 'Gagal mencari.');
      }
    } catch {
      setMsg('Ralat carian.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
          <h1 className="text-white font-bold text-lg">🎬 YouTube Portal</h1>
          <p className="text-white/50 text-xs">Cari dan tonton video YouTube</p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex gap-2">
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="Cari video..."
              className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500" />
            <button onClick={search} disabled={loading}
              className="bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white px-5 py-2 rounded-lg text-sm font-bold transition">
              {loading ? '⏳' : '🔍 Cari'}
            </button>
          </div>
        </div>

        {msg && <div className="bg-white rounded-2xl p-4 text-center font-bold text-slate-600">{msg}</div>}

        {/* Player */}
        {selected && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="relative pb-[56.25%] bg-black">
              <iframe src={`https://www.youtube.com/embed/${selected}?autoplay=1`}
                allow="autoplay; encrypted-media" allowFullScreen
                className="absolute inset-0 w-full h-full" />
            </div>
            <div className="p-2 text-center">
              <button onClick={() => setSelected(null)} className="text-red-500 text-xs font-bold hover:underline">✕ Tutup</button>
            </div>
          </div>
        )}

        {/* Results Grid */}
        {results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((item) => (
              <div key={item.id.videoId}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition cursor-pointer"
                onClick={() => setSelected(item.id.videoId)}>
                <div className="relative pb-[56.25%] bg-slate-100">
                  <Image unoptimized
                    src={item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || ''}
                    alt={item.snippet.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 bg-red-600/90 rounded-full flex items-center justify-center text-white text-xl">▶️</div>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-slate-800 line-clamp-2">{item.snippet.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{item.snippet.channelTitle}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
