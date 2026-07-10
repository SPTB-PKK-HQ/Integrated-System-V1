'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { gasGet, gasPost } from '@/lib/gas';
import FileManagerModal from '@/components/ui/FileManagerModal';

interface ListRecord {
  row: number;
  syarikat: string;
  cidb: string;
  gred: string;
  jenis: string;
  negeri: string;
  tarikh_surat_terdahulu: string;
  tatatertib: string;
  start_date: string;
  syor_lawatan: string;
  date_submit: string;
  pautan: string;
  justifikasi: string;
  pengesyor: string;
  syor_status: string;
  tarikh_syor: string;
  status_hantar_spi: string;
  tarikh_hantar_spi: string;
  lawatan_tarikh: string;
  lawatan_submit_sptb: string;
  lawatan_syor: string;
  alamat_perniagaan: string;
  jenis_konsultansi: string;
  due_date: string;
  alasan: string;
  kelulusan: string;
  tarikh_lulus: string;
  pelulus: string;
  ubah_maklumat: string;
  ubah_gred: string;
  borang_json: string;
  whatsapp_schedule: string;
  inbox: string;
}

type TabMode = 'drafts' | 'submitted';

const JENIS_BADGE: Record<string, string> = {
  'BARU': 'bg-blue-600',
  'PEMBAHARUAN': 'bg-emerald-600',
  'UBAH MAKLUMAT': 'bg-amber-600',
  'UBAH GRED': 'bg-pink-600',
};

const STATUS_BADGE: Record<string, string> = {
  'LULUS': 'bg-emerald-500',
  'LULUS BERSYARAT': 'bg-teal-500',
  'PEMUTIHAN': 'bg-red-500',
  'DITERIMA': 'bg-blue-500',
  'DITOLAK': 'bg-red-500',
  'TOLAK': 'bg-red-500',
  'TOLAK & BEKU 3 BULAN': 'bg-red-700',
  'TOLAK & BEKU 6 BULAN': 'bg-red-800',
  'DISEMAK': 'bg-amber-500',
  'PENDING': 'bg-yellow-500',
  'SIASAT': 'bg-purple-500',
};

function getJenisBadge(jenis: string): string {
  return JENIS_BADGE[jenis] || 'bg-slate-600';
}

function getStatusBadge(status: string): string {
  return STATUS_BADGE[status] || 'bg-slate-500';
}

function formatDate(d: string): string {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

function FilterButton({
  label, active, count, color, onClick,
}: {
  label: string; active: boolean; count: number; color: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
        active
          ? `${color} text-white border-transparent`
          : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
      }`}>
      {label} <span className={`ml-1 ${active ? 'text-white/70' : 'text-slate-400'}`}>({count})</span>
    </button>
  );
}

export default function ListPage() {
  const { user } = useAuth();
  const cancelledRef = useRef(false);

  const [mode, setMode] = useState<TabMode>('drafts');
  const [records, setRecords] = useState<ListRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState('');

  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [fileManagerRecord, setFileManagerRecord] = useState<ListRecord | null>(null);

  const role = user?.role || '';
  const userName = user?.name || '';
  const userEmail = user?.email || '';

  const fetchData = useCallback(() => {
    if (!userName) return;
    cancelledRef.current = false;
    setLoading(true);
    setStatusText('Menyambung ke pelayan...');
    gasGet<{ status?: string; data?: ListRecord[] }>({
      action: 'getData',
      role,
      userName,
      email: userEmail,
    }).then((result) => {
      if (cancelledRef.current) return;
      setRecords(Array.isArray(result) ? result : (result?.data || []));
      const len = Array.isArray(result) ? result.length : (result?.data?.length || 0);
      setStatusText(`Kemaskini: ${len} rekod`);
    }).catch(() => {
      if (cancelledRef.current) return;
      setRecords([]);
      setStatusText('Gagal memuat data.');
    }).finally(() => {
      if (!cancelledRef.current) setLoading(false);
    });
  }, [role, userName, userEmail]);

  useEffect(() => {
    fetchData();
    return () => { cancelledRef.current = true; };
  }, [fetchData]);

  const refresh = useCallback(() => fetchData(), [fetchData]);

  const drafts = useMemo(() => {
    if (role === 'PENGESYOR') {
      return records.filter((r) => !r.tarikh_syor && r.pengesyor?.toUpperCase() === userName.toUpperCase());
    }
    return records.filter((r) => !r.tarikh_syor);
  }, [records, role, userName]);

  const submitted = useMemo(() => {
    if (role === 'PENGESYOR') {
      return records.filter((r) => r.tarikh_syor && r.pengesyor?.toUpperCase() === userName.toUpperCase());
    }
    return records.filter((r) => r.tarikh_syor);
  }, [records, role, userName]);

  const currentList = mode === 'drafts' ? drafts : submitted;

  const uniqueYears = useMemo(() => {
    const ys = new Set<string>();
    currentList.forEach((r) => {
      const d = mode === 'drafts' ? r.date_submit : r.tarikh_syor;
      if (d) ys.add(d.slice(0, 4));
    });
    return Array.from(ys).sort().reverse();
  }, [currentList, mode]);

  const uniqueMonths = [
    { value: '01', label: 'Jan' }, { value: '02', label: 'Feb' },
    { value: '03', label: 'Mac' }, { value: '04', label: 'Apr' },
    { value: '05', label: 'Mei' }, { value: '06', label: 'Jun' },
    { value: '07', label: 'Jul' }, { value: '08', label: 'Ogo' },
    { value: '09', label: 'Sep' }, { value: '10', label: 'Okt' },
    { value: '11', label: 'Nov' }, { value: '12', label: 'Dis' },
  ];

  const filtered = useMemo(() => {
    return currentList.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (!r.syarikat.toLowerCase().includes(q) && !r.cidb.includes(q)) return false;
      }
      const d = mode === 'drafts' ? r.date_submit : r.tarikh_syor;
      if (month && d && d.slice(5, 7) !== month) return false;
      if (year && d && d.slice(0, 4) !== year) return false;
      if (mode === 'drafts') {
        if (filterJenis === 'SPI' && !r.status_hantar_spi) return false;
        if (filterJenis && filterJenis !== 'SPI' && r.jenis !== filterJenis) return false;
      } else {
        if (filterJenis && r.jenis !== filterJenis) return false;
        if (filterStatus) {
          const kl = r.kelulusan || '';
          if (filterStatus === 'LULUS' && !kl.includes('LULUS')) return false;
          if (filterStatus === 'TOLAK' && !kl.includes('TOLAK') && !kl.includes('SIASAT')) return false;
          if (filterStatus === 'PENDING' && kl === '') return false;
        }
      }
      return true;
    });
  }, [currentList, search, month, year, filterJenis, filterStatus, mode]);

  const badgeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (mode === 'drafts') {
      for (const jenis of ['', 'BARU', 'PEMBAHARUAN', 'UBAH MAKLUMAT', 'UBAH GRED', 'SPI']) {
        counts[jenis || '__ALL'] = jenis === 'SPI'
          ? currentList.filter((r) => r.status_hantar_spi).length
          : jenis
            ? currentList.filter((r) => r.jenis === jenis).length
            : currentList.length;
      }
    } else {
      for (const status of ['', 'LULUS', 'TOLAK', 'PENDING']) {
        counts['STATUS_' + (status || '__ALL')] = status === ''
          ? currentList.length
          : status === 'LULUS'
            ? currentList.filter((r) => (r.kelulusan || '').includes('LULUS')).length
            : status === 'TOLAK'
              ? currentList.filter((r) => (r.kelulusan || '').includes('TOLAK') || (r.kelulusan || '').includes('SIASAT')).length
              : currentList.filter((r) => !r.kelulusan).length;
      }
      for (const jenis of ['', 'BARU', 'PEMBAHARUAN', 'UBAH MAKLUMAT', 'UBAH GRED']) {
        counts['JENIS_' + (jenis || '__ALL')] = jenis
          ? currentList.filter((r) => r.jenis === jenis).length : currentList.length;
      }
    }
    return counts;
  }, [currentList, mode]);

  const switchMode = (newMode: TabMode) => {
    setMode(newMode);
    setFilterJenis('');
    setFilterStatus('');
    setSearch('');
    setMonth('');
    setYear('');
  };

  const editRecord = (row: number) => { window.location.href = `/database?id=${row}`; };

  const lihatBorang = (row: number) => { window.location.href = `/checker?id=${row}`; };


  const padamRecord = async (row: number) => {
    if (!confirm('⚠️ AMARAN! Rekod ini akan dipadam. Teruskan?')) return;
    try {
      await gasPost({ action: 'deleteRecord', row: String(row), deleteType: 'padam_semua', user: userName, email: userEmail });
      setRecords((prev) => prev.filter((r) => r.row !== row));
    } catch { alert('Gagal padam rekod.'); }
  };

  const cetakBorang = (r: ListRecord) => {
    if (!r.borang_json) return;
    alert('Cetak borang akan dilaksanakan tidak lama lagi.');
  };

  const undoSubmit = async (row: number) => {
    if (!confirm('Undo syor? Rekod akan kembali ke Belum Hantar.')) return;
    try {
      await gasPost({ action: 'updateRecord', row: String(row), syor_status: '', tarikh_syor: '', email: userEmail });
      refresh();
    } catch { alert('Gagal undo rekod.'); }
  };

  const viewKelulusan = (r: ListRecord) => {
    window.location.href = `/pelulus-view?id=${r.row}`;
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white font-bold text-lg">📋 Senarai Permohonan</h1>
              <p className="text-white/50 text-xs">{statusText}</p>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-1 inline-flex">
          <button onClick={() => switchMode('drafts')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition ${
              mode === 'drafts' ? 'bg-white text-blue-700 shadow' : 'text-white/70 hover:text-white'
            }`}>
            📋 Belum Hantar ({drafts.length})
          </button>
          <button onClick={() => switchMode('submitted')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition ${
              mode === 'submitted' ? 'bg-white text-blue-700 shadow' : 'text-white/70 hover:text-white'
            }`}>
            ✅ Telah Disyor ({submitted.length})
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4">
          {mode === 'drafts' && (
            <div className="flex flex-wrap gap-2">
              <FilterButton label="SEMUA" active={filterJenis === ''} count={badgeCounts['__ALL']} color="bg-slate-700" onClick={() => setFilterJenis('')} />
              <FilterButton label="BARU" active={filterJenis === 'BARU'} count={badgeCounts['BARU']} color="bg-blue-600" onClick={() => setFilterJenis('BARU')} />
              <FilterButton label="PEMBAHARUAN" active={filterJenis === 'PEMBAHARUAN'} count={badgeCounts['PEMBAHARUAN']} color="bg-emerald-600" onClick={() => setFilterJenis('PEMBAHARUAN')} />
              <FilterButton label="UBAH MAKLUMAT" active={filterJenis === 'UBAH MAKLUMAT'} count={badgeCounts['UBAH MAKLUMAT']} color="bg-amber-600" onClick={() => setFilterJenis('UBAH MAKLUMAT')} />
              <FilterButton label="UBAH GRED" active={filterJenis === 'UBAH GRED'} count={badgeCounts['UBAH GRED']} color="bg-pink-600" onClick={() => setFilterJenis('UBAH GRED')} />
              <FilterButton label="HANTAR KE SPI" active={filterJenis === 'SPI'} count={badgeCounts['SPI']} color="bg-purple-600" onClick={() => setFilterJenis('SPI')} />
            </div>
          )}

          {mode === 'submitted' && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Status:</p>
                <div className="flex flex-wrap gap-2">
                  <FilterButton label="SEMUA" active={filterStatus === ''} count={badgeCounts['STATUS___ALL']} color="bg-slate-700" onClick={() => setFilterStatus('')} />
                  <FilterButton label="LULUS" active={filterStatus === 'LULUS'} count={badgeCounts['STATUS_LULUS']} color="bg-emerald-600" onClick={() => setFilterStatus('LULUS')} />
                  <FilterButton label="TOLAK" active={filterStatus === 'TOLAK'} count={badgeCounts['STATUS_TOLAK']} color="bg-red-600" onClick={() => setFilterStatus('TOLAK')} />
                  <FilterButton label="PENDING" active={filterStatus === 'PENDING'} count={badgeCounts['STATUS_PENDING']} color="bg-amber-600" onClick={() => setFilterStatus('PENDING')} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Jenis:</p>
                <div className="flex flex-wrap gap-2">
                  <FilterButton label="SEMUA" active={filterJenis === ''} count={badgeCounts['JENIS___ALL']} color="bg-slate-700" onClick={() => setFilterJenis('')} />
                  <FilterButton label="BARU" active={filterJenis === 'BARU'} count={badgeCounts['JENIS_BARU']} color="bg-blue-600" onClick={() => setFilterJenis('BARU')} />
                  <FilterButton label="PEMBAHARUAN" active={filterJenis === 'PEMBAHARUAN'} count={badgeCounts['JENIS_PEMBAHARUAN']} color="bg-emerald-600" onClick={() => setFilterJenis('PEMBAHARUAN')} />
                  <FilterButton label="UBAH MAKLUMAT" active={filterJenis === 'UBAH MAKLUMAT'} count={badgeCounts['JENIS_UBAH MAKLUMAT']} color="bg-amber-600" onClick={() => setFilterJenis('UBAH MAKLUMAT')} />
                  <FilterButton label="UBAH GRED" active={filterJenis === 'UBAH GRED'} count={badgeCounts['JENIS_UBAH GRED']} color="bg-pink-600" onClick={() => setFilterJenis('UBAH GRED')} />
                </div>
              </div>
            </div>
          )}

          {/* Month/Year/Search */}
          <div className="flex flex-wrap gap-3 items-end pt-2 border-t border-slate-200">
            <div className="min-w-[160px] flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Carian</label>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Nama syarikat / CIDB..."
                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Bulan</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)}
                className="px-3 py-2 border-2 border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500">
                <option value="">Semua Bulan</option>
                {uniqueMonths.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tahun</label>
              <select value={year} onChange={(e) => setYear(e.target.value)}
                className="px-3 py-2 border-2 border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500">
                <option value="">Semua Tahun</option>
                {uniqueYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={refresh}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition">
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Status */}
        <p className="text-center text-white/60 text-xs">{statusText} | {filtered.length} dipaparkan</p>

        {/* Cards */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">Memuatkan data...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-4xl mb-2">📭</p>
            <p className="text-slate-500 font-bold">Tiada rekod.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const isDraft = mode === 'drafts';
              const kl = r.kelulusan || '';
              const hasJson = r.borang_json && r.borang_json.trim() !== '';
              const hasPautan = r.pautan && r.pautan.trim() !== '';
              const isPengesyor = role === 'PENGESYOR';
              const hasDueDate = r.due_date && r.due_date !== 'N/A';

              let lihatBtnColor = 'bg-slate-600';
              if (!isDraft && kl) {
                if (kl.includes('LULUS')) lihatBtnColor = 'bg-emerald-600';
                else if (kl.includes('TOLAK') || kl.includes('SIASAT')) lihatBtnColor = 'bg-red-500';
                else lihatBtnColor = 'bg-amber-500';
              } else if (isDraft && hasJson) {
                lihatBtnColor = 'bg-violet-600';
              }

              return (
                <div key={r.row}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:border-blue-300 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 text-base leading-tight mb-1 break-words">
                        {r.syarikat}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mb-2">
                        <span className="font-mono font-semibold text-slate-600">{r.cidb || '-'}</span>
                        <span>|</span>
                        <span className="font-semibold text-slate-600">{r.gred || '-'}</span>
                        <span>|</span>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${getJenisBadge(r.jenis)}`}>
                          {r.jenis || '-'}
                        </span>
                        {kl && !isDraft && (
                          <>
                            <span>|</span>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${getStatusBadge(kl)}`}>
                              {kl}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                        {r.tarikh_syor && <span>📅 Syor: {formatDate(r.tarikh_syor)}</span>}
                        {r.date_submit && <span>📅 Hantar: {formatDate(r.date_submit)}</span>}
                        {hasDueDate && <span className="text-amber-600 font-semibold">⏰ Due: {formatDate(r.due_date)}</span>}
                        {r.tarikh_lulus && <span>✅ Lulus: {formatDate(r.tarikh_lulus)}</span>}
                        {r.pengesyor && <span>✍️ {r.pengesyor}</span>}
                        {r.pelulus && <span>👤 {r.pelulus}</span>}
                      </div>
                      {r.alamat_perniagaan && (
                        <p className="text-[11px] text-slate-400 mt-1 truncate">{r.alamat_perniagaan}</p>
                      )}
                    </div>

                    {/* Action Buttons — match original GAS exactly */}
                    <div className="flex flex-col gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {isDraft ? (
                        <>
                          {hasJson && (
                            <button onClick={() => lihatBorang(r.row)}
                              className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition text-center">
                              Lihat
                            </button>
                          )}
                          {hasPautan && (
                            <button onClick={() => setFileManagerRecord(r)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition text-center">
                              📂 Fail
                            </button>
                          )}
                          <button onClick={() => editRecord(r.row)}
                            className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition text-center">
                            Edit
                          </button>
                          <button onClick={() => padamRecord(r.row)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition text-center">
                            🗑️ Padam
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => viewKelulusan(r)}
                            className={`${lihatBtnColor} hover:brightness-110 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition text-center`}>
                            Lihat
                          </button>
                          {hasPautan && (
                            <button onClick={() => setFileManagerRecord(r)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition text-center">
                              📂 Fail
                            </button>
                          )}
                          {hasJson && (
                            <button onClick={() => cetakBorang(r)}
                              className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition text-center">
                              🖨️ Cetak
                            </button>
                          )}
                          {isPengesyor && (
                            <button onClick={() => undoSubmit(r.row)}
                              className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition text-center">
                              ↩️ Undo
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* File Manager Modal */}
        <FileManagerModal
          isOpen={fileManagerRecord !== null}
          onClose={() => setFileManagerRecord(null)}
          folderUrl={fileManagerRecord?.pautan || ''}
          currentUser={user ? { name: user.name, email: user.email, role: user.role } : undefined}
        />
      </div>
    </div>
  );
}
