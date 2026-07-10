'use client';

import { useRef, useState, useCallback } from 'react';
import { usePdfExtraction } from '@/hooks/usePdfExtraction';
import type { ExtractedPdfData } from '@/hooks/usePdfExtraction';

interface Props {
  userEmail: string;
  onDataExtracted?: (data: ExtractedPdfData) => void;
}

export default function PdfUpload({ userEmail, onDataExtracted }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('Sedia untuk menerima fail...');
  const [aiModel, setAiModel] = useState('auto');
  const [showResult, setShowResult] = useState(false);

  const {
    extractedData,
    processing,
    progress,
    error,
    extractPdfText,
    processWithAI,
    clearExtraction,
  } = usePdfExtraction(userEmail);

  const notifyData = useCallback((data: ExtractedPdfData) => {
    onDataExtracted?.(data);
  }, [onDataExtracted]);

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Sila muat naik fail PDF sahaja.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Fail PDF terlalu besar. Maksimum 10MB.');
      return;
    }
    setFileName(file.name);
    setShowResult(false);
    clearExtraction();

    try {
      const text = await extractPdfText(file);
      const data = await processWithAI(text, aiModel);
      notifyData(data);
      setShowResult(true);
    } catch {
      // error is handled in the hook
    }
  }, [aiModel, extractPdfText, processWithAI, notifyData, clearExtraction]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const circumference = 2 * Math.PI * 70;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-4">🚀 Auto-Ekstrak Borang (AI)</h2>

      {/* Model Selector */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2">
          <label className="font-bold text-blue-700 text-sm">🧠 Model:</label>
          <select
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="border-2 border-blue-500 rounded-lg px-3 py-1.5 text-sm font-bold outline-none"
            disabled={processing}
          >
            <option value="auto">Auto (Disyorkan)</option>
            <option value="deepseek">Satu</option>
            <option value="gemini">Dua</option>
            <option value="openrouter">Tiga</option>
          </select>
        </div>
      </div>

      {/* Upload Area */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center cursor-pointer"
      >
        {/* Progress Ring */}
        <div className="relative w-[150px] h-[150px] mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 150 150">
            <circle
              cx="75" cy="75" r="70"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="5"
            />
            <circle
              cx="75" cy="75" r="70"
              fill="none"
              stroke={error ? '#ef4444' : processing ? '#3b82f6' : '#10b981'}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (circumference * progress) / 100}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {processing ? (
              <>
                <span className="text-2xl font-bold text-blue-600">{progress}%</span>
                <span className="text-xs text-slate-500 mt-1">Memproses...</span>
              </>
            ) : error ? (
              <>
                <span className="text-2xl">❌</span>
                <span className="text-xs text-red-500 mt-1">Ralat</span>
              </>
            ) : extractedData ? (
              <>
                <span className="text-2xl">✅</span>
                <span className="text-xs text-emerald-600 mt-1">Siap</span>
              </>
            ) : (
              <>
                <span className="text-2xl">📄</span>
                <span className="text-xs text-slate-500 mt-1">Pilih PDF</span>
              </>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          hidden
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        <button
          type="button"
          disabled={processing}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold px-6 py-2.5 rounded-xl transition-colors"
        >
          Klik / Seret Dokumen
        </button>

        <span className={`mt-3 text-sm font-bold ${error ? 'text-red-500' : 'text-blue-600'}`}>
          {error || fileName}
        </span>
        {processing && (
          <span className="mt-1 text-xs text-slate-500">Memproses dengan AI...</span>
        )}
      </div>

      {/* Result */}
      {showResult && extractedData && (
        <div className="mt-6 bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-5 animate-[fadeIn_0.6s_ease-out]">
          <h3 className="text-emerald-700 font-bold flex items-center gap-2 mb-3">
            ✨ Maklumat Berjaya Diekstrak!
          </h3>
          <div className="space-y-1 text-sm text-slate-700">
            <p><span className="font-semibold">Syarikat:</span> {extractedData.companyName || '-'}</p>
            <p><span className="font-semibold">CIDB:</span> {extractedData.cidbNumber || '-'}</p>
            <p><span className="font-semibold">Gred:</span> {extractedData.grade || '-'}</p>
            {extractedData.phoneNumbers.length > 0 && (
              <p><span className="font-semibold">No. Telefon:</span> {extractedData.phoneNumbers.join(', ')}</p>
            )}
          </div>
          <div className="flex justify-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => notifyData(extractedData)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-400/30 transition"
            >
              Gunakan Data Ini
            </button>
            <button
              type="button"
              onClick={() => { clearExtraction(); setShowResult(false); }}
              className="bg-white border-2 border-slate-300 text-slate-700 font-bold px-6 py-2.5 rounded-xl hover:bg-slate-50 transition"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
