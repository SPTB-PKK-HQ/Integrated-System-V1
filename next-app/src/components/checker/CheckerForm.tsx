'use client';

import { useState, useCallback, useEffect, useRef, startTransition } from 'react';
import StatusInput from './StatusInput';
import PersonnelList from './PersonnelList';
import type { ExtractedPdfData } from '@/hooks/usePdfExtraction';

interface CheckerFormData {
  jenisApp: string;
  tarikh_mohon: string;
  tatatertib: string;
  justifikasi: string;
  no_telefon: string;
  syarikat: string;
  cidb: string;
  gred: string;
  spkkDuration: string;
  stbDuration: string;
  ssm_date: string;
  ssm_status: string;
  bank_date: string;
  bank_sign: string;
  bank_status: string;
  doc_carta: string;
  doc_peta: string;
  doc_gambar: string;
  doc_sewa: string;
  kwsp_date_1: string;
  kwsp_s1: string;
  kwsp_date_2: string;
  kwsp_s2: string;
  kwsp_date_3: string;
  kwsp_s3: string;
  tarikh_lengkap: string;
  tarikh_siasatan: string;
  tarikh_proses: string;
  syor_status: string;
  ubah_maklumat: string;
  ubah_gred: string;
}

function getToday(): string {
  try { return new Date().toISOString().slice(0, 10); } catch { return ''; }
}

const initialForm: CheckerFormData = {
  jenisApp: '', tarikh_mohon: '', tatatertib: '', justifikasi: '',
  no_telefon: '', syarikat: '', cidb: '', gred: '', spkkDuration: '',
  stbDuration: '', ssm_date: '', ssm_status: '', bank_date: '',
  bank_sign: '', bank_status: '', doc_carta: '', doc_peta: '',
  doc_gambar: '', doc_sewa: '', kwsp_date_1: '', kwsp_s1: '',
  kwsp_date_2: '', kwsp_s2: '', kwsp_date_3: '', kwsp_s3: '',
  tarikh_lengkap: '', tarikh_siasatan: '', tarikh_proses: getToday(),
  syor_status: '', ubah_maklumat: '', ubah_gred: '',
};

interface Props {
  onSyncToDb?: () => void;
  extractedData?: ExtractedPdfData | null;
}

export default function CheckerForm({ onSyncToDb, extractedData }: Props) {
  const [form, setForm] = useState<CheckerFormData>(initialForm);
  const [hasPrinted, setHasPrinted] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const updateField = useCallback(<K extends keyof CheckerFormData>(key: K, value: CheckerFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Apply extracted AI data to form
  useEffect(() => {
    if (!extractedData) return;
    startTransition(() => {
      setForm((prev) => ({
        ...prev,
        syarikat: extractedData.companyName || prev.syarikat,
        cidb: extractedData.cidbNumber || prev.cidb,
        gred: extractedData.grade || prev.gred,
        no_telefon: extractedData.phoneNumbers?.join(', ') || prev.no_telefon,
        spkkDuration: extractedData.spkkStartDate && extractedData.spkkEndDate
          ? `${extractedData.spkkStartDate} - ${extractedData.spkkEndDate}` : prev.spkkDuration,
        stbDuration: extractedData.stbStartDate && extractedData.stbEndDate
          ? `${extractedData.stbStartDate} - ${extractedData.stbEndDate}` : prev.stbDuration,
      }));
    });
  }, [extractedData]);

  // Auto-save every 3s
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      try {
        const data = { ...form };
        localStorage.setItem('stb_form_data', JSON.stringify(data));
      } catch { /* quota exceeded */ }
    }, 3000);
    return () => clearInterval(autoSaveRef.current);
  }, [form]);

  const resetForm = useCallback(() => {
    setForm(initialForm);
    setHasPrinted(false);
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
    setHasPrinted(true);
  }, []);

  const handleSyncToDb = useCallback(() => {
    // Save form + personnel data to localStorage for DB page
    try {
      const data = { ...form };
      localStorage.setItem('stb_form_data', JSON.stringify(data));
      localStorage.setItem('stb_database_persistence', JSON.stringify(data));
    } catch { /* quota exceeded */ }
    onSyncToDb?.();
  }, [form, onSyncToDb]);

  return (
    <div className="space-y-6">
      {/* Application Type & Basic Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">🏢 Maklumat Asas & Jenis Permohonan</h2>

        <label className="block text-sm font-semibold text-slate-700 mb-2">Jenis Permohonan:</label>
        <div className="flex flex-wrap gap-4 mb-4">
          {[
            { value: 'baru', label: 'BARU' },
            { value: 'pembaharuan', label: 'PEMBAHARUAN' },
            { value: 'ubah_maklumat', label: 'UBAH MAKLUMAT' },
            { value: 'ubah_gred', label: 'UBAH GRED' },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 text-sm font-medium text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="jenisApp"
                value={opt.value}
                checked={form.jenisApp === opt.value}
                onChange={(e) => updateField('jenisApp', e.target.value)}
                className="accent-blue-600"
              />
              {opt.label}
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Tarikh Mohon</label>
            <input
              type="date"
              value={form.tarikh_mohon}
              onChange={(e) => updateField('tarikh_mohon', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Semakan Tatatertib</label>
            <select
              value={form.tatatertib}
              onChange={(e) => updateField('tatatertib', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
            >
              <option value="">- PILIH -</option>
              <option value="ADA">ADA</option>
              <option value="TIADA">TIADA</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Justifikasi Lawatan</label>
          <input
            type="text"
            value={form.justifikasi}
            onChange={(e) => updateField('justifikasi', e.target.value)}
            placeholder="Nyatakan justifikasi lawatan jika perlu..."
            className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1">No. Telefon (Pejabat / Individu)</label>
          <input
            type="text"
            value={form.no_telefon}
            onChange={(e) => updateField('no_telefon', e.target.value)}
            placeholder="Contoh: 03-1234567, 012-3456789"
            className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
          />
        </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Syarikat</label>
                <input
                  type="text"
                  value={form.syarikat}
                  onChange={(e) => updateField('syarikat', e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase' }}
                  className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
                />
              </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">No. CIDB</label>
            <input
              type="text"
              value={form.cidb}
              onChange={(e) => updateField('cidb', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Gred Permohonan</label>
            <select
              value={form.gred}
              onChange={(e) => updateField('gred', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
            >
              <option value="">- Pilih Gred -</option>
              {['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Tempoh SPKK</label>
            <input
              type="text"
              value={form.spkkDuration}
              onChange={(e) => updateField('spkkDuration', e.target.value)}
              placeholder="DD/MM/YYYY - DD/MM/YYYY"
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Tempoh STB</label>
            <input
              type="text"
              value={form.stbDuration}
              onChange={(e) => updateField('stbDuration', e.target.value)}
              placeholder="DD/MM/YYYY - DD/MM/YYYY"
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Tarikh e-Info SSM</label>
            <input
              type="date"
              value={form.ssm_date}
              onChange={(e) => updateField('ssm_date', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Status Semakan SSM</label>
            <StatusInput
              value={form.ssm_status}
              onChange={(v) => updateField('ssm_status', v)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Tarikh Bank</label>
            <input
              type="date"
              value={form.bank_date}
              onChange={(e) => updateField('bank_date', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Syarat Bank</label>
            <input
              type="text"
              value={form.bank_sign}
              onChange={(e) => updateField('bank_sign', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Status Semakan Bank</label>
            <StatusInput
              value={form.bank_status}
              onChange={(v) => updateField('bank_status', v)}
            />
          </div>
        </div>

        {/* Conditional: Ubah Maklumat / Ubah Gred */}
        {form.jenisApp === 'ubah_maklumat' && (
          <div className="mt-4 p-3 bg-amber-50 border-2 border-amber-300 rounded-xl">
            <label className="block text-sm font-semibold text-amber-800 mb-1">Nyatakan Perubahan Maklumat:</label>
            <input
              type="text"
              value={form.ubah_maklumat}
              onChange={(e) => updateField('ubah_maklumat', e.target.value)}
              placeholder="Contoh: Tukar alamat, tambah pengarah..."
              className="w-full px-3 py-2 border-2 border-amber-300 rounded-lg text-sm outline-none focus:border-amber-500"
            />
          </div>
        )}
        {form.jenisApp === 'ubah_gred' && (
          <div className="mt-4 p-3 bg-amber-50 border-2 border-amber-300 rounded-xl">
            <label className="block text-sm font-semibold text-amber-800 mb-1">Nyatakan Perubahan Gred:</label>
            <input
              type="text"
              value={form.ubah_gred}
              onChange={(e) => updateField('ubah_gred', e.target.value)}
              placeholder="Contoh: Naik gred G4 ke G5"
              className="w-full px-3 py-2 border-2 border-amber-300 rounded-lg text-sm outline-none focus:border-amber-500"
            />
          </div>
        )}
      </div>

      {/* Personnel Section */}
      <PersonnelList />

      {/* Documents & KWSP */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">📁 Dokumen & KWSP</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {(['doc_carta', 'doc_peta', 'doc_gambar', 'doc_sewa'] as const).map((doc) => (
            <div key={doc}>
              <label className="block text-sm font-semibold text-slate-700 mb-1 capitalize">
                {doc.replace('doc_', '')}
              </label>
              <StatusInput
                value={form[doc]}
                onChange={(v) => updateField(doc, v)}
              />
            </div>
          ))}
        </div>

        <label className="block text-sm font-semibold text-slate-700 mb-3">KWSP (3 Bulan)</label>
        {([1, 2, 3] as const).map((i) => (
          <div key={i} className="flex flex-wrap gap-3 mb-2">
            <input
              type="month"
              value={form[`kwsp_date_${i}` as keyof CheckerFormData] as string}
              onChange={(e) => updateField(`kwsp_date_${i}` as keyof CheckerFormData, e.target.value as never)}
              className="flex-1 min-w-[140px] px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
            />
            <div className="flex-1 min-w-[120px]">
              <StatusInput
                value={form[`kwsp_s${i}` as keyof CheckerFormData] as string}
                onChange={(v) => updateField(`kwsp_s${i}` as keyof CheckerFormData, v as never)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Process Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">📝 Maklumat Proses & Syor</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Tarikh Dokumen Lengkap</label>
            <input
              type="date"
              value={form.tarikh_lengkap}
              onChange={(e) => updateField('tarikh_lengkap', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Tarikh Siasatan</label>
            <input
              type="date"
              value={form.tarikh_siasatan}
              onChange={(e) => updateField('tarikh_siasatan', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Tarikh Proses</label>
            <input
              type="date"
              value={form.tarikh_proses}
              readOnly
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Keputusan Syor</label>
            <select
              value={form.syor_status}
              onChange={(e) => updateField('syor_status', e.target.value)}
              className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">- PILIH -</option>
              <option value="SOKONG">SOKONG</option>
              <option value="SIASAT">SIASAT</option>
              <option value="TIDAK DISOKONG">TIDAK DISOKONG</option>
            </select>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={resetForm}
          className="px-6 py-2.5 border-2 border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 transition"
        >
          RESET BORANG
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition"
          >
            🖨️ Cetak
          </button>
          {hasPrinted && (
            <button
              type="button"
              onClick={handleSyncToDb}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition"
            >
              Simpan & Ke Input Database »
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
