'use client';

import { useState, useCallback } from 'react';
import { gasPost } from '@/lib/gas';

export interface ExtractedPdfData {
  companyName: string;
  cidbNumber: string;
  grade: string;
  spkkStartDate: string;
  spkkEndDate: string;
  stbStartDate: string;
  stbEndDate: string;
  directors: string[];
  shareholders: string[];
  spkkPersons: string[];
  chequeSignatories: string[];
  phoneNumbers: string[];
  alamatPerniagaan: string;
  alamatSuratMenyurat: string;
  applicantName?: string;
  jawatan?: string;
  icNumber?: string;
  phoneNumber?: string;
  email?: string;
  tarikhDaftar?: string;
}

export function usePdfExtraction(userEmail: string) {
  const [extractedData, setExtractedData] = useState<ExtractedPdfData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const extractPdfText = useCallback(async (file: File): Promise<string> => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const maxPages = Math.min(pdf.numPages, 4);
    let fullText = '';

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items
        .filter((item: Record<string, unknown>) => typeof item.str === 'string')
        .map((item: Record<string, unknown>) => item.str as string)
        .join(' ') + '\n';
      setProgress(Math.round((i / maxPages) * 40));
    }

    return fullText;
  }, []);

  const processWithAI = useCallback(async (pdfText: string, model = 'auto') => {
    setProcessing(true);
    setError(null);
    setProgress(50);

    try {
      const result = await gasPost<{ success: boolean; data?: ExtractedPdfData; error?: string }>({
        action: 'processAI',
        type: 'borang',
        text: pdfText,
        model,
        email: userEmail,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Gagal mengekstrak data');
      }

      setExtractedData(result.data);
      setProgress(100);
      return result.data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ralat pemprosesan AI';
      setError(msg);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [userEmail]);

  const clearExtraction = useCallback(() => {
    setExtractedData(null);
    setProgress(0);
    setError(null);
  }, []);

  return {
    extractedData,
    processing,
    progress,
    error,
    extractPdfText,
    processWithAI,
    clearExtraction,
  };
}
