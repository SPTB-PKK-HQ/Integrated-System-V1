'use client';

import { useState } from 'react';
import { gasPost } from '@/lib/gas';

interface Props {
  syarikat: string;
  userEmail: string;
  onFolderCreated?: (url: string) => void;
}

export default function DriveSection({ syarikat, userEmail, onFolderCreated }: Props) {
  const [creating, setCreating] = useState(false);
  const [folderUrl, setFolderUrl] = useState('');
  const [status, setStatus] = useState('');

  const createFolder = async () => {
    if (!syarikat.trim()) {
      setStatus('Sila isi nama syarikat terlebih dahulu.');
      return;
    }
    setCreating(true);
    setStatus('Mencipta folder...');
    try {
      const res = await gasPost<{ status: string; folderUrl?: string; message?: string }>({
        action: 'createDriveFolder',
        syarikat,
        email: userEmail,
      });
      if (res.status === 'success' && res.folderUrl) {
        setFolderUrl(res.folderUrl);
        setStatus('Folder berjaya dicipta!');
        onFolderCreated?.(res.folderUrl);
      } else {
        setStatus(res.message || 'Gagal mencipta folder.');
      }
    } catch {
      setStatus('Ralat mencipta folder.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
        📁 Google Drive (User Folder System)
        {creating && <span className="text-amber-600 text-xs font-semibold animate-pulse">Mencipta...</span>}
      </h3>

      <label className="flex items-center gap-2 text-sm text-slate-600 mb-4">
        <input type="checkbox" defaultChecked className="rounded" />
        Cipta folder dalam User Folder untuk syarikat ini
      </label>

      <button
        type="button"
        onClick={createFolder}
        disabled={creating}
        className="bg-orange-500 hover:bg-orange-600 disabled:bg-slate-400 text-white font-bold px-5 py-2.5 rounded-xl transition"
      >
        {creating ? '⏳ Mencipta...' : '📁 Cipta Folder Drive'}
      </button>

      {status && (
        <p className={`mt-3 text-sm font-semibold ${status.includes('berjaya') ? 'text-emerald-600' : 'text-amber-600'}`}>
          {status}
        </p>
      )}

      {folderUrl && (
        <div className="mt-3">
          <a
            href={folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 text-sm font-semibold hover:underline"
          >
            📂 Buka Folder Drive
          </a>
        </div>
      )}
    </div>
  );
}
