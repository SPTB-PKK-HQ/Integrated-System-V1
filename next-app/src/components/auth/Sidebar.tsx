'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useClock } from '@/hooks/useClock';
import { useSound } from '@/hooks/useSound';
import { useProfileVisibility } from '@/hooks/useProfileVisibility';
import NotificationModal from '@/components/ui/NotificationModal';

type NavItem = {
  href: string;
  icon: string;
  label: string;
  matchHref?: string;
  matchSearch?: string;
};

const ROLE_ITEMS: Record<string, NavItem[]> = {
  PENGESYOR: [
    { href: '/dashboard', icon: '📊', label: 'Dashboard' },
    { href: '/tapisan', icon: '📄', label: 'Tapisan Excel' },
    { href: '/bakul', icon: '🛒', label: 'Bakul Permohonan' },
    { href: '/checker', icon: '✓', label: 'Borang Semakan' },
    { href: '/database', icon: '📂', label: 'Input Database' },
    { href: '/list', icon: '📋', label: 'Senarai Permohonan' },
    { href: '/inbox', icon: '📥', label: 'Inbox' },
    { href: '/queue', icon: '📋', label: 'SPI Queue' },
  ],
  PELULUS: [
    { href: '/dashboard', icon: '📊', label: 'Dashboard' },
    { href: '/inbox', icon: '📥', label: '1. Inbox' },
    { href: '/pelulus-view', icon: '🔍', label: '2. Semakan' },
    { href: '/pelulus-action', icon: '⚖️', label: '3. Keputusan' },
    { href: '/sejarah', icon: '📜', label: '4. Sejarah' },
  ],
  KETUA_SEKSYEN: [
    { href: '/admin', icon: '👑', label: 'Admin Dashboard' },
    { href: '/inbox', icon: '📥', label: 'Belum Syor' },
    { href: '/list', icon: '📋', label: 'Senarai Permohonan' },
    { href: '/sejarah', icon: '📜', label: 'Sejarah' },
  ],
  PENGARAH: [
    { href: '/admin', icon: '👑', label: 'Admin Dashboard' },
    { href: '/inbox', icon: '📥', label: 'Belum Syor' },
    { href: '/list', icon: '📋', label: 'Senarai Permohonan' },
    { href: '/sejarah', icon: '📜', label: 'Sejarah' },
  ],
  ADMIN: [
    { href: '/admin', icon: '👑', label: 'Admin Dashboard' },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { time, date } = useClock();
  const { play, getVolume, setVolume } = useSound();
  const { profileVisible } = useProfileVisibility();
  const [collapsed, setCollapsed] = useState(false);
  const [showVol, setShowVol] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const role = user?.role || '';

  const navItems = useMemo(() => {
    const items = [...(ROLE_ITEMS[role] || [])];
    if (profileVisible && role === 'PENGESYOR') {
      items.push({ href: '/profile', icon: '🏢', label: 'Profil Syarikat' });
    }
    return items;
  }, [role, profileVisible]);

  const isActive = (item: NavItem) => {
    const base = item.matchHref || item.href.split('?')[0];
    if (pathname !== base) return false;
    if (item.matchSearch) return searchParams.get('mode') === item.matchSearch;
    return !item.href.includes('?');
  };

  const renderInner = (closeMobile?: () => void) => (
    <div className={`flex flex-col h-full transition-all duration-300 ${collapsed ? 'w-[64px]' : 'w-[240px]'}`}>
      {/* Logo */}
      <div className="flex items-center justify-between px-3 h-14 border-b border-white/10 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 min-w-0" onClick={() => play('click')}>
          <span className="text-lg shrink-0">⚡</span>
          {!collapsed && (
            <span className="text-white font-bold text-sm tracking-wide truncate">SPTB</span>
          )}
        </Link>
        {closeMobile ? (
          <button onClick={closeMobile} className="lg:hidden text-white/70 hover:text-white p-1">
            ✕
          </button>
        ) : (
          <button
            onClick={() => { setCollapsed(!collapsed); play('click'); }}
            className="text-white/40 hover:text-white text-xs p-1 rounded hover:bg-white/10 transition shrink-0 hidden lg:block"
            title={collapsed ? 'Kembangkan' : 'Kecilkan'}
          >
            {collapsed ? '▶' : '◀'}
          </button>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => { closeMobile?.(); play('click'); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                collapsed ? 'justify-center px-0' : ''
              } ${
                active
                  ? 'bg-white text-blue-700 shadow'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-lg shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-white/10 px-3 py-3 space-y-2 shrink-0">
        {!collapsed && (
          <div className="text-center leading-tight px-1">
            <p className="text-white/80 text-[11px] font-bold tabular-nums">{time}</p>
            <p className="text-white/40 text-[8px]">{date}</p>
          </div>
        )}

        <div className={`flex items-center gap-1 ${collapsed ? 'justify-center flex-col' : 'justify-between'}`}>
          <NotificationModal />

          <div className="relative">
            <button
              onClick={() => { setShowVol(!showVol); play('click'); }}
              className="text-white/50 hover:text-white text-xs p-1.5 rounded-lg hover:bg-white/10 transition"
              title="Volume SFX"
            >
              {getVolume() > 0 ? '🔊' : '🔇'}
            </button>
            {showVol && (
              <div className={`absolute bottom-full mb-2 bg-white rounded-xl shadow-lg border border-slate-200 p-3 z-50 ${collapsed ? 'left-1/2 -translate-x-1/2' : 'right-0'}`}>
                <p className="text-[10px] font-bold text-slate-600 mb-1 whitespace-nowrap">SFX Volume</p>
                <input
                  type="range" min="0" max="1" step="0.1"
                  defaultValue={getVolume()}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
            )}
          </div>

          {!collapsed && (
            <span className="text-white/40 text-[10px] max-w-[80px] truncate">{user?.name}</span>
          )}

          {!collapsed && (
            <button
              onClick={() => { play('click'); logout(); }}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 px-2 py-1 rounded-lg text-[11px] font-semibold transition"
              title="Log Keluar"
            >
              🚪
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={() => { play('click'); logout(); }}
            className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 p-1.5 rounded-lg text-sm transition flex items-center justify-center"
            title="Log Keluar"
          >
            🚪
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => { setMobileOpen(true); play('click'); }}
        className="lg:hidden fixed top-3 left-3 z-50 bg-white/10 backdrop-blur-md border border-white/20 text-white p-2 rounded-lg text-lg"
      >
        ☰
      </button>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full z-40 bg-gradient-to-b from-blue-800/95 to-blue-900/95 backdrop-blur-md border-r border-white/10">
        {renderInner()}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileOpen(false)}>
          <aside
            className="h-full bg-gradient-to-b from-blue-800/95 to-blue-900/95 backdrop-blur-md border-r border-white/10 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {renderInner(() => setMobileOpen(false))}
          </aside>
        </div>
      )}

      {/* Spacer for content */}
      <div className="hidden lg:block shrink-0 transition-all duration-300" style={{ width: collapsed ? 64 : 240 }} />
    </>
  );
}
