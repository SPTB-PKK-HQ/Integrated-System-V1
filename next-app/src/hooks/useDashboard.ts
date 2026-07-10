'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import type { ApplicationRecord, User } from '@/types';
import { gasGet } from '@/lib/gas';

export interface DashboardFilters {
  period: 'yearly' | 'monthly' | 'daily';
  year: number;
  month: number;
  day: number;
}

export interface DashboardStats {
  total: number;
  success: number;
  reject: number;
  card4Value: number | string;
  labelSuccess: string;
  labelReject: string;
  labelStatus: string;
  approvalRate: number;
  incompleteCount: number;
}

function resolveRecordDate(item: ApplicationRecord): Date | null {
  if (item.tarikh_syor?.trim()) return new Date(item.tarikh_syor);
  if (item.borang_json?.trim()) {
    try {
      const parsed = JSON.parse(item.borang_json);
      if (parsed.tarikh_masuk_sheet) return new Date(parsed.tarikh_masuk_sheet);
    } catch { /* ignore */ }
  }
  if (item.start_date?.trim()) return new Date(item.start_date);
  if (item.date_submit?.trim()) return new Date(item.date_submit);
  if (item.tarikh_lulus?.trim()) return new Date(item.tarikh_lulus);
  return null;
}

function getWeekNumber(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

const MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];

export function useDashboard(user: User | null) {
  const [records, setRecords] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const [filters, setFilters] = useState<DashboardFilters>({
    period: 'monthly',
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  });

  useEffect(() => {
    if (!user) return;
    gasGet<{ data: ApplicationRecord[] } | ApplicationRecord[]>({
      action: 'getData',
      role: user.role,
      userName: user.name,
    })
      .then((res) => {
        const data = Array.isArray(res) ? res : (res as { data: ApplicationRecord[] }).data || [];
        setRecords(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal memuat data'))
      .finally(() => setLoading(false));
  }, [user]);

  const filteredData = useMemo(() => {
    return records.filter((item) => {
      const date = resolveRecordDate(item);
      if (!date || isNaN(date.getTime())) return false;

      if (filters.period === 'yearly') return date.getFullYear() === filters.year;
      if (filters.period === 'daily')
        return date.getFullYear() === filters.year && date.getMonth() + 1 === filters.month && date.getDate() === filters.day;
      return date.getFullYear() === filters.year && date.getMonth() + 1 === filters.month;
    });
  }, [records, filters]);

  const userFilteredData = useMemo(() => {
    if (!user) return [];
    return filteredData.filter((item) => {
      if (['ADMIN', 'KETUA_SEKSYEN', 'PENGARAH'].includes(user.role)) return true;
      if (user.role === 'PENGESYOR')
        return item.pengesyor?.trim().toUpperCase() === user.name.trim().toUpperCase();
      if (user.role === 'PELULUS')
        return item.pelulus?.trim().toUpperCase() === user.name.trim().toUpperCase();
      return false;
    });
  }, [filteredData, user]);

  const stats = useMemo<DashboardStats>(() => {
    const total = userFilteredData.length;
    let success = 0;
    let reject = 0;
    let card4Value: number | string = 0;
    let labelSuccess = '';
    let labelReject = '';
    let labelStatus = '';

    if (!user) return { total: 0, success: 0, reject: 0, card4Value: 0, labelSuccess: '', labelReject: '', labelStatus: '', approvalRate: 0, incompleteCount: 0 };

    if (user.role === 'PENGESYOR') {
      success = userFilteredData.filter((d) => d.syor_status === 'SOKONG').length;
      reject = userFilteredData.filter((d) => d.syor_status === 'TIDAK DISOKONG').length;
      card4Value = total - (success + reject);
      labelSuccess = 'SOKONG';
      labelReject = 'TOLAK';
      labelStatus = 'PROSES';
    } else if (user.role === 'PELULUS') {
      success = userFilteredData.filter((d) => d.kelulusan?.toUpperCase().includes('LULUS')).length;
      reject = userFilteredData.filter((d) => d.kelulusan && (d.kelulusan.toUpperCase().includes('TOLAK') || d.kelulusan.toUpperCase().includes('SIASAT'))).length;
      card4Value = total > 0 ? Math.round((success / total) * 100) : 100;
      labelSuccess = 'LULUS';
      labelReject = 'GAGAL';
      labelStatus = 'PERATUS';
    } else {
      success = userFilteredData.filter((d) => d.kelulusan?.toUpperCase().includes('LULUS')).length;
      reject = userFilteredData.filter((d) => d.kelulusan && (d.kelulusan.toUpperCase().includes('TOLAK') || d.kelulusan.toUpperCase().includes('SIASAT'))).length;
      card4Value = userFilteredData.filter((d) => !d.kelulusan || d.kelulusan === '').length;
      labelSuccess = 'LULUS';
      labelReject = 'TOLAK';
      labelStatus = 'PROSES';
    }

    const approvalRate = total > 0 ? Math.round((success / (success + reject || 1)) * 100) : 0;

    // Incomplete count
    let incompleteCount = 0;
    userFilteredData.forEach((item) => {
      if (item.borang_json?.trim()) {
        try {
          const b = JSON.parse(item.borang_json);
          const fields = ['doc_carta_status', 'doc_peta_status', 'doc_gambar_status', 'doc_sewa_status', 'kwsp_s1', 'kwsp_s2', 'kwsp_s3', 'ssm_status', 'bank_status_input'];
          fields.forEach((f) => {
            if (!b[f] || b[f].toString().trim() === '' || b[f].toString().trim() === '-') incompleteCount++;
          });
        } catch { /* ignore */ }
      }
    });

    return { total, success, reject, card4Value, labelSuccess, labelReject, labelStatus, approvalRate, incompleteCount };
  }, [userFilteredData, user]);

  const statusData = useMemo(() => {
    if (!user) return { labels: [], counts: [], colors: [] };
    const sokong = userFilteredData.filter((d) => d.syor_status === 'SOKONG').length;
    const tidak = userFilteredData.filter((d) => d.syor_status === 'TIDAK DISOKONG').length;
    const lulus = userFilteredData.filter((d) => d.kelulusan?.toUpperCase().includes('LULUS')).length;
    const tolak = userFilteredData.filter((d) => d.kelulusan && (d.kelulusan.toUpperCase().includes('TOLAK') || d.kelulusan.toUpperCase().includes('SIASAT'))).length;
    const proses = userFilteredData.length - lulus - tolak;

    if (user.role === 'PENGESYOR') {
      const prosesS = userFilteredData.length - sokong - tidak;
      return {
        labels: ['SOKONG', 'TIDAK SOKONG', 'DALAM PROSES'],
        counts: [sokong, tidak, prosesS],
        colors: ['#22c55e', '#ef4444', '#f59e0b'],
      };
    }
    return {
      labels: ['LULUS', 'TOLAK/SIASAT', 'DALAM PROSES'],
      counts: [lulus, tolak, proses],
      colors: ['#22c55e', '#ef4444', '#f59e0b'],
    };
  }, [userFilteredData, user]);

  const typeData = useMemo(() => {
    const types: Record<string, number> = {};
    userFilteredData.forEach((item) => {
      const t = item.jenis?.toUpperCase().trim() || 'LAIN-LAIN';
      types[t] = (types[t] || 0) + 1;
    });
    return {
      labels: Object.keys(types),
      counts: Object.values(types),
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'],
    };
  }, [userFilteredData]);

  const reasonData = useMemo(() => {
    if (!user || user.role === 'PENGESYOR') return { labels: [], counts: [] };
    const rejected = userFilteredData.filter((d) => d.kelulusan && (d.kelulusan.toUpperCase().includes('TOLAK') || d.kelulusan.toUpperCase().includes('SIASAT')));
    const reasons: Record<string, number> = {};
    rejected.forEach((item) => {
      const r = item.alasan?.trim() || 'Tiada Alasan';
      reasons[r] = (reasons[r] || 0) + 1;
    });
    const sorted = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return {
      labels: sorted.map(([k]) => k.length > 30 ? k.substring(0, 27) + '...' : k),
      counts: sorted.map(([, v]) => v),
    };
  }, [userFilteredData, user]);

  const trendData = useMemo(() => {
    const months: Record<string, { supported: number; notSupported: number; approved: number; rejected: number }> = {};
    const nowDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = { supported: 0, notSupported: 0, approved: 0, rejected: 0 };
    }

    records.forEach((item) => {
      const date = resolveRecordDate(item);
      if (!date || isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) return;
      if (item.syor_status === 'SOKONG') months[key].supported++;
      if (item.syor_status === 'TIDAK DISOKONG') months[key].notSupported++;
      if (item.kelulusan?.toUpperCase().includes('LULUS')) months[key].approved++;
      if (item.kelulusan && (item.kelulusan.toUpperCase().includes('TOLAK') || item.kelulusan.toUpperCase().includes('SIASAT'))) months[key].rejected++;
    });

    const labels = Object.keys(months).map((key) => {
      const [y, m] = key.split('-');
      return `${MONTHS[parseInt(m) - 1]} ${y}`;
    });

    return {
      labels,
      supported: Object.values(months).map((v) => v.supported),
      notSupported: Object.values(months).map((v) => v.notSupported),
      approved: Object.values(months).map((v) => v.approved),
      rejected: Object.values(months).map((v) => v.rejected),
    };
  }, [records]);

  const updateFilter = useCallback(<K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const detailedTable = useMemo(() => {
    if (filters.period === 'yearly') {
      const rows = MONTHS.map((month, idx) => {
        const monthData = userFilteredData.filter((item) => {
          const d = resolveRecordDate(item);
          return d && d.getMonth() === idx;
        });
        const total = monthData.length;
        const approved = monthData.filter((d) => d.kelulusan?.toUpperCase().includes('LULUS')).length;
        const rejected = monthData.filter((d) => d.kelulusan && (d.kelulusan.toUpperCase().includes('TOLAK') || d.kelulusan.toUpperCase().includes('SIASAT'))).length;
        const inProcess = total - approved - rejected;
        const supported = monthData.filter((d) => d.syor_status === 'SOKONG').length;
        const notSupported = monthData.filter((d) => d.syor_status === 'TIDAK DISOKONG').length;
        const rate = total > 0 ? Math.round((approved / total) * 100) : 0;
        return { month, total, approved, rejected, inProcess, supported, notSupported, rate };
      });
      return { type: 'yearly' as const, rows };
    }

    if (filters.period === 'daily') {
      return { type: 'daily' as const, total: userFilteredData.length };
    }

    // monthly - week breakdown
    const weeks: Record<number, { total: number; approved: number; rejected: number; inProcess: number; supported: number; notSupported: number }> = {};
    userFilteredData.forEach((item) => {
      const d = resolveRecordDate(item);
      if (!d) return;
      const wk = getWeekNumber(d);
      if (!weeks[wk]) weeks[wk] = { total: 0, approved: 0, rejected: 0, inProcess: 0, supported: 0, notSupported: 0 };
      weeks[wk].total++;
      if (item.kelulusan?.toUpperCase().includes('LULUS')) weeks[wk].approved++;
      if (item.kelulusan && (item.kelulusan.toUpperCase().includes('TOLAK') || item.kelulusan.toUpperCase().includes('SIASAT'))) weeks[wk].rejected++;
      if (item.syor_status === 'SOKONG') weeks[wk].supported++;
      if (item.syor_status === 'TIDAK DISOKONG') weeks[wk].notSupported++;
    });

    const rows = [1, 2, 3, 4, 5].map((wk) => {
      const w = weeks[wk] || { total: 0, approved: 0, rejected: 0, inProcess: 0, supported: 0, notSupported: 0 };
      return {
        week: `Minggu ${wk}`,
        total: w.total,
        approved: w.approved,
        rejected: w.rejected,
        inProcess: w.total - w.approved - w.rejected,
        supported: w.supported,
        notSupported: w.notSupported,
        rate: w.total > 0 ? Math.round((w.approved / w.total) * 100) : 0,
      };
    }).filter((r) => r.total > 0);

    return { type: 'monthly' as const, rows };
  }, [userFilteredData, filters.period]);

  return {
    loading,
    error,
    records,
    filters,
    updateFilter,
    userFilteredData,
    stats,
    statusData,
    typeData,
    reasonData,
    trendData,
    detailedTable,
    userRole: user?.role || '',
    userName: user?.name || '',
  };
}
