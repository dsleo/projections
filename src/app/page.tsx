'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { UploadCard } from '@/components/UploadCard';
import { useAnalysis } from '@/components/AnalysisContext';

export default function Home() {
  const router = useRouter();
  const {
    file,
    setFile,
    status,
    processingWindows,
    onAnalyze,
    result,
  } = useAnalysis();

  const handleAnalyze = () => {
    void onAnalyze();
    router.push('/analysis');
  };

  const hasResult = !!result;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <div>
            <h1 className="text-xl font-semibold">LLM-Based Scientific Discourse Structuring</h1>
          </div>
          <div className="flex items-center gap-2">
            {hasResult && (
              <Link
                className="text-sm text-zinc-600 hover:text-zinc-900"
                href="/analysis"
              >
                View last analysis
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <UploadCard
            file={file}
            status={status}
            processingWindows={processingWindows}
            onFileChange={setFile}
            onAnalyze={handleAnalyze}
            hideDone
          />
        </div>
      </main>
    </div>
  );
}
