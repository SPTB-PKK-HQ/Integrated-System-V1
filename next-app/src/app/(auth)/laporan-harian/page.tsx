'use client';

import { useEffect, useState, useMemo, use } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { gasGet } from '@/lib/gas';
import type { ApplicationRecord } from '@/types';

function resolveRecordDate(item: ApplicationRecord): Date | null {
  if (item.tarikh_syor?.trim()) return new Date(item.tarikh_syor);
  if (item.borang_json?.trim()) {
    try { const p = JSON.parse(item.borang_json); if (p.tarikh_masuk_sheet) return new Date(p.tarikh_masuk_sheet); } catch { /* */ }
  }
  if (item.start_date?.trim()) return new Date(item.start_date);
  if (item.date_submit?.trim()) return new Date(item.date_submit);
  if (item.tarikh_lulus?.trim()) return new Date(item.tarikh_lulus);
  return null;
}

export default function LaporanHarianPage({ searchParams: sp }: { searchParams: Promise<{ year?: string; month?: string; day?: string }> }) {
  const { user } = useAuth();
  const params = use(sp);
  const year = parseInt(params.year || '') || new Date().getFullYear();
  const month = parseInt(params.month || '') || new Date().getMonth() + 1;
  const day = parseInt(params.day || '') || new Date().getDate();

  const [records, setRecords] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    gasGet<{ data: ApplicationRecord[] } | ApplicationRecord[]>({
      action: 'getData', role: user.role, userName: user.name,
    }).then((res) => {
      setRecords(Array.isArray(res) ? res : (res as { data: ApplicationRecord[] }).data || []);
    }).finally(() => setLoading(false));
  }, [user]);

  const report = useMemo(() => {
    const dateObj = new Date(year, month - 1, day);
    const formatted = dateObj.toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    let dailyRecords = records.filter((item) => {
      const d = resolveRecordDate(item);
      return d && !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
    });

    if (user?.role === 'PENGESYOR') {
      dailyRecords = dailyRecords.filter((r) => r.pengesyor?.trim().toUpperCase() === user.name.trim().toUpperCase());
    } else if (user?.role === 'PELULUS') {
      dailyRecords = dailyRecords.filter((r) => r.pelulus?.trim().toUpperCase() === user.name.trim().toUpperCase());
    }

    const jumlahDisemak = dailyRecords.length;
    const jumlahLulus = user?.role === 'PENGESYOR'
      ? dailyRecords.filter((r) => r.syor_status === 'SOKONG').length
      : dailyRecords.filter((r) => r.kelulusan?.toUpperCase().includes('LULUS')).length;
    const jumlahTolak = user?.role === 'PENGESYOR'
      ? dailyRecords.filter((r) => r.syor_status === 'TIDAK DISOKONG' || r.syor_status === 'SIASAT').length
      : dailyRecords.filter((r) => r.kelulusan && (r.kelulusan.toUpperCase().includes('TOLAK') || r.kelulusan.toUpperCase().includes('SIASAT'))).length;
    const jumlahSelesai = jumlahLulus + jumlahTolak;

    let countEmel = 0, countWA = 0, countCall = 0;
    dailyRecords.forEach((r) => {
      const k = (r.jenis_konsultansi || '').toLowerCase();
      if (k.includes('emel')) countEmel++;
      if (k.includes('whatsapp')) countWA++;
      if (k.includes('call') || k.includes('panggilan')) countCall++;
    });
    const konsultansiStr = `${countEmel} Emel - ${countWA} WhatsApp - ${countCall} Call`;

    return { formatted, jumlahDisemak, jumlahSelesai, jumlahLulus, jumlahTolak, konsultansiStr, countEmel, countWA, countCall };
  }, [records, year, month, day, user]);

  useEffect(() => {
    if (!loading) setTimeout(() => window.print(), 500);
  }, [loading]);

  const today = new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) return <div className="p-12 text-center"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></div>;

  return (
    <div id="printLaporanHarian" className="max-w-[800px] mx-auto p-5 font-sans">
      <div className="h-[6px] bg-blue-600" />
      <div className="text-center py-4 border-b-[3px] border-blue-600 mb-5">
        <h1 className="text-[22pt] font-bold uppercase m-0">Borang Pelaporan Harian</h1>
        <h2 className="text-[16pt] font-normal m-0">Pemprosesan Permohonan STB (Kerja)</h2>
        <p className="text-[13pt] font-bold mt-1">{report.formatted}</p>
      </div>

      {/* Ringkasan Aktiviti */}
      <div className="mb-4">
        <h3 className="text-[15pt] font-bold text-blue-600 uppercase border-b-2 border-blue-600 pb-1 mb-3">Ringkasan Aktiviti Utama</h3>
        <div className="space-y-1.5 text-[13pt]">
          <div className="flex"><span className="font-bold min-w-[280px]">Jumlah permohonan disemak :</span><span className="border-b border-gray-400 flex-1 px-1">{report.jumlahDisemak}</span></div>
          <div className="flex"><span className="font-bold min-w-[280px]">Jumlah semakan selesai :</span><span className="border-b border-gray-400 flex-1 px-1">{report.jumlahSelesai}</span></div>
          <div className="flex"><span className="font-bold min-w-[280px]">Jumlah syor / keputusan lulus :</span><span className="border-b border-gray-400 flex-1 px-1">{report.jumlahLulus}</span></div>
          <div className="flex"><span className="font-bold min-w-[280px]">Jumlah syor / keputusan tolak :</span><span className="border-b border-gray-400 flex-1 px-1">{report.jumlahTolak}</span></div>
          <div className="flex"><span className="font-bold min-w-[280px]">Jumlah notifikasi / konsultansi (hari ini) :</span><span className="border-b border-gray-400 flex-1 px-1">{report.konsultansiStr}</span></div>
        </div>
      </div>

      {/* Isu dan Cabaran */}
      <div className="mb-4">
        <h3 className="text-[15pt] font-bold text-blue-600 uppercase border-b-2 border-blue-600 pb-1 mb-3">Isu dan Cabaran</h3>
        <div className="min-h-[50px] border-b border-gray-400" />
      </div>

      <div className="border-b-2 border-blue-600 my-4" />

      {/* Signature Area */}
      <div className="flex justify-between gap-8 mt-5">
        <div className="w-[45%]">
          <p className="font-bold text-[14pt] text-blue-600 mb-2">Disediakan Oleh,</p>
          <div className="relative h-[120px] w-full border-b border-black mb-1">
            <Image unoptimized id="lh_sign_img" src="" alt="Tandatangan" width={0} height={0} sizes="auto" style={{ display: 'none', position: 'absolute', bottom: '80px', left: 0, right: 0, margin: 'auto', height: '55px', width: 'auto', zIndex: 1 }} />
            <Image unoptimized id="lh_cop_img" src="" alt="Cop" width={0} height={0} sizes="auto" style={{ display: 'none', position: 'absolute', bottom: 0, left: 0, right: 0, margin: 'auto', height: '90px', width: 'auto', zIndex: 0, opacity: 0.85 }} />
          </div>
          <p className="font-bold text-[13pt] text-center">{user?.name || ''}</p>
          <p className="text-[12pt] text-center">Tarikh: {today}</p>
        </div>
        <div className="w-[45%]">
          <p className="font-bold text-[14pt] text-blue-600 mb-2">Disemak Oleh,</p>
          <div className="h-[120px] w-full border-b border-black mb-1" />
          <p className="font-bold text-[13pt] text-center" id="lh_disemak_oleh" />
          <p className="text-[12pt] text-center">Tarikh: <span id="lh_tarikh_disemak" /></p>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-[10pt] text-gray-500 border-t border-gray-300 pt-2 italic">
        PERINGATAN: Borang hendaklah dilengkapkan 30 minit sebelum waktu kerja tamat bagi memastikan ketepatan data dan hantar kepada Penyelia. Simpan salinan digital (PDF) sebagai bukti pencapaian KPI bulanan anda.
      </p>

      <div className="text-center mt-6 no-print">
        <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-sm font-bold transition">🖨️ Cetak / Simpan PDF</button>
        <button onClick={() => window.close()} className="ml-2 text-slate-500 px-4 py-2 text-sm">✕ Tutup</button>
      </div>

      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          #printLaporanHarian { font-size: 13pt; padding: 10px; max-width: 100%; }
        }
      `}</style>
    </div>
  );
}
