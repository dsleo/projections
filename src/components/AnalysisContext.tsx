'use client';

import { createContext, useContext, useMemo, useState } from 'react';

import { useAnalyzeStream, type AnalyzeStatus } from '@/lib/ui/useAnalyzeStream';
import type { AnalysisResult } from '@/lib/pipeline/client';

type AnalysisContextValue = {
  file: File | null;
  setFile: (file: File | null) => void;
  useEnvPropagation: boolean;
  setUseEnvPropagation: (next: boolean) => void;
  status: AnalyzeStatus;
  setStatus: (next: AnalyzeStatus) => void;
  result: AnalysisResult | null;
  setResult: (next: AnalysisResult | null) => void;
  processingWindows: Array<{ start: number; end: number }>;
  setProcessingWindows: (
    next: Array<{ start: number; end: number }> | ((prev: Array<{ start: number; end: number }>) => Array<{ start: number; end: number }>)
  ) => void;
  onAnalyze: () => Promise<void>;
};

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [file, setFile] = useState<File | null>(null);
  const [useEnvPropagation, setUseEnvPropagation] = useState(false);
  const analysis = useAnalyzeStream({ file, useEnvPropagation });

  const value = useMemo(
    () => ({
      file,
      setFile,
      useEnvPropagation,
      setUseEnvPropagation,
      status: analysis.status,
      setStatus: analysis.setStatus,
      result: analysis.result,
      setResult: analysis.setResult,
      processingWindows: analysis.processingWindows,
      setProcessingWindows: analysis.setProcessingWindows,
      onAnalyze: analysis.onAnalyze,
    }),
    [
      file,
      useEnvPropagation,
      analysis.status,
      analysis.setStatus,
      analysis.result,
      analysis.setResult,
      analysis.processingWindows,
      analysis.setProcessingWindows,
      analysis.onAnalyze,
    ]
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) {
    throw new Error('useAnalysis must be used within AnalysisProvider');
  }
  return ctx;
}
