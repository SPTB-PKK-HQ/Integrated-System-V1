'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useClock } from '@/hooks/useClock';
import { useSound } from '@/hooks/useSound';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { time, date } = useClock();
  const { play, getVolume, setVolume } = useSound();
  const [showVol, setShowVol] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const role = user?.role || '';

  const navItems = useMemo(() => {
    const all: { href: string; label: string; matchHref?: string; matchSearch?: string }[] = [];

    if (role === 'PENGESYOR') {
      all.push(
        { href: '/dashboard', label: '📊 Dashboard' },
        { href: '/tapisan', label: '📄 Tapisan Excel' },
        { href: '/bakul', label: '🛒 Bakul Permohonan' },
        { href: '/checker', label: '✓ Borang Semakan' },
        { href: '/database', label: '📂 Input Database' },
        { href: '/list?mode=drafts', label: '📋 Belum Hantar', matchHref: '/list', matchSearch: 'drafts' },
        { href: '/list?mode=submitted', label: '✅ Telah Disyor', matchHref: '/list', matchSearch: 'submitted' },
      );
    } else if (role === 'PELULUS') {
      all.push(
        { href: '/dashboard', label: '📊 Dashboard' },
        { href: '/inbox', label: '📥 1. Inbox' },
        { href: '/pelulus-view', label: '🔍 2. Semakan' },
        { href: '/pelulus-action', label: '⚖️ 3. Keputusan' },
        { href: '/sejarah', label: '📜 4. Sejarah' },
      );
    } else if (role === 'KETUA_SEKSYEN' || role === 'PENGARAH') {
      all.push(
        { href: '/admin', label: '👑 Admin Dashboard' },
        { href: '/inbox', label: '📥 Belum Syor' },
        { href: '/list?mode=submitted', label: '✅ Telah Syor', matchHref: '/list', matchSearch: 'submitted' },
        { href: '/sejarah', label: '📜 Sejarah' },
      );
    } else if (role === 'ADMIN') {
      all.push(
        { href: '/admin', label: '👑 Admin Dashboard' },
      );
    }
    return all;
  }, [role]);

  const isActive = (item: typeof navItems[number]) => {
    const base = item.matchHref || item.href.split('?')[0];
    if (pathname !== base) return false;
    if (item.matchSearch) {
      return searchParams.get('mode') === item.matchSearch;
    }
    return !item.href.includes('?');
  };

  return (
    <nav className="bg-white/10 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link href="/dashboard" className="text-white font-bold text-sm tracking-wide truncate max-w-[120px] shrink-0">
            ⚡ SPTB
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-0.5 overflow-x-auto no-scrollbar">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}
                className={`whitespace-nowrap px-2 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                  isActive(item) ? 'bg-white text-blue-700 shadow' : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}>
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-1.5 shrink-0">
            {role === 'PENGESYOR' && (
              <>
                <Link href="/inbox" className="hidden sm:inline text-white/60 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition">📥 Inbox</Link>
                <Link href="/queue" className="hidden sm:inline text-white/60 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition">📋 SPI</Link>
                <Link href="/profile" className="hidden sm:inline text-white/60 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition">🏢 Profil</Link>
              </>
            )}
            <div className="hidden sm:block text-right leading-tight mr-1">
              <p className="text-white/80 text-[11px] font-bold tabular-nums">{time}</p>
              <p className="text-white/40 text-[8px]">{date}</p>
            </div>
            <div className="relative">
              <button onClick={() => { setShowVol(!showVol); play('click'); }}
                className="text-white/50 hover:text-white text-xs px-1.5 py-1 rounded-lg hover:bg-white/10 transition">
                🔉
              </button>
              {showVol && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 p-3 z-50 w-40">
                  <p className="text-[10px] font-bold text-slate-600 mb-1">SFX Volume</p>
                  <input type="range" min="0" max="1" step="0.1" defaultValue={getVolume()}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full accent-blue-600" />
                </div>
              )}
            </div>
            <span className="hidden sm:inline text-white/40 text-[10px] max-w-[80px] truncate">{user?.name}</span>
            <button onClick={() => { play('click'); logout(); }}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition">
              🚪 Logout
            </button>
            <button onClick={() => setOpen(!open)}
              className="lg:hidden text-white/70 hover:text-white p-1 text-lg">{open ? '✕' : '☰'}</button>
          </div>
        </div>

        {/* Mobile Nav */}
        {open && (
          <div className="lg:hidden pb-3 space-y-0.5 max-h-[70vh] overflow-y-auto">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-semibold transition ${
                  isActive(item) ? 'bg-white text-blue-700' : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}>
                {item.label}
              </Link>
            ))}
            {role === 'PENGESYOR' && (
              <>
                <Link href="/inbox" onClick={() => setOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10">📥 Inbox</Link>
                <Link href="/queue" onClick={() => setOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10">📋 SPI</Link>
                <Link href="/profile" onClick={() => setOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10">🏢 Profil</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
