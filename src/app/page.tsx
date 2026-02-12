'use client';

import { useEffect, useMemo, useState } from 'react';

import type { AnalysisResult, DiscourseLabel, Sentence } from '@/lib/pipeline/client';
import { LABEL_COLORS } from '@/lib/ui/labels';

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'analyzing'; message?: string }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

const LS_KEY = 'discourse_pipeline_last_result_v1';

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function classNames(...xs: Array<string | undefined | false>) {
  return xs.filter(Boolean).join(' ');
}

function LabelPill({ label }: { label: DiscourseLabel }) {
  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        LABEL_COLORS[label]
      )}
    >
      {label}
    </span>
  );
}

export default function Home() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [processingWindows, setProcessingWindows] = useState<Array<{ start: number; end: number }>>(
    []
  );

  useEffect(() => {
    try {
      const cached = localStorage.getItem(LS_KEY);
      if (!cached) return;
      const parsed = JSON.parse(cached) as AnalysisResult;
      setResult(parsed);
      setStatus({ kind: 'done' });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!result) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(result));
    } catch {
      // ignore
    }
  }, [result]);

  async function onAnalyze() {
    if (!file) return;
    setStatus({ kind: 'uploading' });

    try {
      const form = new FormData();
      form.append('file', file);
      setStatus({ kind: 'analyzing', message: 'Starting…' });

      const res = await fetch('/api/analyze/stream', {
        method: 'POST',
        body: form,
        headers: {
          Accept: 'text/event-stream',
        },
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `Request failed with status ${res.status}`);
      }

      // Reset result while streaming
      setResult(null);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const currentEvent: string | null = null;

      // partial state
      let original_latex = '';
      let preprocessed_latex = '';
      let sentences: AnalysisResult['sentences'] = [];
      let labels: AnalysisResult['labels'] = {};
      let sections: AnalysisResult['sections'] | null = null;
      let sections_concatenated_text = '';
      let document_title = '';
      let filename = '';

      const applyPartialResult = () => {
        if (sentences.length === 0) return;
        if (!sections) return;
        setResult({
          document_title,
          filename,
          original_latex,
          preprocessed_latex,
          sentences,
          labels,
          sections,
          sections_concatenated_text,
        });
      };

      const handleEvent = (event: string, dataStr: string) => {
        let data: unknown;
        try {
          data = JSON.parse(dataStr) as unknown;
        } catch {
          data = dataStr;
        }

        const dataObj = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null;

        if (event === 'init') {
          document_title = (dataObj?.document_title as string | undefined) ?? '';
          filename = (dataObj?.filename as string | undefined) ?? '';
          original_latex = (dataObj?.original_latex as string | undefined) ?? '';
          preprocessed_latex = (dataObj?.preprocessed_latex as string | undefined) ?? '';
          sentences = (dataObj?.sentences as AnalysisResult['sentences'] | undefined) ?? [];
          labels = {};
          sections = null;
          sections_concatenated_text = '';
          setProcessingWindows([]);
          setStatus({ kind: 'analyzing', message: `Segmented ${sentences.length} sentences…` });
          setResult({
            document_title,
            filename,
            original_latex,
            preprocessed_latex,
            sentences,
            labels,
            sections: {
              problem_and_motivation: { central_problems: [], origins: [], nontriviality: [] },
              landscape: { known_results: [], limitations: [], competing_approaches: [] },
              contributions: { contributions: [] },
              technical_core: { key_ideas: [], technical_obstacles: [], reusable_constructions: [] },
              consequences: { open_questions: [], speculative_extensions: [] },
            },
            sections_concatenated_text: '',
          });
        }

        if (event === 'pass1_window_start') {
          const start = (dataObj?.start as number | undefined) ?? 0;
          const end = (dataObj?.end as number | undefined) ?? 0;
          setProcessingWindows((prev) => {
            if (prev.some((w) => w.start === start && w.end === end)) return prev;
            return [...prev, { start, end }];
          });
        }

        if (event === 'pass1_window') {
          const start = (dataObj?.start as number | undefined) ?? 0;
          const end = (dataObj?.end as number | undefined) ?? 0;
          setProcessingWindows((prev) =>
            prev.filter((w) => !(w.start === start && w.end === end))
          );
        }

        if (event === 'labels_delta') {
          const delta = (dataObj?.delta as AnalysisResult['labels'] | undefined) ?? {};
          labels = { ...labels, ...delta };
          setResult((prev) => {
            if (!prev) return prev;
            return { ...prev, labels };
          });
          setStatus({ kind: 'analyzing', message: `Classifying… (${Object.keys(labels).length} labeled)` });
        }

        if (event === 'pass1_done') {
          setProcessingWindows([]);
          setStatus({ kind: 'analyzing', message: `Pass 1 done. Building canonical sections…` });
        }

        if (event === 'sections') {
          sections = dataObj?.sections as AnalysisResult['sections'];
          sections_concatenated_text = (dataObj?.sections_concatenated_text as string | undefined) ?? '';
          applyPartialResult();
        }

        if (event === 'done') {
          setProcessingWindows([]);
          setResult(data as AnalysisResult);
          setStatus({ kind: 'done' });
        }

        if (event === 'error') {
          const err = (dataObj?.error as string | undefined) ?? 'Unknown error';
          throw new Error(err);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE frames separated by blank line
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const lines = frame.split('\n');

          let eventName: string | null = currentEvent;
          const dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.slice('event:'.length).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice('data:'.length).trim());
            }
          }

          if (eventName && dataLines.length > 0) {
            handleEvent(eventName, dataLines.join('\n'));
          }
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setStatus({ kind: 'error', message: msg });
    }
  }

  const documentTitle = useMemo(() => {
    if (result?.document_title?.trim()) return result.document_title.trim();
    if (result?.filename?.trim()) return result.filename.trim();
    if (file?.name) return file.name;
    return 'Untitled document';
  }, [result, file]);

  const isSentenceProcessing = (position: number) =>
    processingWindows.some((w) => position >= w.start && position < w.end);

  const renderedOriginalText = useMemo(() => {
    if (!result) return null;
    const text = result.original_latex;
    if (!text) return [{ text, sentence: null as Sentence | null }];
    const segments: Array<{ text: string; sentence: Sentence | null }> = [];
    let cursor = 0;
    for (const s of result.sentences) {
      const start = s.original_start;
      const end = s.original_end;
      if (start == null || end == null) continue;
      if (start < cursor || end <= start || end > text.length) continue;
      if (start > cursor) {
        segments.push({ text: text.slice(cursor, start), sentence: null });
      }
      segments.push({ text: text.slice(start, end), sentence: s });
      cursor = end;
    }
    if (cursor < text.length) {
      segments.push({ text: text.slice(cursor), sentence: null });
    }
    return segments;
  }, [result]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">LLM-Based Scientific Discourse Structuring</h1>
            <p className="text-sm text-zinc-500">
              Upload a .tex paper → label sentences (Pass 1) → build canonical sections (Pass 2).
            </p>
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <button
                className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-zinc-50"
                onClick={() => downloadJson(result, 'discourse-analysis.json')}
              >
                Download JSON
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-12 gap-6 px-6 py-6">
        <section className="col-span-12 rounded-lg border bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".tex"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={!file || status.kind === 'uploading' || status.kind === 'analyzing'}
                onClick={onAnalyze}
              >
                Analyze
              </button>
            </div>

            <div className="text-sm text-zinc-600">
              {status.kind === 'idle' && 'Ready.'}
              {status.kind === 'uploading' && 'Uploading…'}
              {status.kind === 'analyzing' && (status.message ?? 'Running Pass 1 + Pass 2…')}
              {status.kind === 'done' && result && (
                <span>
                  Done. {result.sentences.length} sentences.
                </span>
              )}
              {status.kind === 'error' && (
                <span className="text-red-700">Error: {status.message}</span>
              )}
            </div>
          </div>

          <div className="mt-4 text-sm text-zinc-600">Upload a .tex file to begin analysis.</div>
        </section>

        <section className="col-span-12 flex flex-col gap-4">
          <div className="rounded-lg border bg-white">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">{documentTitle}</h2>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              {!result && <div className="p-4 text-sm text-zinc-500">Upload a .tex file to begin.</div>}
              {result && (
                <div className="p-4 text-sm leading-7 whitespace-pre-wrap">
                  {renderedOriginalText?.map((seg, idx) => {
                    if (!seg.sentence) {
                      return <span key={`plain-${idx}`}>{seg.text}</span>;
                    }
                    const labels = result.labels[String(seg.sentence.id)] ?? [];
                    const isProcessing = isSentenceProcessing(seg.sentence.position);
                    return (
                      <span
                        key={`s-${seg.sentence.id}-${idx}`}
                        className={classNames('rounded-sm', isProcessing && 'bg-amber-50')}
                      >
                        {seg.text}
                        {labels.length > 0 && (
                          <span className="ml-1 inline-flex gap-1 align-middle">
                            {labels.map((l) => (
                              <LabelPill key={l} label={l} />
                            ))}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-white">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Canonical sections (Pass 2)</h2>
              <p className="text-xs text-zinc-500">
                JSON is grounded with sentence IDs. Below is a readable concatenated view.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 p-4">
              {!result && <div className="text-sm text-zinc-500">No data.</div>}
              {result && (
                <>
                  <div>
                    <div className="text-xs font-semibold text-zinc-600 mb-2">Concatenated output</div>
                    <pre className="whitespace-pre-wrap rounded-md border bg-zinc-50 p-3 text-xs leading-5 overflow-auto max-h-[22vh]">
                      {result.sections_concatenated_text}
                    </pre>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-zinc-600 mb-2">Raw JSON</div>
                    <pre className="whitespace-pre-wrap rounded-md border bg-zinc-50 p-3 text-xs leading-5 overflow-auto max-h-[30vh]">
                      {JSON.stringify(result.sections, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-10 text-xs text-zinc-500">
        <p>
          Server-only OpenAI calls. Strict JSON schemas + retries. Pass 1 is union aggregation across sliding windows.
        </p>
      </footer>
    </div>
  );
}
