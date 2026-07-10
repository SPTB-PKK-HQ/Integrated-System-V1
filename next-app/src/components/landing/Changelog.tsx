'use client';

import { useState, useEffect, useCallback } from 'react';
import { gasGet } from '@/lib/gas';
import type { ChangelogEntry } from '@/types';

export default function Changelog() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    gasGet<ChangelogEntry[]>({ action: 'getChangelog' })
      .then((data) => {
        if (Array.isArray(data)) setEntries(data);
      })
      .catch(() => {});
  }, []);

  const prev = useCallback(() => setCurrent((c) => (c > 0 ? c - 1 : entries.length - 1)), [entries.length]);
  const next = useCallback(() => setCurrent((c) => (c < entries.length - 1 ? c + 1 : 0)), [entries.length]);

  if (entries.length === 0) return null;

  const entry = entries[current];

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <span className="text-white font-bold text-sm">Apa Yang Baru?</span>
          <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {entries.length}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={prev}
          className="w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition text-lg flex items-center justify-center"
        >
          ‹
        </button>

        <div className="flex-1 bg-white/5 rounded-xl p-4 min-h-[80px]">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-blue-500/80 text-white text-xs font-bold px-2 py-0.5 rounded">
              {entry.version}
            </span>
            <span className="text-white/50 text-xs">{entry.date}</span>
          </div>
          <p className="text-white/80 text-sm">{entry.description}</p>
        </div>

        <button
          onClick={next}
          className="w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition text-lg flex items-center justify-center"
        >
          ›
        </button>
      </div>

      <div className="flex justify-center gap-1.5 mt-4">
        {entries.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2 h-2 rounded-full transition ${
              i === current ? 'bg-white' : 'bg-white/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
