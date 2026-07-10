'use client';

import { useState } from 'react';

interface WhatsAppData {
  tarikh: string;
  masa: string;
  ayat: string;
}

interface Props {
  onChange?: (data: WhatsAppData | null) => void;
}

export default function WhatsAppScheduler({ onChange }: Props) {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<WhatsAppData>({ tarikh: '', masa: '', ayat: '' });

  const update = (changes: Partial<WhatsAppData>) => {
    const next = { ...data, ...changes };
    setData(next);
    onChange?.(next);
  };

  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-semibold text-emerald-700 cursor-pointer mt-4">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => { setVisible(e.target.checked); if (!e.target.checked) onChange?.(null); }}
          className="rounded"
        />
        📅 Paparkan Jadual WhatsApp
      </label>

      {visible && (
        <div className="mt-3 border-t-2 border-emerald-400 pt-4 bg-emerald-50 rounded-xl p-4">
          <label className="font-bold text-emerald-800 flex items-center gap-2 text-sm mb-4">
            💬 WhatsApp Scheduling (Auto)
          </label>

          <div className="flex flex-wrap gap-4 mb-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-slate-600">Tarikh Hantar:</label>
              <input
                type="date"
                value={data.tarikh}
                onChange={(e) => update({ tarikh: e.target.value })}
                className="w-full px-3 py-2 border-2 border-emerald-300 rounded-lg text-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="text-xs font-semibold text-slate-600">Masa (Jam):</label>
              <select
                value={data.masa}
                onChange={(e) => update({ masa: e.target.value })}
                className="w-full px-3 py-2 border-2 border-emerald-300 rounded-lg text-sm outline-none focus:border-emerald-500"
              >
                <option value="">Pilih Jam</option>
                {[8, 9, 10, 11, 12, 14, 15, 16, 17].map((h) => (
                  <option key={h} value={h}>
                    {h >= 12 ? `${h}:00 PM` : `${h}:00 AM`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Mesej WhatsApp:</label>
            <textarea
              value={data.ayat}
              onChange={(e) => update({ ayat: e.target.value })}
              rows={3}
              placeholder="Taip mesej WhatsApp yang ingin dihantar secara auto..."
              className="w-full mt-1 px-3 py-2 border-2 border-emerald-300 rounded-lg text-sm outline-none focus:border-emerald-500 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
