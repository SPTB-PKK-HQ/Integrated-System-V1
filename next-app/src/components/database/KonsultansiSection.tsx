'use client';

import { useState } from 'react';

interface KonsultansiState {
  emel: boolean;
  whatsapp: boolean;
  call: boolean;
  emelDate: string;
  whatsappDate: string;
  callDate: string;
  dueDate: string;
}

interface Props {
  onChange?: (state: KonsultansiState) => void;
}

export default function KonsultansiSection({ onChange }: Props) {
  const [state, setState] = useState<KonsultansiState>({
    emel: false, whatsapp: false, call: false,
    emelDate: '', whatsappDate: '', callDate: '', dueDate: '',
  });

  const update = (changes: Partial<KonsultansiState>) => {
    const next = { ...state, ...changes };
    setState(next);
    onChange?.(next);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <label className="font-bold text-blue-800 text-sm">📞 Jenis Konsultansi & Due Date (Kolum V)</label>

      <div className="flex flex-wrap gap-6 mt-4">
        {(['emel', 'whatsapp', 'call'] as const).map((type) => (
          <div key={type}>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={state[type]}
                onChange={(e) => update({ [type]: e.target.checked })}
                className="rounded"
              />
              {type === 'emel' ? 'Emel' : type === 'whatsapp' ? 'WhatsApp' : 'Panggilan Telefon'}
            </label>
            {state[type] && (
              <input
                type="date"
                value={state[`${type}Date`]}
                onChange={(e) => update({ [`${type}Date`]: e.target.value })}
                className="mt-2 px-3 py-1.5 border-2 border-blue-200 rounded-lg text-sm outline-none focus:border-blue-500"
              />
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-slate-300 mt-6 pt-4">
        <label className="font-bold text-red-500 text-sm">⏳ Tarikh Due Date (SLA)</label>
        <input
          type="date"
          value={state.dueDate}
          onChange={(e) => update({ dueDate: e.target.value })}
          className="mt-2 px-3 py-2 border-2 border-red-300 rounded-lg text-sm outline-none focus:border-red-500"
        />
      </div>
    </div>
  );
}
