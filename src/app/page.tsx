'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { UploadCard } from '@/components/UploadCard';
import { useAnalysis } from '@/components/AnalysisContext';
import { AppLogo } from '@/components/AppLogo';

export default function Home() {
  const router = useRouter();
  const {
    file,
    setFile,
    status,
    processingWindows,
    onAnalyze,
  } = useAnalysis();

  // Auto-run analysis after file selection. We wait for React state to apply
  // before calling onAnalyze (which reads the latest `file` from context).
  useEffect(() => {
    if (!file) return;
    if (status.kind === 'uploading' || status.kind === 'analyzing') return;
    void onAnalyze();
    router.push('/analysis');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="absolute left-6 top-6">
        <AppLogo />
      </header>
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-12">
        <div className="sr-only">FourFold</div>
        <p className="mt-3 max-w-xl text-center text-base text-zinc-600">
          Turn your paper into 4 audience-specific summaries.
        </p>

        <div className="mt-10 w-full max-w-2xl">
          <UploadCard
            file={file}
            status={status}
            processingWindows={processingWindows}
            onFileChange={setFile}
            hideDone
          />
        </div>
      </main>
    </div>
  );
}
