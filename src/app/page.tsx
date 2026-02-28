'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { UploadCard } from '@/components/UploadCard';
import { useAnalysis } from '@/components/AnalysisContext';

export default function Home() {
  const router = useRouter();
  const {
    file,
    setFile,
    status,
    result,
    processingWindows,
    onAnalyze,
  } = useAnalysis();

  // Auto-run analysis after file selection. We wait for React state to apply
  // before calling onAnalyze (which reads the latest `file` from context).
  useEffect(() => {
    if (!file) return;
    // Avoid starting a second analysis if one is already in flight or already done.
    if (status.kind === 'uploading' || status.kind === 'analyzing' || status.kind === 'done') {
      return;
    }
    router.push('/analysis/audience');
    void onAnalyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  return (
    <div className="min-h-screen text-zinc-900">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-6 py-12">
        <div className="w-full rounded-3xl border border-[color:var(--border)] bg-white/70 p-10 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <div className="text-5xl font-semibold tracking-tight text-[color:var(--ink)]" style={{ fontFamily: 'var(--font-serif)' }}>
              FourFold
            </div>
            <p className="mt-3 max-w-2xl text-base text-[color:var(--muted)]">
              Audience‑ready scientific summaries grounded in your paper. Build trust with traceable
              evidence and reading paths tailored to different researchers.
            </p>

            <div className="mt-8 w-full max-w-2xl">
              <UploadCard
                file={file}
                status={status}
                processingWindows={processingWindows}
                onFileChange={setFile}
                hideDone
              />
            </div>
            {result?.audience_views && (
              <div className="mt-4">
                <Link
                  href="/analysis/audience?show=1"
                  className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm text-[color:var(--ink)] hover:bg-[color:var(--accent-soft)]"
                >
                  Back to summaries
                </Link>
              </div>
            )}

            <div className="mt-10 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3">
              {[
                {
                  title: 'Summaries for real audiences',
                  body: 'Domain experts, adjacent researchers, grad students, and your future self.',
                },
                {
                  title: 'Grounded in your text',
                  body: 'Every statement links back to the source sentences that support it.',
                },
                {
                  title: 'Reading paths included',
                  body: 'Recommendations on what to read, skim, or skip to save time.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--paper)] p-4"
                >
                  <div className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    {item.title}
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--ink)]">{item.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
