'use client';

import { useState } from 'react';
import { gasPost } from '@/lib/gas';
import DriveSection from './DriveSection';
import KonsultansiSection from './KonsultansiSection';
import WhatsAppScheduler from './WhatsAppScheduler';

const NEGERI = [
  'JOHOR', 'KEDAH', 'KELANTAN', 'MELAKA', 'NEGERI SEMBILAN', 'PAHANG',
  'PERAK', 'PERLIS', 'PULAU PINANG', 'SABAH', 'SARAWAK', 'SELANGOR',
  'TERENGGANU', 'W.P. KUALA LUMPUR', 'W.P. LABUAN', 'W.P. PUTRAJAYA',
];

interface DatabaseFormData {
  syarikat: string;
  cidb: string;
  gred: string;
  jenis: string;
  negeri: string;
  tarikh_surat: string;
  start_date: string;
  alamat: string;
  tatatertib: string;
  syor_lawatan: string;
  pautan_drive: string;
  justifikasi: string;
  ubah_maklumat: string;
  ubah_gred: string;
  selesai_lawatan: boolean;
  lawatan_tarikh: string;
  lawatan_submit_sptb: string;
  lawatan_syor: string;
  pengesyor: string;
  syor_status: string;
  sah_syor: boolean;
  pelulus_whatsapp: string;
  pelulus_nama: string;
  submit_date: string;
}

interface Props {
  userEmail: string;
  userName: string;
}

export default function DatabaseForm({ userEmail, userName }: Props) {
  const [form, setForm] = useState<DatabaseFormData>({
    syarikat: '', cidb: '', gred: '', jenis: '', negeri: '',
    tarikh_surat: '', start_date: '', alamat: '', tatatertib: '',
    syor_lawatan: '', pautan_drive: '', justifikasi: '',
    ubah_maklumat: '', ubah_gred: '',
    selesai_lawatan: false, lawatan_tarikh: '', lawatan_submit_sptb: '',
    lawatan_syor: '', pengesyor: userName, syor_status: '',
    sah_syor: false, pelulus_whatsapp: '', pelulus_nama: '',
    submit_date: '',
  });
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const update = <K extends keyof DatabaseFormData>(key: K, value: DatabaseFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.syarikat || !form.cidb) {
      setStatusMsg('Sila isi Nama Syarikat dan No. CIDB.');
      return;
    }
    if (form.sah_syor && !form.pelulus_nama) {
      setStatusMsg('Sila pilih Pelulus terlebih dahulu.');
      return;
    }
    if (form.syor_lawatan === 'YA' && !form.pautan_drive) {
      setStatusMsg('Pautan Google Drive wajib diisi kerana Syor Lawatan = YA.');
      return;
    }
    setSaving(true);
    setStatusMsg('Menghantar data...');

    try {
      const result = await gasPost<{ status: string; message?: string }>({
        syarikat: form.syarikat,
        cidb: form.cidb,
        gred: form.gred,
        jenis: form.jenis,
        negeri: form.negeri,
        start_date: form.start_date,
        tarikh_surat: form.tarikh_surat,
        tatatertib: form.tatatertib,
        syor_lawatan: form.syor_lawatan,
        pautan: form.pautan_drive,
        justifikasi: form.justifikasi,
        alamat_perniagaan: form.alamat,
        pengesyor: form.pengesyor,
        syor_status: form.syor_status,
        date_submit: form.submit_date,
        lawatan_tarikh: form.lawatan_tarikh,
        lawatan_submit_sptb: form.lawatan_submit_sptb,
        lawatan_syor: form.lawatan_syor,
        ubah_maklumat: form.ubah_maklumat,
        ubah_gred: form.ubah_gred,
        email: userEmail,
      });

      if (result.status === 'success') {
        setStatusMsg('Rekod berjaya disimpan!');
        setForm((prev) => ({
          ...prev,
          syarikat: '', cidb: '', gred: '', jenis: '',
          negeri: '', pautan_drive: '', alamat: '', ubah_maklumat: '', ubah_gred: '',
        }));
      } else {
        setStatusMsg(result.message || 'Gagal menyimpan data.');
      }
    } catch {
      setStatusMsg('Ralat rangkaian. Sila cuba lagi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drive Section */}
      <DriveSection
        syarikat={form.syarikat}
        userEmail={userEmail}
        onFolderCreated={(url) => update('pautan_drive', url)}
      />

      {/* Main Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">📂 Input Database</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Syarikat</label>
            <input type="text" value={form.syarikat} onChange={(e) => update('syarikat', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">No. CIDB</label>
            <input type="text" value={form.cidb} onChange={(e) => update('cidb', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Gred</label>
            <select value={form.gred} onChange={(e) => update('gred', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500">
              <option value="">Pilih</option>
              {['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Jenis</label>
            <select value={form.jenis} onChange={(e) => {
              update('jenis', e.target.value);
              if (e.target.value === 'UBAH MAKLUMAT') update('ubah_maklumat', ' ');
              if (e.target.value === 'UBAH GRED') update('ubah_gred', ' ');
            }}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500">
              <option value="">Pilih</option>
              {['BARU', 'PEMBAHARUAN', 'UBAH MAKLUMAT', 'UBAH GRED'].map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Negeri Alamat Operasi</label>
            <select value={form.negeri} onChange={(e) => update('negeri', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500">
              <option value="">Pilih Negeri</option>
              {NEGERI.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Conditional: Ubah Maklumat / Ubah Gred */}
        {form.jenis === 'UBAH MAKLUMAT' && (
          <div className="mb-4 p-3 bg-amber-50 border-2 border-amber-300 rounded-xl">
            <label className="block text-sm font-bold text-amber-800 mb-1">Nyatakan Perubahan:</label>
            <input type="text" value={form.ubah_maklumat} onChange={(e) => update('ubah_maklumat', e.target.value)}
              className="w-full px-3 py-2 border-2 border-amber-300 rounded-lg text-sm outline-none focus:border-amber-500" />
          </div>
        )}
        {form.jenis === 'UBAH GRED' && (
          <div className="mb-4 p-3 bg-amber-50 border-2 border-amber-300 rounded-xl">
            <label className="block text-sm font-bold text-amber-800 mb-1">Nyatakan Perubahan Gred:</label>
            <input type="text" value={form.ubah_gred} onChange={(e) => update('ubah_gred', e.target.value)}
              className="w-full px-3 py-2 border-2 border-amber-300 rounded-lg text-sm outline-none focus:border-amber-500" />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Tarikh Surat</label>
            <input type="date" value={form.tarikh_surat} onChange={(e) => update('tarikh_surat', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Start Date</label>
            <input type="date" value={form.start_date} onChange={(e) => update('start_date', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" />
          </div>
        </div>

        {/* Konsultansi */}
        <KonsultansiSection />

        {/* WhatsApp */}
        <WhatsAppScheduler />

        {/* Alamat */}
        <div className="mt-6">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Alamat Perniagaan</label>
          <textarea value={form.alamat} onChange={(e) => update('alamat', e.target.value)}
            rows={3} placeholder="Masukkan Alamat Perniagaan Syarikat..."
            className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500 resize-none" />
          <div className="flex gap-2 mt-2">
            <button type="button" className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
              onClick={() => {
                const iframe = document.getElementById('mapsIframe') as HTMLIFrameElement;
                if (iframe && form.alamat) {
                  iframe.src = `https://www.google.com/maps/embed/v1/place?key=&q=${encodeURIComponent(form.alamat)}`;
                }
              }}>
              🗺️ Refresh Maps
            </button>
          </div>
          <div className="mt-3 w-full h-[300px] rounded-xl overflow-hidden border border-slate-300">
            <iframe id="mapsIframe" width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" />
          </div>
        </div>

        {/* Tatatertib & Syor Lawatan */}
        <div className="flex flex-wrap gap-4 mt-6">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Tatatertib STB</label>
            <select value={form.tatatertib} onChange={(e) => update('tatatertib', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500">
              <option value="">Pilih</option>
              <option value="ADA">ADA</option>
              <option value="TIADA">TIADA</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Syor Lawatan</label>
            <select value={form.syor_lawatan} onChange={(e) => update('syor_lawatan', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500">
              <option value="">Pilih</option>
              <option value="YA">YA</option>
              <option value="TIDAK">TIDAK</option>
              <option value="PEMUTIHAN">PEMUTIHAN</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Date Submit to SPI</label>
            <input type="date" value={form.submit_date} onChange={(e) => update('submit_date', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" />
          </div>
        </div>

        {/* Pautan Drive */}
        <div className="mt-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Pautan Google Drive</label>
          <div className="flex gap-2">
            <input type="text" value={form.pautan_drive} onChange={(e) => update('pautan_drive', e.target.value)}
              placeholder="https://drive.google.com/..."
              className="flex-1 px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" />
          </div>
        </div>

        {/* Selesai Lawatan */}
        <label className="flex items-center gap-2 mt-4 text-sm font-semibold text-slate-700 cursor-pointer">
          <input type="checkbox" checked={form.selesai_lawatan} onChange={(e) => update('selesai_lawatan', e.target.checked)}
            className="rounded" />
          Telah Selesai Lawatan
        </label>

        {form.selesai_lawatan && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">TARIKH LAWATAN</label>
                <input type="date" value={form.lawatan_tarikh} onChange={(e) => update('lawatan_tarikh', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-amber-200 rounded-lg text-sm outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">DATE SUBMIT TO SPTB</label>
                <input type="date" value={form.lawatan_submit_sptb} onChange={(e) => update('lawatan_submit_sptb', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-amber-200 rounded-lg text-sm outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">SYOR SPI</label>
                <select value={form.lawatan_syor} onChange={(e) => update('lawatan_syor', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-amber-200 rounded-lg text-sm outline-none focus:border-amber-500">
                  <option value="">- PILIH -</option>
                  <option value="SOKONG">SOKONG</option>
                  <option value="TIDAK DISOKONG">TIDAK DISOKONG</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Justifikasi */}
        <div className="mt-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Justifikasi Lawatan</label>
          <input type="text" value={form.justifikasi} onChange={(e) => update('justifikasi', e.target.value)}
            className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" />
        </div>

        {/* Pengesyor & Syor */}
        <div className="mt-6 p-4 bg-slate-50 border-t-2 border-dashed border-slate-300 rounded-xl">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Pengesyor</label>
          <input type="text" value={form.pengesyor} readOnly
            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm font-bold text-blue-600 bg-white mb-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Syor</label>
              <select value={form.syor_status} onChange={(e) => update('syor_status', e.target.value)}
                className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">- PILIH -</option>
                <option value="SOKONG">SOKONG</option>
                <option value="TIDAK DISOKONG">TIDAK DISOKONG</option>
              </select>
            </div>
          </div>

          {form.syor_status && (
            <div className="mt-4 space-y-3">
              <label className="flex items-start gap-2 text-sm font-semibold text-blue-800 cursor-pointer">
                <input type="checkbox" checked={form.sah_syor} onChange={(e) => update('sah_syor', e.target.checked)}
                  className="mt-0.5 rounded" />
                Dengan ini saya mengesahkan bahawa permohonan diatas adalah benar dan tepat.
              </label>

              {form.sah_syor && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <label className="block text-sm font-semibold text-blue-800 mb-2">Pilih Pelulus:</label>
                  <div id="pelulus_button_group" className="flex flex-wrap gap-2">
                    {['PELULUS A', 'PELULUS B', 'PELULUS C', 'PELULUS D'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          update('pelulus_nama', p);
                          update('pelulus_whatsapp', p.replace(' ', '_').toLowerCase() + '@example.com');
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition border-2 ${
                          form.pelulus_nama === p
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-100'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  {form.pelulus_nama && (
                    <div className="mt-3 text-xs text-blue-600 font-semibold">
                      ✅ Pelulus dipilih: {form.pelulus_nama}
                      <input type="hidden" name="pelulus_whatsapp" value={form.pelulus_whatsapp} />
                      <input type="hidden" name="pelulus_nama" value={form.pelulus_nama} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={() => window.history.back()}
          className="px-6 py-2.5 border-2 border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition">
          « Kembali ke Borang
        </button>
        <button type="button" onClick={handleSubmit} disabled={saving}
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold rounded-xl shadow-lg transition">
          {saving ? '⏳ Menyimpan...' : 'Simpan & Hantar ke Sheet'}
        </button>
      </div>

      {statusMsg && (
        <p className={`text-center font-bold text-sm ${statusMsg.includes('berjaya') ? 'text-emerald-600' : 'text-red-500'}`}>
          {statusMsg}
        </p>
      )}
    </div>
  );
}
