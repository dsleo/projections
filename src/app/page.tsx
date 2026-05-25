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
    <div className="min-h-screen text-[color:var(--ink)]">
      <main className="min-h-screen">
        <section className="bg-[color:var(--ink)] text-[color:var(--accent)]">
          <div className="mx-auto grid min-h-[72vh] w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 py-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.65fr)]">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                LaTeX in. Summaries out.
              </div>
              <h1
                className="mt-5 text-6xl font-semibold leading-[0.95] text-[color:var(--accent)] sm:text-7xl"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                Projections
              </h1>
              <p className="mt-6 max-w-xl text-2xl leading-9 text-[#ffe784]">
                Upload a paper. Get grounded reader views.
              </p>
            </div>

            <div className="border-l-4 border-[color:var(--accent)] bg-[color:var(--accent)] p-6 text-[color:var(--ink)] shadow-2xl shadow-black/30">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                Start here
              </div>
              <div
                className="mt-2 text-2xl font-semibold text-[color:var(--ink)]"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                Upload LaTeX
              </div>
              <div className="mt-5">
                <UploadCard
                  file={file}
                  status={status}
                  processingWindows={processingWindows}
                  onFileChange={setFile}
                  hideDone
                />
              </div>
              {result?.audience_views && (
                <div className="mt-5">
                  <Link
                    href="/analysis/audience"
                    className="inline-flex items-center border border-[color:var(--ink)] bg-[color:var(--ink)] px-4 py-2 text-sm text-[color:var(--accent)] hover:bg-[color:var(--forest-deep)]"
                  >
                    View summaries
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-10">
          <div className="grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3">
            {[
              {
                title: 'Four reader views',
                body: 'Expert, adjacent, student, and author notes.',
              },
              {
                title: 'Sentence-backed',
                body: 'Every claim points back to source text.',
              },
              {
                title: 'Reading paths',
                body: 'Read, skim, or skip with intent.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="border-t-4 border-[color:var(--ink)] bg-[color:var(--accent)] p-5"
              >
                <div className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  {item.title}
                </div>
                <div className="mt-2 text-sm text-[color:var(--ink)]">{item.body}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
