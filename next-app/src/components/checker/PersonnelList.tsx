'use client';

import { useState } from 'react';
import StatusInput from './StatusInput';

interface Personnel {
  id: string;
  name: string;
  isCompany: boolean;
  roles: string[];
  s_ic: string;
  s_sb: string;
  s_epf: string;
  c_date: string;
  c_status: string;
}

const ROLES = [
  { value: 'PENGARAH', label: 'PENGARAH' },
  { value: 'P.EKUITI', label: 'P.EKUITI' },
  { value: 'P.SPKK', label: 'P.SPKK' },
  { value: 'T.T CEK', label: 'T.T CEK' },
];

let personIdCounter = 0;

interface Props {
  onDataChange?: (personnel: Personnel[]) => void;
}

export default function PersonnelList({ onDataChange }: Props) {
  const [personnel, setPersonnel] = useState<Personnel[]>([createPerson()]);

  function createPerson(data?: Partial<Personnel>): Personnel {
    return {
      id: `p_${++personIdCounter}`,
      name: '',
      isCompany: false,
      roles: [],
      s_ic: '',
      s_sb: '',
      s_epf: '',
      c_date: '',
      c_status: '',
      ...data,
    };
  }

  function update(updated: Personnel[]) {
    setPersonnel(updated);
    onDataChange?.(updated);
  }

  function addPerson() {
    update([...personnel, createPerson()]);
  }

  function removePerson(id: string) {
    const updated = personnel.filter((p) => p.id !== id);
    update(updated.length === 0 ? [createPerson()] : updated);
  }

  function updatePerson(id: string, changes: Partial<Personnel>) {
    update(personnel.map((p) => (p.id === id ? { ...p, ...changes } : p)));
  }

  function toggleRole(id: string, role: string) {
    const person = personnel.find((p) => p.id === id);
    if (!person) return;
    const roles = person.roles.includes(role)
      ? person.roles.filter((r) => r !== role)
      : [...person.roles, role];
    updatePerson(id, { roles });
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <h2 className="text-lg font-bold text-slate-800">👤 Personel</h2>
        <button
          type="button"
          id="btnSemakCepat"
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg shadow-orange-400/30 border-2 border-white transition"
          onClick={() => {
            const modal = document.getElementById('quickCheckModal');
            if (modal) modal.classList.toggle('hidden');
          }}
        >
          ⚡ Semak Cepat
        </button>
      </div>

      <div className="space-y-4" id="personnelList">
        {personnel.map((person) => (
          <div
            key={person.id}
            className="person-card bg-slate-50 border border-slate-200 rounded-xl p-4 relative"
          >
            <button
              type="button"
              onClick={() => removePerson(person.id)}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 text-xs font-bold flex items-center justify-center transition"
            >
              ✕
            </button>

            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">Nama Personel</label>
              <label className="text-xs text-slate-500 flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={person.isCompany}
                  onChange={(e) => updatePerson(person.id, { isCompany: e.target.checked })}
                  className="rounded"
                />
                Syarikat?
              </label>
            </div>

            <input
              type="text"
              value={person.name}
              onChange={(e) => updatePerson(person.id, { name: e.target.value.toUpperCase() })}
              placeholder="NAMA PENUH"
              style={{ textTransform: 'uppercase' }}
              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-500 mb-3"
            />

            <div className="mb-2">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Jawatan:</label>
              <div className="flex flex-wrap gap-3">
                {ROLES.map((role) => (
                  <label key={role.value} className="flex items-center gap-1 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={person.roles.includes(role.value)}
                      onChange={() => toggleRole(person.id, role.value)}
                      className="rounded"
                    />
                    {role.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-dashed border-slate-300 pt-3 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">IC</label>
                  <StatusInput
                    value={person.s_ic}
                    onChange={(v) => updatePerson(person.id, { s_ic: v })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">SB</label>
                  <StatusInput
                    value={person.s_sb}
                    onChange={(v) => updatePerson(person.id, { s_sb: v })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">EPF</label>
                  <StatusInput
                    value={person.s_epf}
                    onChange={(v) => updatePerson(person.id, { s_epf: v })}
                  />
                </div>
              </div>

              {/* Company fields */}
              <div className={`grid grid-cols-2 gap-3 mt-3 ${person.isCompany ? '' : 'hidden'}`}>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Tarikh Semakan</label>
                  <input
                    type="date"
                    value={person.c_date}
                    onChange={(e) => updatePerson(person.id, { c_date: e.target.value })}
                    className="w-full px-2 py-1.5 border-2 border-amber-200 rounded-lg text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Status Semakan</label>
                  <StatusInput
                    value={person.c_status}
                    onChange={(v) => updatePerson(person.id, { c_status: v })}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addPerson}
        className="mt-4 w-full py-2.5 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 font-bold text-sm hover:bg-blue-50 transition"
      >
        + Tambah Personel
      </button>

      {/* Quick Check Modal */}
      <div id="quickCheckModal" className="fixed inset-0 z-50 hidden items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) document.getElementById('quickCheckModal')?.classList.add('hidden'); }}>
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg mx-4 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">⚡ Semak Cepat Personel</h3>
            <button onClick={() => document.getElementById('quickCheckModal')?.classList.add('hidden')} className="text-slate-400 hover:text-slate-600 text-xl leading-none p-1">✕</button>
          </div>
          <div className="px-5 py-4 space-y-3">
            {personnel.length === 0 && <p className="text-slate-500 text-sm">Tiada personel.</p>}
            {personnel.map((p) => {
              const missing: string[] = [];
              if (!p.name.trim()) missing.push('Nama');
              if (p.roles.length === 0) missing.push('Jawatan');
              if (!p.s_ic) missing.push('IC');
              if (!p.s_sb) missing.push('SB');
              if (!p.s_epf) missing.push('EPF');
              if (p.isCompany && !p.c_date) missing.push('Tarikh Sijil');
              if (p.isCompany && !p.c_status) missing.push('Status Sijil');
              return (
                <div key={p.id} className={`p-3 rounded-xl border ${missing.length === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="font-bold text-sm text-slate-800">{p.name || '(Tanpa Nama)'}</p>
                  {missing.length > 0 ? (
                    <p className="text-xs text-red-600 mt-1">❌ Belum lengkap: {missing.join(', ')}</p>
                  ) : (
                    <p className="text-xs text-emerald-600 mt-1">✅ Lengkap</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
            <button onClick={() => document.getElementById('quickCheckModal')?.classList.add('hidden')}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition">
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
