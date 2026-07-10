'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import * as XLSX from 'xlsx';
import { getFirestoreDb } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { gasGet } from '@/lib/gas';

interface ExcelItem {
  id: number;
  company: string;
  cidb: string;
  district: string;
  grade: string;
  dateSubmitted: string;
  rawSortDate: Date;
  updateType: string;
  transactionCode: string;
}

interface ListRecord {
  row: number;
  syarikat: string;
  cidb: string;
  gred: string;
  jenis: string;
  start_date: string;
  tarikh_syor: string;
  ubah_maklumat: string;
  ubah_gred: string;
  borang_json: string;
}

type BakulItem = Record<string, unknown> & { cidb?: string; dateSubmitted?: string; updateType?: string; transactionCode?: string };

function normalizeDate(d: string): string {
  if (!d) return '';
  if (d.includes('/')) {
    const p = d.split('/');
    if (p.length === 3) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  }
  return d;
}

const GRADE_REGEX = /^G[4-7]/i;
const NUM_MAP: Record<string, string> = {'0':'K','1':'S','2':'D','3':'T','4':'E','5':'L','6':'E','7':'T','8':'L','9':'S'};

const STATUS_BADGE = {
  processed: '<span style="background:#10b981;color:white;padding:4px 8px;border-radius:12px;font-size:0.75rem;font-weight:bold;">✅ Telah Disyor</span>',
  draft: '<span style="background:#3b82f6;color:white;padding:4px 8px;border-radius:12px;font-size:0.75rem;font-weight:bold;">📝 Belum Hantar</span>',
  basket: '<span style="background:#f59e0b;color:white;padding:4px 8px;border-radius:12px;font-size:0.75rem;font-weight:bold;">🛒 Dalam Bakul</span>',
  new: '<span style="background:#e2e8f0;color:#475569;padding:4px 8px;border-radius:12px;font-size:0.75rem;font-weight:bold;">✨ Baru</span>',
};

export default function TapisanPage() {
  const { user } = useAuth();
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success'|'error'>('success');

  // Excel data
  const [excelData, setExcelData] = useState<ExcelItem[]>([]);
  const [allDistricts, setAllDistricts] = useState<string[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState('Tiada fail dipilih');
  const [loading, setLoading] = useState(false);

  // GAS data for status checking
  const [cachedData, setCachedData] = useState<ListRecord[]>([]);
  const [bakulData, setBakulData] = useState<BakulItem[]>([]);

  // Firebase rules
  const [firebaseRules, setFirebaseRules] = useState<{cidbEndsWith?: string[]; alphaSplit?: Record<string, string>} | null>(null);
  const [firebaseCode, setFirebaseCode] = useState<string | null>(null);

  // Save modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveType, setSaveType] = useState('BARU');
  const [saving, setSaving] = useState(false);

  const numberMap = NUM_MAP;
  const gradeRegex = GRADE_REGEX;

  // Load user's Firebase code & rules from auth
  useEffect(() => {
    if (!user) return;
    const fc = (user as unknown as Record<string, unknown>).firebaseCode as string || null;
    setFirebaseCode(fc);
    if (fc) {
      getDoc(doc(getFirestoreDb(), 'users', fc)).then((snap) => {
        if (snap.exists()) setFirebaseRules(snap.data() as typeof firebaseRules);
      }).catch(() => {});
    }
  }, [user]);

  // Load GAS cached data for status matching
  useEffect(() => {
    if (!user?.name || !user?.email) return;
    gasGet<{ status?: string; data?: ListRecord[] }>({
      action: 'getData', role: user.role, userName: user.name, email: user.email,
    }).then((res) => {
      setCachedData(Array.isArray(res) ? res : (res?.data || []));
    }).catch(() => {});
  }, [user]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setMsg('');
    setLoading(true);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (raw.length < 2) { setMsg('Excel kosong.'); setLoading(false); return; }

      const headers = (raw[0] as string[]).map((h) => h.toLowerCase().trim());

      const keys = {
        company: headers.findIndex((h) => h.includes('syarikat') || h.includes('company') || h.includes('nama')),
        grade: headers.findIndex((h) => h.includes('gred') || h.includes('grade')),
        cidb: headers.findIndex((h) => h.includes('cidb') || h.includes('reg') || h.includes('pendaftar')),
        district: headers.findIndex((h) => h.includes('daerah') || h.includes('district') || h.includes('negeri') || h.includes('disctrict')),
        date: headers.findIndex((h) => h.includes('tarikh') || h.includes('date') || h.includes('submitted')),
        updateType: headers.findIndex((h) => h.includes('update type') || h === 'update type' || h.includes('jenis perubahan')),
        transactionCode: headers.findIndex((h) => h.includes('transaction') || h.includes('trans code') || h.includes('kod transaksi')),
      };

      if (keys.company === -1 || keys.grade === -1 || keys.cidb === -1) {
        setMsg('Format Excel tidak sah. Mesti ada kolum Syarikat, Gred, dan Reg. No/CIDB.');
        setLoading(false);
        return;
      }

      const processed: ExcelItem[] = [];
      const role = user?.role || '';
      const isPengesyor = role === 'PENGESYOR';

      for (let i = 1; i < raw.length; i++) {
        const row = raw[i];
        const g = String(row[keys.grade] || '').trim();
        if (!gradeRegex.test(g)) continue;

        if (isPengesyor) {
          if (!firebaseRules?.cidbEndsWith || firebaseRules.cidbEndsWith.length === 0) continue;
          const cidbStr = String(row[keys.cidb] || '').trim();
          const last = cidbStr.slice(-1);
          if (!firebaseRules.cidbEndsWith.includes(last)) continue;
          if (firebaseRules.alphaSplit?.[last]) {
            const [start, end] = firebaseRules.alphaSplit[last].split('-');
            let first = String(row[keys.company] || '').trim().toUpperCase().charAt(0);
            if (/[0-9]/.test(first)) first = numberMap[first] || first;
            if (first < start || first > end) continue;
          }
        }

        let dateStr = '-';
        let rawSortDate = new Date(1970, 0, 1);
        if (row[keys.date]) {
          if (typeof row[keys.date] === 'number') {
            rawSortDate = new Date(Math.round((row[keys.date] as number - 25569) * 86400 * 1000));
            dateStr = rawSortDate.toLocaleDateString('en-GB');
          } else {
            dateStr = String(row[keys.date]);
            const p = dateStr.split('/');
            if (p.length === 3) rawSortDate = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
          }
        }

        processed.push({
          id: i - 1,
          company: String(row[keys.company] || '-').trim().toUpperCase(),
          cidb: String(row[keys.cidb] || '-').trim(),
          district: keys.district !== -1 ? String(row[keys.district] || '-').trim().toUpperCase() : '-',
          grade: String(row[keys.grade] || '-').trim().toUpperCase(),
          dateSubmitted: dateStr,
          rawSortDate,
          updateType: keys.updateType !== -1 && row[keys.updateType] ? String(row[keys.updateType]).trim() : '-',
          transactionCode: keys.transactionCode !== -1 && row[keys.transactionCode] ? String(row[keys.transactionCode]).trim() : '-',
        });
      }

      setExcelData(processed);
      const dists = [...new Set(processed.map((d) => d.district))].filter((d) => d && d !== '-').sort();
      setAllDistricts(dists);
      setSelectedDistricts(new Set(dists));
    } catch {
      setMsg('Ralat membaca fail Excel. Pastikan ia format .xlsx yang betul.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return excelData.filter((d) => selectedDistricts.has(d.district));
  }, [excelData, selectedDistricts]);

  // Get status for each item
  const itemStatus = useMemo(() => {
    const m = new Map<number, 'processed' | 'draft' | 'basket' | 'new'>();
    for (const item of filtered) {
      const normDate = normalizeDate(item.dateSubmitted);
      let found: 'processed' | 'draft' | 'basket' | 'new' = 'new';

      for (const c of cachedData) {
        if (c.cidb === item.cidb && c.start_date === normDate) {
          let match = true;
          if (c.jenis === 'UBAH MAKLUMAT' || c.jenis === 'UBAH GRED') {
            const info = (c.ubah_maklumat || c.ubah_gred || '').toLowerCase();
            const ut = item.updateType.toLowerCase();
            if (ut !== '-' && !info.includes(ut)) match = false;
            let trans = '-';
            if (c.borang_json) {
              try { trans = (JSON.parse(c.borang_json).borang_transaction_code || '-').toLowerCase(); } catch {}
            }
            const it = item.transactionCode.toLowerCase();
            if (it !== '-' && trans !== '-' && it !== trans) match = false;
          }
          if (match) {
            found = c.tarikh_syor?.trim() ? 'processed' : 'draft';
            break;
          }
        }
      }

      if (found === 'new') {
        for (const b of bakulData) {
          if (b.cidb === item.cidb && normalizeDate(b.dateSubmitted as string) === normDate &&
              (b.updateType || '-') === item.updateType && (b.transactionCode || '-') === item.transactionCode) {
            found = 'basket';
            break;
          }
        }
      }

      m.set(item.id, found);
    }
    return m;
  }, [filtered, cachedData, bakulData]);

  const toggleDistrict = (d: string) => {
    setSelectedDistricts((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDistricts.size === allDistricts.length) {
      setSelectedDistricts(new Set());
    } else {
      setSelectedDistricts(new Set(allDistricts));
    }
  };

  // Checked rows for save
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const toggleCheck = (id: number) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleCheckAll = () => {
    const enabled = filtered.filter((item) => itemStatus.get(item.id) === 'new');
    if (enabled.every((item) => checkedIds.has(item.id))) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(enabled.map((item) => item.id)));
    }
  };

  const saveToBasket = async () => {
    if (!user?.email || !firebaseCode) {
      setMsg('Akaun anda tiada kod tapisan dikesan. Anda tidak boleh menyimpan ke bakul.');
      setMsgType('error');
      return;
    }
    const checked = filtered.filter((item) => checkedIds.has(item.id));
    if (checked.length === 0) {
      setMsg('Sila tick kotak permohonan yang ingin disimpan terlebih dahulu.');
      setMsgType('error');
      return;
    }
    setSaving(true);
    try {
      const dbFire = getFirestoreDb();
      const batch = checked.map((item) => {
        let typeToSave = saveType;
        if (item.updateType && item.updateType !== '-') {
          typeToSave = `${saveType} (${item.updateType})`;
        }
        return addDoc(collection(dbFire, 'applications'), {
          company: item.company,
          cidb: item.cidb,
          grade: item.grade,
          district: item.district,
          type: typeToSave,
          dateSubmitted: item.dateSubmitted,
          sortableDate: item.rawSortDate,
          status: 'Pending',
          processedBy: firebaseCode,
          processorName: user.name,
          createdAt: serverTimestamp(),
          addedToBasketAt: serverTimestamp(),
          updateType: item.updateType || '-',
          transactionCode: item.transactionCode || '-',
        });
      });
      await Promise.all(batch);
      setCheckedIds(new Set());
      setShowSaveModal(false);
      setMsg(`${batch.length} permohonan telah berjaya dimasukkan ke Bakul!`);
      setMsgType('success');
      // Refresh bakul
      loadBakul();
    } catch {
      setMsg('Ralat sistem. Gagal menyimpan ke bakul Firebase.');
      setMsgType('error');
    } finally {
      setSaving(false);
    }
  };

  const loadBakul = async () => {
    if (!firebaseCode) return;
    try {
      const dbFire = getFirestoreDb();
      const { getDocs, query, where } = await import('firebase/firestore');
      const q = query(collection(dbFire, 'applications'), where('processedBy', '==', firebaseCode), where('status', '==', 'Pending'));
      const snap = await getDocs(q);
      const items: BakulItem[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      setBakulData(items);
    } catch {}
  };

  useEffect(() => {
    if (!firebaseCode) return;
    (async () => {
      try {
        const dbFire = getFirestoreDb();
        const { getDocs, query, where } = await import('firebase/firestore');
        const q = query(collection(dbFire, 'applications'), where('processedBy', '==', firebaseCode), where('status', '==', 'Pending'));
        const snap = await getDocs(q);
        const items: BakulItem[] = [];
        snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
        setBakulData(items);
      } catch {}
    })();
  }, [firebaseCode]);

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
          <h1 className="text-white font-bold text-lg">📄 Tapisan Excel</h1>
          <p className="text-white/50 text-xs">Muat naik fail Excel untuk tapisan daerah</p>
        </div>

        {/* Upload Section — match original */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div style={{
            border: '2px dashed #3b82f6', borderRadius: 12, padding: 40,
            textAlign: 'center', background: '#f8fafc'
          }}>
            <div style={{ fontSize: 48, color: '#10b981', marginBottom: 15 }}>📊</div>
            <label htmlFor="excelFileInput" style={{
              background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white',
              padding: '12px 25px', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold',
              fontSize: '1.1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              display: 'inline-block', transition: 'transform 0.2s'
            }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
              Pilih Fail Excel
            </label>
            <input type="file" id="excelFileInput" accept=".xlsx,.xls"
              onChange={handleFile} style={{ display: 'none' }} />
            <p style={{ marginTop: 20, fontWeight: 'bold', color: '#3b82f6' }}>{fileName}</p>
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">Memproses data Excel...</p>
          </div>
        )}

        {/* District Filter */}
        {allDistricts.length > 0 && !loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 style={{ marginTop: 0, color: '#1e40af' }}>Tapis Daerah:</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 15 }}>
              <button onClick={toggleSelectAll}
                style={{
                  padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', fontSize: '0.95rem',
                  border: 'none', cursor: 'pointer', transition: 'all 0.2s ease',
                  background: '#22c55e', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                {selectedDistricts.size === allDistricts.length ? '✓ Kosongkan' : '✓ Pilih Semua'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {allDistricts.map((d) => {
                const active = selectedDistricts.has(d);
                return (
                  <button key={d} onClick={() => toggleDistrict(d)}
                    style={{
                      padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', fontSize: '0.95rem',
                      border: 'none', cursor: 'pointer', transition: 'all 0.2s ease',
                      background: active ? '#2563eb' : '#e2e8f0',
                      color: active ? 'white' : '#475569',
                      boxShadow: active ? '0 4px 6px rgba(0,0,0,0.1)' : 'none',
                    }}
                    onMouseOver={(e) => { if (!active) e.currentTarget.style.background = '#cbd5e1'; }}
                    onMouseOut={(e) => { if (!active) e.currentTarget.style.background = '#e2e8f0'; }}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {msg && (
          <div className={`bg-white rounded-2xl p-4 text-center font-bold ${
            msgType === 'success' ? 'text-emerald-600' : 'text-red-600'
          }`}>{msg}</div>
        )}

        {/* Results Table */}
        {filtered.length > 0 && !loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15
            }}>
              <p style={{ margin: 0, fontSize: '1.1rem' }}>
                <strong style={{ color: '#2563eb', fontSize: '1.2rem' }}>{filtered.length}</strong> rekod dipaparkan untuk anda.
              </p>
              <button onClick={() => {
                const c = filtered.filter((item) => checkedIds.has(item.id));
                if (c.length === 0) {
                  setMsg('Sila tick kotak permohonan yang ingin disimpan terlebih dahulu.');
                  setMsgType('error');
                  return;
                }
                setShowSaveModal(true);
              }}
                style={{
                  fontSize: '1rem', padding: '10px 20px', background: '#2563eb',
                  color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                🛒 Simpan Ke Bakul
              </button>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 10 }}>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '2px solid #cbd5e1' }}>
                      <input type="checkbox" onChange={toggleCheckAll}
                        checked={filtered.filter((item) => itemStatus.get(item.id) === 'new').length > 0 &&
                          filtered.filter((item) => itemStatus.get(item.id) === 'new').every((item) => checkedIds.has(item.id))}
                        style={{ transform: 'scale(1.2)' }} />
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>Syarikat</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>CIDB</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>Daerah</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>Gred</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>Tarikh Excel</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>Update Type</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '2px solid #cbd5e1' }}>Status Semasa</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const status = itemStatus.get(item.id) || 'new';
                    const disabled = status !== 'new';
                    const rowColor = (() => {
                      const t = item.updateType.toLowerCase();
                      if (t.includes('baru')) return '#f0fdf4';
                      if (t.includes('pembaharuan') || t.includes('renewal')) return '#fefce8';
                      if (t.includes('maklumat') || t.includes('info')) return '#eff6ff';
                      if (t.includes('gred') || t.includes('grade')) return '#fdf4ff';
                      return '';
                    })();

                    return (
                      <tr key={item.id} style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: disabled ? undefined : rowColor,
                        opacity: disabled ? 0.6 : 1
                      }}>
                        <td style={{ textAlign: 'center', padding: '6px 12px' }}>
                          {disabled ? (
                            <input type="checkbox" disabled style={{ transform: 'scale(1.2)', opacity: 0.3 }}
                              title="Telah ada dalam sistem/bakul" />
                          ) : (
                            <input type="checkbox" checked={checkedIds.has(item.id)}
                              onChange={() => toggleCheck(item.id)} style={{ transform: 'scale(1.2)' }} />
                          )}
                        </td>
                        <td style={{ fontWeight: 'bold', color: '#1e293b', padding: '6px 12px' }}>{item.company}</td>
                        <td style={{ color: '#475569', padding: '6px 12px' }}>{item.cidb}</td>
                        <td style={{ padding: '6px 12px' }}>{item.district}</td>
                        <td style={{ fontWeight: 'bold', color: '#f59e0b', padding: '6px 12px' }}>{item.grade}</td>
                        <td style={{ padding: '6px 12px' }}>
                          <span style={{ fontWeight: 600, color: '#475569' }}>{item.dateSubmitted}</span>
                        </td>
                        <td style={{ padding: '6px 12px' }}>
                          <span style={{
                            background: 'rgba(255,255,255,0.7)', color: '#333',
                            padding: '2px 8px', borderRadius: 12, fontSize: '0.8rem',
                            fontWeight: 'bold', border: '1px solid #cbd5e1'
                          }}>{item.updateType}</span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 12px' }}
                          dangerouslySetInnerHTML={{ __html: STATUS_BADGE[status] }} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Save Modal — match original */}
        {showSaveModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 10002, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', padding: 16
          }}>
            <div style={{
              background: 'white', borderRadius: 20, maxWidth: 400, width: '90%',
              padding: 25, textAlign: 'center', borderTop: '5px solid #2563eb',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
            }}>
              <h3 style={{ color: '#1e40af', marginTop: 0, marginBottom: 15, fontSize: '1.3rem' }}>
                🛒 Simpan ke Bakul
              </h3>
              <p style={{ color: '#64748b', marginBottom: 15 }}>
                <span style={{ fontWeight: 'bold', color: '#ef4444', fontSize: '1.1rem' }}>
                  {checkedIds.size}
                </span> permohonan dipilih.
              </p>
              <div style={{ textAlign: 'left', marginBottom: 25 }}>
                <label style={{ fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: 8 }}>
                  Pilih Jenis Permohonan:
                </label>
                <select value={saveType} onChange={(e) => setSaveType(e.target.value)}
                  style={{
                    width: '100%', padding: 12, border: '2px solid #cbd5e1', borderRadius: 8,
                    fontSize: '1rem', fontWeight: 'bold', color: '#1e40af', cursor: 'pointer'
                  }}>
                  <option value="BARU">BARU</option>
                  <option value="PEMBAHARUAN">PEMBAHARUAN</option>
                  <option value="UBAH MAKLUMAT">UBAH MAKLUMAT</option>
                  <option value="UBAH GRED">UBAH GRED</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => setShowSaveModal(false)}
                  style={{
                    flex: 1, padding: 12, fontSize: '1rem', borderRadius: 10,
                    background: 'white', color: '#334155', border: '1px solid #cbd5e1',
                    cursor: 'pointer', fontWeight: 'bold'
                  }}>
                  Batal
                </button>
                <button onClick={saveToBasket} disabled={saving}
                  style={{
                    flex: 1, padding: 12, fontSize: '1rem', borderRadius: 10,
                    background: saving ? '#94a3b8' : '#2563eb', color: 'white',
                    border: 'none', cursor: saving ? 'default' : 'pointer', fontWeight: 'bold'
                  }}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
