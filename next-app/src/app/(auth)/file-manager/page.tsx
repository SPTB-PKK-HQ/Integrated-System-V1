'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { gasPost } from '@/lib/gas';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  lastUpdated: string;
  webViewLink: string;
  thumbnailLink: string;
  iconLink: string;
}

function getFileIcon(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.includes('pdf')) return '📄';
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('sheet')) return '📊';
  if (mime.includes('document') || mime.includes('word')) return '📝';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📽️';
  if (mime.includes('video')) return '🎥';
  if (mime.includes('audio')) return '🎵';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar')) return '📦';
  return '📎';
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '-';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function extractFolderId(input: string): string {
  const match = input.match(/folders\/([a-zA-Z0-9_-]+)/) || input.match(/^([a-zA-Z0-9_-]{25,})$/) || input.match(/[-\w]{25,}/);
  return match ? match[1] || match[0] : input;
}

export default function FileManagerPage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [folderInput, setFolderInput] = useState('');
  const [folderId, setFolderId] = useState('');
  const [folderName, setFolderName] = useState('');
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const msgStyle = (ok: boolean) =>
    `text-sm font-bold p-3 rounded-xl ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`;

  const loadFiles = async (fid: string) => {
    if (!fid) return;
    setLoading(true);
    setMsg('');
    try {
      const res = await gasPost<{ success: boolean; files: DriveFile[]; folderName: string; error?: string }>({
        action: 'listDriveFiles',
        folderId: fid,
      });
      if (res.success) {
        setFiles(res.files || []);
        setFolderName(res.folderName || '');
      } else {
        setFiles([]);
        setMsg(res.error || 'Gagal memuat fail.');
      }
    } catch {
      setFiles([]);
      setMsg('Ralat memuat fail.');
    } finally {
      setLoading(false);
    }
  };

  const handleBrowse = () => {
    const fid = extractFolderId(folderInput);
    if (!fid) { setMsg('Sila masukkan URL atau ID folder Drive.'); return; }
    setFolderId(fid);
    loadFiles(fid);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !folderId) return;
    setUploading(true);
    setMsg('');
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      bytes.forEach((b) => { binary += String.fromCharCode(b); });
      const base64 = btoa(binary);

      const res = await gasPost<{ success: boolean; file: DriveFile; error?: string }>({
        action: 'uploadDriveFile',
        folderId,
        fileName: file.name,
        mimeType: file.type,
        fileData: base64,
        email: user?.email || '',
      });
      if (res.success) {
        setFiles((prev) => [...prev, res.file]);
        setMsg(`✅ ${file.name} berjaya dimuat naik.`);
      } else {
        setMsg(res.error || 'Gagal muat naik.');
      }
    } catch {
      setMsg('Ralat muat naik.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (file: DriveFile) => {
    if (!confirm(`Padam "${file.name}"?`)) return;
    try {
      const res = await gasPost<{ success: boolean; error?: string }>({
        action: 'deleteDriveFile',
        fileId: file.id,
        email: user?.email || '',
      });
      if (res.success) {
        setFiles((prev) => prev.filter((f) => f.id !== file.id));
        setMsg(`🗑️ ${file.name} dipadam.`);
      } else {
        setMsg(res.error || 'Gagal padam.');
      }
    } catch {
      setMsg('Ralat padam fail.');
    }
  };

  const startRename = (file: DriveFile) => {
    setRenaming(file.id);
    setNewName(file.name);
  };

  const confirmRename = async (fileId: string) => {
    if (!newName.trim()) return;
    try {
      const res = await gasPost<{ success: boolean; file: DriveFile; error?: string }>({
        action: 'renameDriveFile',
        fileId,
        newName: newName.trim(),
        email: user?.email || '',
      });
      if (res.success) {
        setFiles((prev) => prev.map((f) => f.id === fileId ? res.file : f));
        setMsg(`✏️ Dinamakan semula kepada "${newName.trim()}".`);
      } else {
        setMsg(res.error || 'Gagal rename.');
      }
    } catch {
      setMsg('Ralat rename fail.');
    } finally {
      setRenaming(null);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
          <h1 className="text-white font-bold text-lg">📁 File Manager</h1>
          <p className="text-white/50 text-xs">Urus fail dalam Google Drive</p>
        </div>

        {/* Folder Input */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Folder Drive (URL atau ID)</label>
          <div className="flex gap-2">
            <input type="text" value={folderInput} onChange={(e) => setFolderInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBrowse()}
              placeholder="https://drive.google.com/drive/folders/xxx atau folder ID"
              className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500" />
            <button onClick={handleBrowse} disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-5 py-2 rounded-lg text-sm font-bold transition">
              {loading ? '⏳' : '🔍 Buka'}
            </button>
          </div>
          {folderName && <p className="mt-1 text-xs text-slate-500">📂 {folderName}</p>}
        </div>

        {msg && <div className={msgStyle(!msg.includes('Gagal') && !msg.includes('Ralat'))}>{msg}</div>}

        {/* Upload */}
        {folderId && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex items-center gap-3">
            <input ref={fileInputRef} type="file" onChange={handleUpload} disabled={uploading}
              className="text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            {uploading && <span className="text-amber-600 text-sm font-semibold animate-pulse">⏳ Memuat naik...</span>}
          </div>
        )}

        {/* File Grid */}
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : folderId && files.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <p className="text-4xl mb-2">📂</p>
            <p className="text-slate-500 font-bold">Folder kosong.</p>
            <p className="text-slate-400 text-sm">Muat naik fail menggunakan butang di atas.</p>
          </div>
        ) : files.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <p className="text-xs text-slate-500 font-semibold">{files.length} fail</p>
              <button onClick={() => loadFiles(folderId)} className="text-blue-600 text-xs font-bold hover:underline">🔄 Refresh</button>
            </div>
            <div className="divide-y divide-slate-100">
              {files.map((file) => (
                <div key={file.id} className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition group">
                  <span className="text-xl shrink-0">{getFileIcon(file.mimeType)}</span>
                  {file.thumbnailLink && (
                    <Image unoptimized src={file.thumbnailLink} alt="" width={40} height={40} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-200" />
                  )}
                  <div className="flex-1 min-w-0">
                    {renaming === file.id ? (
                      <div className="flex gap-2">
                        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && confirmRename(file.id)}
                          className="flex-1 px-2 py-1 border-2 border-blue-400 rounded text-sm outline-none"
                          autoFocus />
                        <button onClick={() => confirmRename(file.id)}
                          className="bg-emerald-500 text-white px-3 py-1 rounded text-xs font-bold">Simpan</button>
                        <button onClick={() => setRenaming(null)}
                          className="text-slate-400 px-2 py-1 text-xs">✕</button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {formatSize(file.size)} | {new Date(file.lastUpdated).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </>
                    )}
                  </div>
                  <div className={`flex gap-1 shrink-0 ${renaming === file.id ? 'opacity-30' : ''}`}>
                    <a href={file.webViewLink} target="_blank" rel="noopener noreferrer"
                      className="bg-slate-100 hover:bg-blue-100 text-slate-600 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition">🔗 Buka</a>
                    <button onClick={() => startRename(file)}
                      className="bg-slate-100 hover:bg-amber-100 text-slate-600 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition">✏️</button>
                    <button onClick={() => handleDelete(file)}
                      className="bg-slate-100 hover:bg-red-100 text-slate-600 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
