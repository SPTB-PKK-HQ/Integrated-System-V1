'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { gasPost } from '@/lib/gas';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  webViewLink?: string;
}

interface FileManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderUrl: string;
  currentUser?: { name: string; email: string; role: string };
}

function extractFolderId(url: string): string {
  const m = url.match(/[-\w]{25,}/);
  return m ? m[0] : '';
}

function getFileIcon(mimeType: string, fileName: string): string {
  const imgTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  if (!mimeType && fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (imgTypes.includes(ext)) return '🖼️';
    if (ext === 'pdf') return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    if (['ppt', 'pptx'].includes(ext)) return '📑';
    if (['zip', 'rar', '7z'].includes(ext)) return '🗜️';
    return '📎';
  }
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📑';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '🗜️';
  return '📎';
}

function formatFileSize(bytes: string): string {
  const n = parseInt(bytes, 10);
  if (!n || n === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return parseFloat((n / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const SKELETON = (
  <div style={{
    background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 8
  }}>
    <div style={{
      width: '100%', height: 120, borderRadius: 8,
      background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'fileMgrShimmer 1.5s infinite'
    }} />
    <div style={{
      width: '80%', height: 12, margin: '8px auto 4px', borderRadius: 4,
      background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
      backgroundSize: '200% 100%', animation: 'fileMgrShimmer 1.5s infinite'
    }} />
    <div style={{
      width: '50%', height: 10, margin: '0 auto', borderRadius: 4,
      background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
      backgroundSize: '200% 100%', animation: 'fileMgrShimmer 1.5s infinite'
    }} />
  </div>
);

const S_SHIMMER = `@keyframes fileMgrShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;

export default function FileManagerModal({ isOpen, onClose, folderUrl, currentUser }: FileManagerModalProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const folderId = extractFolderId(folderUrl);

  const canEdit = (() => {
    return currentUser?.role === 'ADMIN' || currentUser?.role === 'KETUA_SEKSYEN' || currentUser?.role === 'PENGARAH';
  })();

  const loadFiles = useCallback(async () => {
    if (!folderId) return;
    setLoading(true);
    setError('');
    try {
      const result = await gasPost<{ success: boolean; files?: DriveFile[]; folderName?: string; error?: string }>({
        action: 'listDriveFiles',
        folderId,
        email: currentUser?.email || ''
      });
      if (result.success) {
        setFiles(result.files || []);
        setFolderName(result.folderName || 'Folder');
      } else {
        setError(result.error || 'Gagal memuatkan fail');
      }
    } catch (e) {
      setError('Ralat: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [folderId, currentUser]);

  const prevOpen = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevOpen.current && folderId) {
      loadFiles();
    }
    prevOpen.current = isOpen;
  }, [isOpen, folderId, loadFiles]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async (fileList: FileList | File[]) => {
    const uploadFiles = Array.from(fileList);
    if (uploadFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    for (let i = 0; i < uploadFiles.length; i++) {
      const file = uploadFiles[i];
      setUploadProgress(Math.round((i / uploadFiles.length) * 100));
      try {
        const fileData = await fileToBase64(file);
        await gasPost<{ success: boolean; error?: string }>({
          action: 'uploadDriveFile',
          folderId,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileData,
          email: currentUser?.email || ''
        });
      } catch (err) {
        console.error('Upload failed:', file.name, err);
      }
    }

    setUploadProgress(100);
    await loadFiles();
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Padamkan fail "${fileName}"? Fail akan dipindahkan ke tong sampah Drive.`)) return;
    try {
      const result = await gasPost<{ success: boolean; error?: string }>({
        action: 'deleteDriveFile',
        fileId,
        email: currentUser?.email || ''
      });
      if (result.success) {
        await loadFiles();
      } else {
        alert(result.error || 'Gagal padam fail');
      }
    } catch (err) {
      alert('Ralat padam fail: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleRename = async (fileId: string, currentName: string) => {
    const newName = prompt('Nama baru untuk fail ini:', currentName || '');
    if (!newName || newName.trim() === '' || newName.trim() === currentName) return;
    try {
      const result = await gasPost<{ success: boolean; error?: string }>({
        action: 'renameDriveFile',
        fileId,
        newName: newName.trim(),
        email: currentUser?.email || ''
      });
      if (result.success) {
        await loadFiles();
      } else {
        alert(result.error || 'Gagal menamakan semula fail');
      }
    } catch (err) {
      alert('Ralat: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (dragCounter.current === 1) setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragOver(false);
    const dropped = e.dataTransfer.files;
    if (dropped && dropped.length > 0) {
      await handleUpload(dropped);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: S_SHIMMER }} />
      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
          padding: 16
        }}>
        <div style={{
          background: 'white', borderRadius: 20, maxWidth: 800, width: '95%',
          maxHeight: '90vh', overflowY: 'auto', padding: 25, position: 'relative',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)'
        }}>
          <span
            onClick={onClose}
            style={{
              position: 'absolute', top: 15, right: 20, fontSize: 28, cursor: 'pointer',
              color: '#64748b', lineHeight: 1
            }}>
            ×
          </span>

          <h2 style={{
            color: '#1e40af', borderBottom: '2px solid #e2e8f0', paddingBottom: 10,
            marginTop: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 20
          }}>
            📂 Pengurusan Fail
          </h2>

          <div style={{
            margin: '10px 0', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', flexWrap: 'wrap', gap: 10
          }}>
            <span style={{ color: '#64748b', fontWeight: 600, fontSize: 14 }}>
              📁 {folderName || 'Folder'}
              {folderId && (
                <a
                  href={`https://drive.google.com/drive/folders/${folderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#2563eb', fontWeight: 600, fontSize: 13,
                    textDecoration: 'underline', marginLeft: 8
                  }}>
                  Buka di Drive ↗
                </a>
              )}
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                accept="*/*"
                onChange={async (e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    await handleUpload(e.target.files);
                  }
                }}
              />
              {canEdit && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    padding: '8px 16px', fontSize: 14, background: '#2563eb',
                    color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
                    fontWeight: 600, opacity: uploading ? 0.6 : 1
                  }}>
                  ⬆️ Muat Naik
                </button>
              )}
              <button
                onClick={loadFiles}
                disabled={loading}
                style={{
                  padding: '8px 16px', fontSize: 14, background: 'white',
                  color: '#334155', border: '1px solid #cbd5e1', borderRadius: 8,
                  cursor: 'pointer', fontWeight: 600
                }}>
                🔄 Segar Semula
              </button>
            </div>
          </div>

          {/* Upload progress */}
          {uploading && (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                background: '#e2e8f0', borderRadius: 10, height: 6, overflow: 'hidden'
              }}>
                <div style={{
                  background: '#2563eb', height: '100%', width: `${uploadProgress}%`,
                  transition: 'width 0.3s'
                }} />
              </div>
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Memuat naik... {uploadProgress}%
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p style={{ textAlign: 'center', color: '#ef4444', padding: 40 }}>
              ❌ {error}
            </p>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div style={{
              minHeight: 200, border: '1px solid #e2e8f0', borderRadius: 8,
              padding: 10, background: '#f8fafc'
            }}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10
              }}>
                {[1, 2, 3, 4].map(i => <div key={i}>{SKELETON}</div>)}
              </div>
            </div>
          )}

          {/* File list */}
          {!loading && !error && (
            <div
              onDragEnter={canEdit ? handleDragEnter : undefined}
              onDragLeave={canEdit ? handleDragLeave : undefined}
              onDragOver={(e) => { if (canEdit) { e.preventDefault(); e.stopPropagation(); } }}
              onDrop={canEdit ? handleDrop : undefined}
              style={{
                minHeight: 200, maxHeight: '55vh', overflowY: 'auto',
                border: dragOver ? '3px dashed #2563eb' : '1px solid #e2e8f0',
                borderRadius: 8, padding: 10,
                background: dragOver ? 'rgba(37,99,235,0.05)' : '#f8fafc',
                position: 'relative', transition: 'border-color 0.2s, background 0.2s'
              }}>
              {dragOver && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                  backdropFilter: 'blur(2px)'
                }}>
                  <div style={{
                    background: 'white', padding: '20px 30px', borderRadius: 12,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15)', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 40, marginBottom: 5 }}>📁</div>
                    <div style={{ fontWeight: 'bold', color: '#2563eb', fontSize: 16 }}>
                      Lepaskan fail di sini
                    </div>
                  </div>
                </div>
              )}

              {files.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>
                  📂 {canEdit ? 'Folder ini masih kosong. Klik "Muat Naik" untuk tambah fail.' : 'Folder ini masih kosong.'}
                </p>
              ) : (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10
                }}>
                  {files.map((file) => {
                    const isImage = file.mimeType?.startsWith('image/');
                    const thumbnail = isImage && file.thumbnailLink
                      ? file.thumbnailLink
                      : getFileIcon(file.mimeType, file.name);

                    return (
                      <div key={file.id} style={{
                        background: 'white', border: '1px solid #e2e8f0',
                        borderRadius: 10, padding: 8, textAlign: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}>
                        {isImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumbnail as string}
                            alt={file.name}
                            style={{
                              width: '100%', height: 120, objectFit: 'cover',
                              borderRadius: 8
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '100%', height: 120, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: 48, background: '#f1f5f9', borderRadius: 8
                          }}>
                            {thumbnail}
                          </div>
                        )}
                        <p style={{
                          fontSize: 12, margin: '5px 0', wordBreak: 'break-word',
                          lineHeight: 1.2, minHeight: '2.4em',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          overflow: 'hidden', color: '#334155', fontWeight: 500
                        }}>
                          {file.name}
                        </p>
                        <p style={{
                          fontSize: 10, color: '#94a3b8', margin: '2px 0'
                        }}>
                          {file.size ? formatFileSize(file.size) : ''}
                        </p>
                        <div style={{
                          display: 'flex', gap: 4, justifyContent: 'center', marginTop: 4
                        }}>
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '4px 8px', fontSize: 11,
                                background: '#e0f2fe', border: '1px solid #bae6fd',
                                borderRadius: 6, cursor: 'pointer', color: '#0369a1',
                                textDecoration: 'none', fontWeight: 500
                              }}>
                              👁️ Buka
                            </a>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleRename(file.id, file.name)}
                              style={{
                                padding: '4px 8px', fontSize: 11,
                                background: '#fef3c7', border: '1px solid #fde68a',
                                borderRadius: 6, cursor: 'pointer', color: '#92400e'
                              }}>
                              ✏️
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleDelete(file.id, file.name)}
                              style={{
                                padding: '4px 8px', fontSize: 11,
                                background: '#fee2e2', border: '1px solid #fecaca',
                                borderRadius: 6, cursor: 'pointer', color: '#dc2626'
                              }}>
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
