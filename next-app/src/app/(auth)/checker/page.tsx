'use client';

import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import PdfUpload from '@/components/checker/PdfUpload';
import CheckerForm from '@/components/checker/CheckerForm';
import type { ExtractedPdfData } from '@/hooks/usePdfExtraction';

export default function CheckerPage() {
  const { user } = useAuth();
  const formRef = useRef<HTMLDivElement>(null);
  const [extractedData, setExtractedData] = useState<ExtractedPdfData | null>(null);

  const handleDataExtracted = useCallback((data: ExtractedPdfData) => {
    setExtractedData(data);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSyncToDb = useCallback(() => {
    window.location.href = '/database';
  }, []);

  return (
    <ProtectedRoute>
      <div className="min-h-full bg-gradient-to-br from-blue-600 via-blue-400 to-blue-900">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
            <div>
              <p className="text-white/60 text-xs">Selamat Datang</p>
              <h1 className="text-white font-bold text-lg">{user?.name}</h1>
              <p className="text-white/50 text-xs">{user?.role} — {user?.email}</p>
            </div>
          </div>

          {/* PDF Upload */}
          {user?.email && (
            <PdfUpload
              userEmail={user.email}
              onDataExtracted={handleDataExtracted}
            />
          )}

          {/* Form */}
          <div ref={formRef}>
            <CheckerForm
              extractedData={extractedData}
              onSyncToDb={handleSyncToDb}
            />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
