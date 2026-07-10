'use client';

import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

interface ChartData {
  labels: string[];
  counts: number[];
  colors?: string[];
}

interface BarData {
  labels: string[];
  supported: number[];
  notSupported: number[];
  approved: number[];
  rejected: number[];
}

interface Props {
  statusData: ChartData;
  typeData: ChartData;
  reasonData: { labels: string[]; counts: number[] };
  trendData: BarData;
  role: string;
}

function DoughnutChart({
  data,
  title,
}: {
  data: ChartData;
  title: string;
}) {
  if (data.labels.length === 0) return null;

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
      <div className="relative h-[260px]">
        <Doughnut
          data={{
            labels: data.labels,
            datasets: [
              {
                data: data.counts,
                backgroundColor: data.colors || ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'],
                borderWidth: 3,
                borderColor: 'rgba(255,255,255,0.1)',
                hoverOffset: 15,
                borderRadius: 6,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: 'rgba(255,255,255,0.8)', font: { size: 11 }, padding: 12 },
              },
              title: {
                display: true,
                text: title,
                color: 'rgba(255,255,255,0.9)',
                font: { size: 14, weight: 'bold' },
                padding: { bottom: 12 },
              },
            },
          }}
        />
      </div>
    </div>
  );
}

function TrendChart({ data, role }: { data: BarData; role: string }) {
  if (data.labels.length === 0) return null;

  const isPengesyor = role === 'PENGESYOR';

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
      <h3 className="text-white/80 text-sm font-bold text-center mb-4">
        {isPengesyor ? 'Trend Syor Bulanan' : 'Trend Kelulusan Bulanan'}
      </h3>
      <div className="relative h-[260px]">
        <Doughnut
          data={{
            labels: data.labels,
            datasets: isPengesyor
              ? [
                  { label: 'SOKONG', data: data.supported, backgroundColor: '#10b981' },
                  { label: 'TIDAK DISOKONG', data: data.notSupported, backgroundColor: '#ef4444' },
                ]
              : [
                  { label: 'DILULUSKAN', data: data.approved, backgroundColor: '#10b981' },
                  { label: 'DITOLAK/SIASAT', data: data.rejected, backgroundColor: '#ef4444' },
                ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: 'rgba(255,255,255,0.8)', font: { size: 11 } },
              },
            },
          }}
        />
      </div>
    </div>
  );
}

export default function Charts({ statusData, typeData, reasonData, trendData, role: _role }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <DoughnutChart data={statusData} title="Status Permohonan" />
      <DoughnutChart data={typeData} title="Jenis Permohonan" />
      {reasonData.labels.length > 0 && (
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
          <h3 className="text-white/80 text-sm font-bold text-center mb-4">Alasan Penolakan</h3>
          <div className="space-y-2">
            {reasonData.labels.map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-white/60 text-xs flex-1 truncate">{label}</span>
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (reasonData.counts[i] / Math.max(...reasonData.counts)) * 100)}%` }}
                  />
                </div>
                <span className="text-white/80 text-xs font-bold w-6 text-right">{reasonData.counts[i]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <TrendChart data={trendData} role={_role} />
    </div>
  );
}
