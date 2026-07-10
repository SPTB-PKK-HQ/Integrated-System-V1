'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePdfExtraction } from '@/hooks/usePdfExtraction';

interface ProfileFormData {
  syarikat: string;
  cidb: string;
  gred: string;
  nama_pemohon: string;
  jawatan: string;
  ic: string;
  telefon: string;
  email: string;
  jenis_pendaftaran: string;
  tarikh_daftar: string;
  alamat_berdaftar: string;
  alamat_surat: string;
  no_tel_syarikat: string;
  no_fax: string;
  email_syarikat: string;
  web: string;
  jenis_perubahan: string;
  ssm_berdaftar: boolean;
  ssm_surat: boolean;
}

const initialForm: ProfileFormData = {
  syarikat: '', cidb: '', gred: '', nama_pemohon: '', jawatan: '',
  ic: '', telefon: '', email: '', jenis_pendaftaran: '', tarikh_daftar: '',
  alamat_berdaftar: '', alamat_surat: '', no_tel_syarikat: '', no_fax: '',
  email_syarikat: '', web: '', jenis_perubahan: '', ssm_berdaftar: false, ssm_surat: false,
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState<ProfileFormData>(initialForm);
  const {
    extractedData,
    processing,
    progress,
    error: aiError,
    extractPdfText,
    processWithAI,
    clearExtraction,
  } = usePdfExtraction(user?.email || '');

  const update = <K extends keyof ProfileFormData>(key: K, value: ProfileFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handlePdf = useCallback(async (file: File) => {
    clearExtraction();
    const text = await extractPdfText(file);
    const data = await processWithAI(text, 'auto');
    if (data) {
      setForm((prev) => ({
        ...prev,
        syarikat: data.companyName || prev.syarikat,
        cidb: data.cidbNumber || prev.cidb,
        gred: data.grade || prev.gred,
        nama_pemohon: data.applicantName || prev.nama_pemohon,
        jawatan: data.jawatan || prev.jawatan,
        ic: data.icNumber || prev.ic,
        telefon: data.phoneNumber || prev.telefon,
        email: data.email || prev.email,
        tarikh_daftar: data.tarikhDaftar || prev.tarikh_daftar,
      }));
    }
  }, [extractPdfText, processWithAI, clearExtraction]);

  const resetForm = () => {
    setForm(initialForm);
    clearExtraction();
  };

  const circumference = 2 * Math.PI * 70;

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
            <div>
              <p className="text-white/60 text-xs">Selamat Datang</p>
              <h1 className="text-white font-bold text-lg">{user?.name}</h1>
              <p className="text-white/50 text-xs">{user?.role} — {user?.email}</p>
            </div>
          </div>

        {/* PDF Upload */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">🚀 Auto-Ekstrak Profil (AI)</h2>

          <div className="flex flex-col items-center">
            <div className="relative w-[150px] h-[150px] mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 150 150">
                <circle cx="75" cy="75" r="70" fill="none" stroke="#e2e8f0" strokeWidth="5" />
                <circle cx="75" cy="75" r="70" fill="none"
                  stroke={aiError ? '#ef4444' : processing ? '#3b82f6' : extractedData ? '#10b981' : '#e2e8f0'}
                  strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - (circumference * progress) / 100}
                  className="transition-all duration-500" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-center">
                {processing ? (
                  <><span className="text-2xl font-bold text-blue-600">{progress}%</span><span className="text-xs text-slate-500">Memproses...</span></>
                ) : extractedData ? (
                  <><span className="text-2xl">✅</span><span className="text-xs text-emerald-600">Siap</span></>
                ) : (
                  <><span className="text-2xl">🏢</span><span className="text-xs text-slate-500">Pilih Profil</span></>
                )}
              </div>
            </div>

            <input type="file" accept=".pdf" hidden id="profilePdfInput"
              onChange={(e) => e.target.files?.[0] && handlePdf(e.target.files[0])} />
            <button type="button" disabled={processing}
              onClick={() => document.getElementById('profilePdfInput')?.click()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold px-6 py-2.5 rounded-xl transition">
              Klik / Seret Dokumen
            </button>
            {aiError && <p className="mt-2 text-red-500 text-sm font-semibold">{aiError}</p>}
          </div>

          {extractedData && (
            <div className="mt-6 bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-5 text-center">
              <p className="text-emerald-700 font-bold">✨ Profil Berjaya Diekstrak!</p>
            </div>
          )}
        </div>

        {/* Profile Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">🏢 Cipta Profile Syarikat</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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

          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Gred Syarikat</label>
            <select value={form.gred} onChange={(e) => update('gred', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500 max-w-xs">
              <option value="">Pilih Gred</option>
              {['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Pemohon */}
          <div className="bg-emerald-50 border-l-4 border-emerald-400 rounded-xl p-4 mb-6">
            <h3 className="font-bold text-emerald-800 text-sm mb-3">👤 Maklumat Pemohon</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Nama Pemohon</label>
                <input type="text" value={form.nama_pemohon} onChange={(e) => update('nama_pemohon', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Jawatan</label>
                <input type="text" value={form.jawatan} onChange={(e) => update('jawatan', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">No. IC / Pasport</label>
                <input type="text" value={form.ic} onChange={(e) => update('ic', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">No. Telefon (HP)</label>
                <input type="text" value={form.telefon} onChange={(e) => update('telefon', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" /></div>
              <div className="md:col-span-2"><label className="block text-xs font-semibold text-slate-600 mb-1">Emel Pemohon</label>
                <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" /></div>
            </div>
          </div>

          {/* Syarikat Info */}
          <div className="bg-blue-50 border-l-4 border-blue-400 rounded-xl p-4 mb-6">
            <h3 className="font-bold text-blue-800 text-sm mb-3">🏢 Maklumat Syarikat</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Jenis Pendaftaran (ROC/ROB)</label>
                <input type="text" value={form.jenis_pendaftaran} onChange={(e) => update('jenis_pendaftaran', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Tarikh Daftar</label>
                <input type="date" value={form.tarikh_daftar} onChange={(e) => update('tarikh_daftar', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" /></div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Alamat Berdaftar</label>
              <textarea value={form.alamat_berdaftar} onChange={(e) => update('alamat_berdaftar', e.target.value)}
                rows={2} className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500 resize-none" />
              <label className="flex items-center gap-2 mt-1 text-xs text-slate-500 cursor-pointer">
                <input type="checkbox" checked={form.ssm_berdaftar} onChange={(e) => update('ssm_berdaftar', e.target.checked)} className="rounded" />
                Sama dengan e-Info SSM (SSM)
              </label>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Alamat Surat-menyurat</label>
              <textarea value={form.alamat_surat} onChange={(e) => update('alamat_surat', e.target.value)}
                rows={2} className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500 resize-none" />
              <label className="flex items-center gap-2 mt-1 text-xs text-slate-500 cursor-pointer">
                <input type="checkbox" checked={form.ssm_surat} onChange={(e) => update('ssm_surat', e.target.checked)} className="rounded" />
                Sama dengan e-Info SSM (SSM)
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">No. Telefon Syarikat</label>
                <input type="text" value={form.no_tel_syarikat} onChange={(e) => update('no_tel_syarikat', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">No. Fax</label>
                <input type="text" value={form.no_fax} onChange={(e) => update('no_fax', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Emel Syarikat</label>
                <input type="email" value={form.email_syarikat} onChange={(e) => update('email_syarikat', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1">Web Address</label>
                <input type="text" value={form.web} onChange={(e) => update('web', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" /></div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Jenis Perubahan</label>
            <input type="text" value={form.jenis_perubahan} onChange={(e) => update('jenis_perubahan', e.target.value)}
              placeholder="Contoh: Penambahan gred, ubah alamat, dll."
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500" />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button type="button" onClick={resetForm}
              className="px-6 py-2.5 border-2 border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 transition">RESET BORANG</button>
            <div className="flex gap-3">
              <button type="button" onClick={() => window.print()}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition">🖨️ Cetak Profile</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
