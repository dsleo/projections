'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { AnalysisResult, DiscourseLabel, Sentence } from '@/lib/pipeline/client';
import { propagateLabelsByEnvironment } from '@/lib/pipeline/env_propagation';
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

function formatIdRanges(ids: number[]): string {
  if (!ids || ids.length === 0) return '[]';
  const sorted = Array.from(new Set(ids)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = cur;
    prev = cur;
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return `[${ranges.join(', ')}]`;
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

function MathText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.textContent = text;
    let cancelled = false;
    import('katex/contrib/auto-render').then(({ default: renderMathInElement }) => {
      if (cancelled || !ref.current) return;
      renderMathInElement(ref.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [text]);

  return <div ref={ref} className={className} />;
}

export default function Home() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [useEnvPropagation, setUseEnvPropagation] = useState(false);
  const [processingWindows, setProcessingWindows] = useState<Array<{ start: number; end: number }>>(
    []
  );
  const [activeTab, setActiveTab] = useState<
    'problem' | 'landscape' | 'contrib' | 'tech' | 'cons' | 'cites'
  >('problem');
  const [audienceTab, setAudienceTab] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [highlightedIds, setHighlightedIds] = useState<number[]>([]);
  const [focusedCitationKeys, setFocusedCitationKeys] = useState<string[]>([]);
  const textDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const canonicalDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const [labelFilter, setLabelFilter] = useState<DiscourseLabel[]>([]);
  const [showUnlabeledOnly, setShowUnlabeledOnly] = useState(false);
  const [envPropagationMsg, setEnvPropagationMsg] = useState<string>('');
  const [envPropagationDetails, setEnvPropagationDetails] = useState<string>('');
  const [envPropagationPrev, setEnvPropagationPrev] = useState<AnalysisResult['labels'] | null>(
    null
  );

  useEffect(() => {
    try {
      const cached = localStorage.getItem(LS_KEY);
      if (!cached) return;
      const parsed = JSON.parse(cached) as AnalysisResult;
      setResult({
        ...parsed,
        sentence_citations: parsed.sentence_citations ?? {},
        citations: parsed.citations ?? {},
      });
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
      form.append('use_env_propagation', useEnvPropagation ? '1' : '0');
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
      let sentence_citations: AnalysisResult['sentence_citations'] = {};
      let citations: AnalysisResult['citations'] = {};
      let audience_views: AnalysisResult['audience_views'] = undefined;
      let abstract: AnalysisResult['abstract'] = undefined;
      let document_title = '';
      let filename = '';

      const applyPartialResult = () => {
        if (sentences.length === 0) return;
        if (!sections) return;
        setResult({
          document_title,
          abstract,
          filename,
          original_latex,
          preprocessed_latex,
          sentences,
          labels,
          sentence_citations,
          citations,
          sections,
          sections_concatenated_text,
          audience_views,
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
          sentence_citations = {};
          citations = {};
          audience_views = undefined;
          abstract = (dataObj?.abstract as string | undefined) ?? '';
          setProcessingWindows([]);
          setStatus({ kind: 'analyzing', message: `Segmented ${sentences.length} sentences…` });
          setResult({
            document_title,
            abstract,
            filename,
            original_latex,
            preprocessed_latex,
            sentences,
            labels,
            sentence_citations,
            citations,
            sections: {
              problem_and_motivation: { central_problems: [], origins: [], nontriviality: [] },
              landscape: { known_results: [], limitations: [], competing_approaches: [] },
              contributions: { contributions: [] },
              technical_core: { key_ideas: [], technical_obstacles: [], reusable_constructions: [] },
              consequences: { open_questions: [], speculative_extensions: [] },
            },
            sections_concatenated_text: '',
            audience_views: undefined,
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
          sentence_citations =
            (dataObj?.sentence_citations as AnalysisResult['sentence_citations'] | undefined) ?? {};
          citations = (dataObj?.citations as AnalysisResult['citations'] | undefined) ?? {};
          audience_views =
            (dataObj?.audience_views as AnalysisResult['audience_views'] | undefined) ?? undefined;
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

  async function rerunPass2Only() {
    if (!result) return;
    setStatus({ kind: 'analyzing', message: 'Re-running Pass 2…' });
    try {
      const res = await fetch('/api/analyze/pass2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_latex: result.original_latex,
          sentences: result.sentences,
          labels: result.labels,
          document_title: result.document_title,
          abstract: (result as { abstract?: string }).abstract,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `Request failed with status ${res.status}`);
      }
      const data = (await res.json()) as Partial<AnalysisResult>;
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: data.sections ?? prev.sections,
          sections_concatenated_text:
            data.sections_concatenated_text ?? prev.sections_concatenated_text,
        };
      });
      setStatus({ kind: 'done' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setStatus({ kind: 'error', message: msg });
    }
  }

  async function rerunPass3Only() {
    if (!result) return;
    setStatus({ kind: 'analyzing', message: 'Re-running Pass 3…' });
    try {
      const res = await fetch('/api/analyze/pass3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_latex: result.original_latex,
          sentences: result.sentences,
          labels: result.labels,
          sections: result.sections,
          document_title: result.document_title,
          abstract: (result as { abstract?: string }).abstract,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `Request failed with status ${res.status}`);
      }
      const data = (await res.json()) as Partial<AnalysisResult>;
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          audience_views: data.audience_views ?? prev.audience_views,
          sentence_citations: data.sentence_citations ?? prev.sentence_citations,
          citations: data.citations ?? prev.citations,
        };
      });
      setStatus({ kind: 'done' });
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

  const unlabeledCount = useMemo(() => {
    if (!result) return 0;
    let count = 0;
    for (const s of result.sentences) {
      const labels = result.labels[String(s.id)] ?? [];
      if (labels.length === 0) count += 1;
    }
    return count;
  }, [result]);

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

  const labelCounts = useMemo(() => {
    if (!result) return {};
    const counts: Record<DiscourseLabel, number> = {
      Problem: 0,
      Landscape: 0,
      Contribution: 0,
      TechnicalCore: 0,
      Consequences: 0,
    };
    for (const s of result.sentences) {
      const labels = result.labels[String(s.id)] ?? [];
      for (const l of labels) counts[l] += 1;
    }
    return counts;
  }, [result]);

  const toggleLabelFilter = (label: DiscourseLabel) => {
    setLabelFilter((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const getCitationEntries = (keys: string[]) => {
    if (!result) return [];
    if (!result.citations) return [];
    return keys.map((k) => result.citations?.[k]).filter(Boolean);
  };

  const formatCitationLabel = (entry: AnalysisResult['citations'][string]) => {
    if (entry.label?.trim()) return entry.label.trim();
    if (entry.text) {
      const year = entry.text.match(/\b(19|20)\d{2}\b/)?.[0];
      const author = entry.text.split(',')[0]?.trim();
      if (author && year) return `${author} ${year}`;
      if (author) return author;
    }
    return entry.key;
  };

  const formatCitationLabelFromKey = (key: string) => {
    const entry =
      result?.citations?.[key] ?? ({ key, text: '', labels: [], sentence_ids: [] } as const);
    return formatCitationLabel(entry);
  };

  const renderCitationActionForKeys = (keys: string[]) => {
    if (!keys || keys.length === 0) return null;
    return (
      <button
        className="rounded-full border px-2 py-0.5 text-[10px] hover:bg-white"
        type="button"
        onClick={() => {
          setFocusedCitationKeys(keys);
          setActiveTab('cites');
          if (canonicalDetailsRef.current) {
            canonicalDetailsRef.current.open = true;
            canonicalDetailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
      >
        View citations
      </button>
    );
  };

  const getCitationsForSentenceIds = (ids: number[]) => {
    if (!result || !result.sentence_citations) return [];
    const keySet = new Set<string>();
    for (const id of ids) {
      const keys = result.sentence_citations?.[String(id)] ?? [];
      for (const key of keys) keySet.add(key);
    }
    return getCitationEntries(Array.from(keySet));
  };

  const renderCitationAction = (ids: number[]) => {
    const entries = getCitationsForSentenceIds(ids);
    if (entries.length === 0) return null;
    return (
      <button
        className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-white"
        onClick={() => {
          setFocusedCitationKeys(entries.map((e) => e.key));
          setActiveTab('cites');
        }}
        type="button"
      >
        View citations
      </button>
    );
  };

  const renderEmpty = (label: string) => (
    <div className="text-xs text-zinc-500">{label}</div>
  );

  const renderGroundedList = (
    items: Array<{ text: string; sentence_ids?: number[] }>
  ) => (
    <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
      {items.map((item, idx) => (
        <li key={`grounded-${idx}`} className="mb-2">
          <MathText text={item.text} />
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {item.sentence_ids && item.sentence_ids.length > 0 && (
              <button
                className="rounded-full border px-2 py-0.5 text-[10px] hover:bg-white"
                type="button"
                onClick={() => focusSentences(item.sentence_ids)}
              >
                View sentences
              </button>
            )}
            {renderCitationActionForKeys(
              item.sentence_ids ? getCitationsForSentenceIds(item.sentence_ids).map((e) => e.key) : []
            )}
          </div>
        </li>
      ))}
    </ul>
  );

  const collectSentenceIds = (items: Array<{ sentence_ids?: number[] }>) =>
    Array.from(new Set(items.flatMap((item) => item.sentence_ids ?? [])));

  const collectAudienceSentenceIds = () => {
    if (!result?.audience_views) return [];
    const ids = new Set<number>();
    const add = (arr?: Array<{ sentence_ids?: number[] }>) => {
      if (!arr) return;
      for (const item of arr) {
        for (const id of item.sentence_ids ?? []) ids.add(id);
      }
    };
    const addOne = (item?: { sentence_ids?: number[] }) => {
      if (!item) return;
      for (const id of item.sentence_ids ?? []) ids.add(id);
    };
    const v = result.audience_views;
    if (audienceTab === 'A') {
      addOne(v.domain_expert.problem_statement);
      add(v.domain_expert.delta_summary);
      add(v.domain_expert.technical_highlights.nonstandard_ideas);
      add(v.domain_expert.technical_highlights.clever_reductions);
      add(v.domain_expert.reusable_components);
    } else if (audienceTab === 'B') {
      addOne(v.adjacent_researcher.problem_statement);
      add(v.adjacent_researcher.why_matters);
    } else if (audienceTab === 'C') {
      addOne(v.grad_student.problem_statement);
      add(v.grad_student.key_ideas);
    } else if (audienceTab === 'D') {
      addOne(v.author_self.problem_statement);
      add(v.author_self.fragile_arguments);
      add(v.author_self.robust_arguments);
    }
    return Array.from(ids).sort((a, b) => a - b);
  };

  const renderAudienceFullText = () => {
    if (!result) return null;
    const ids = collectAudienceSentenceIds();
    const byId = new Map(result.sentences.map((s) => [s.id, s.text]));
    const abstract = result.abstract?.trim();
    return (
      <div className="mt-3 rounded-md border bg-zinc-50 p-3 text-sm leading-6 whitespace-pre-wrap">
        {abstract ? (
          <>
            <span className="font-semibold">Abstract</span>
            {'\n'}
            {abstract}
            {'\n\n'}
          </>
        ) : null}
        {ids.length === 0 ? (
          <div className="text-xs text-zinc-500">No supporting sentences found.</div>
        ) : (
          ids.map((id, idx) => (
            <span key={`aud-text-${id}-${idx}`}>
              {byId.get(id) ?? ''}
              {idx < ids.length - 1 ? '\n' : ''}
            </span>
          ))
        )}
      </div>
    );
  };

  const focusSentences = (ids: number[]) => {
    if (!ids || ids.length === 0) return;
    setHighlightedIds(ids);
    const details = textDetailsRef.current;
    if (details) details.open = true;
    const target = document.getElementById(`sentence-${ids[0]}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

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
        <section className="col-span-12 rounded-lg border bg-white p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Upload a LaTeX paper</h2>
              <p className="text-xs text-zinc-500">
                We analyze .tex sources only. Title + abstract are used as context for Pass 2.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer rounded-md border border-dashed bg-zinc-50 px-3 py-2 text-xs text-zinc-600 hover:bg-white">
                <input
                  type="file"
                  accept=".tex"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file ? file.name : 'Choose .tex file'}
              </label>
              <button
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={!file || status.kind === 'uploading' || status.kind === 'analyzing'}
                onClick={onAnalyze}
              >
                Run analysis
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
            <span className="rounded-full border px-2 py-1">
              {status.kind === 'idle' && 'Idle'}
              {status.kind === 'uploading' && 'Uploading'}
              {status.kind === 'analyzing' && 'Processing'}
              {status.kind === 'done' && 'Complete'}
              {status.kind === 'error' && 'Error'}
            </span>
            <span>
              {status.kind === 'idle' && 'Ready to analyze.'}
              {status.kind === 'uploading' && 'Uploading the file…'}
              {status.kind === 'analyzing' && (status.message ?? 'Running Pass 1 + Pass 2…')}
              {status.kind === 'done' && result && `Done. ${result.sentences.length} sentences.`}
              {status.kind === 'error' && (
                <span className="text-red-700">Error: {status.message}</span>
              )}
            </span>
            {status.kind === 'analyzing' && processingWindows.length > 0 && (
              <span className="text-zinc-500">{processingWindows.length} windows in flight</span>
            )}
          </div>
        </section>

        <section className="col-span-12 flex flex-col gap-4">
          <details ref={textDetailsRef} className="rounded-lg border bg-white" open>
            <summary className="cursor-pointer border-b px-4 py-3 text-sm font-semibold">
              {documentTitle}
            </summary>
            <div className="border-b px-4 py-2 text-xs text-zinc-600 flex flex-wrap items-center gap-2">
              <button
                className={classNames(
                  'rounded-full border px-2 py-0.5 text-xs',
                  showUnlabeledOnly
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                )}
                onClick={() => {
                  setShowUnlabeledOnly((prev) => !prev);
                  if (!showUnlabeledOnly) setLabelFilter([]);
                }}
                type="button"
              >
                Unlabeled · {unlabeledCount}
              </button>
              <label className="flex items-center gap-2 text-xs text-zinc-600 ml-1">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={useEnvPropagation}
                  onChange={(e) => setUseEnvPropagation(e.target.checked)}
                />
                Propagate labels in environments
              </label>
              <button
                className="rounded-full border px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                type="button"
                disabled={!result}
                onClick={() => {
                  if (!result) return;
                  if (envPropagationPrev) {
                    setResult({ ...result, labels: envPropagationPrev });
                    setEnvPropagationPrev(null);
                    setEnvPropagationMsg('Reverted propagation');
                    setTimeout(() => setEnvPropagationMsg(''), 2000);
                    return;
                  }
                  const before = Object.keys(result.labels ?? {}).length;
                  const updated = propagateLabelsByEnvironment(
                    result.original_latex,
                    result.sentences,
                    result.labels
                  );
                  const after = Object.keys(updated ?? {}).length;
                  setEnvPropagationPrev(result.labels);
                  let addedTags = 0;
                  let changedSentences = 0;
                  const allIds = new Set([
                    ...Object.keys(result.labels ?? {}),
                    ...Object.keys(updated ?? {}),
                  ]);
                  for (const sid of allIds) {
                    const beforeLabels = result.labels?.[sid] ?? [];
                    const afterLabels = updated?.[sid] ?? [];
                    const beforeSet = new Set(beforeLabels);
                    const added = afterLabels.filter((l) => !beforeSet.has(l)).length;
                    if (added > 0) {
                      addedTags += added;
                      changedSentences += 1;
                    }
                  }
                  setResult({ ...result, labels: updated });
                  setEnvPropagationMsg(`Applied: labeled sentences ${before} → ${after}`);
                  setEnvPropagationDetails(
                    `New labels added: ${addedTags} across ${changedSentences} sentences`
                  );
                  setTimeout(() => setEnvPropagationMsg(''), 2000);
                  setTimeout(() => setEnvPropagationDetails(''), 4000);
                }}
              >
                {envPropagationPrev ? 'Revert propagation' : 'Apply to current'}
              </button>
              {envPropagationMsg && (
                <span className="text-xs text-zinc-500">{envPropagationMsg}</span>
              )}
              {envPropagationDetails && (
                <span className="text-xs text-zinc-500">{envPropagationDetails}</span>
              )}
              {result &&
                (Object.keys(labelCounts) as DiscourseLabel[]).map((label) => (
                  <button
                    key={`filter-${label}`}
                    className={classNames(
                      'rounded-full border px-2 py-0.5 text-xs',
                      labelFilter.includes(label)
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : LABEL_COLORS[label]
                    )}
                    onClick={() => toggleLabelFilter(label)}
                    type="button"
                  >
                    {label} · {labelCounts[label]}
                  </button>
                ))}
              {(labelFilter.length > 0 || showUnlabeledOnly) && (
                <button
                  className="rounded-full border px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50"
                  onClick={() => {
                    setLabelFilter([]);
                    setShowUnlabeledOnly(false);
                  }}
                  type="button"
                >
                  Clear filter
                </button>
              )}
            </div>
            <div className="max-h-[70vh] overflow-auto">
              {!result && <div className="p-4 text-sm text-zinc-500">Upload a .tex file to begin.</div>}
              {result && (
                <div className="p-4 text-sm leading-7 whitespace-pre-wrap">
                  {(() => {
                    if (!renderedOriginalText) return null;
                    const rendered: JSX.Element[] = [];
                    let lastRenderedSentenceId: number | null = null;
                    renderedOriginalText.forEach((seg, idx) => {
                      if (!seg.sentence) {
                        if (labelFilter.length > 0 || showUnlabeledOnly) return;
                        rendered.push(<span key={`plain-${idx}`}>{seg.text}</span>);
                        return;
                      }
                      const labels = result.labels[String(seg.sentence.id)] ?? [];
                      if (showUnlabeledOnly && labels.length > 0) return;
                      if (labelFilter.length > 0 && !labels.some((l) => labelFilter.includes(l))) {
                        return;
                      }
                      const shouldShowGap =
                        (labelFilter.length > 0 || showUnlabeledOnly) &&
                        lastRenderedSentenceId !== null &&
                        seg.sentence.id !== lastRenderedSentenceId + 1;
                      const isProcessing = isSentenceProcessing(seg.sentence.position);
                      const isHighlighted = highlightedIds.includes(seg.sentence.id);
                      rendered.push(
                        <span key={`wrap-${seg.sentence.id}-${idx}`}>
                          {shouldShowGap && (
                            <span className="my-2 flex items-center gap-2 text-[11px] text-zinc-400">
                              <span className="h-px w-6 bg-zinc-300" />
                              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5">
                                ⋯ gap
                              </span>
                              <span className="h-px w-6 bg-zinc-300" />
                            </span>
                          )}
                          <span
                            id={`sentence-${seg.sentence.id}`}
                            className={classNames(
                              'rounded-sm',
                              isProcessing && 'bg-amber-50',
                              isHighlighted && 'bg-amber-100 ring-1 ring-amber-200'
                            )}
                          >
                            {seg.text}
                            {labels.length > 0 && labelFilter.length === 0 && !showUnlabeledOnly && (
                              <span className="ml-1 inline-flex gap-1 align-middle">
                                {labels.map((l) => (
                                  <LabelPill key={l} label={l} />
                                ))}
                              </span>
                            )}
                          </span>
                        </span>
                      );
                      lastRenderedSentenceId = seg.sentence.id;
                    });
                    return rendered;
                  })()}
                </div>
              )}
            </div>
          </details>

          <details ref={canonicalDetailsRef} className="rounded-lg border bg-white" open>
            <summary className="flex cursor-pointer items-center justify-between border-b px-4 py-3 text-sm font-semibold">
              <span>Canonical sections (Pass 2)</span>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border px-2 py-0.5 text-xs font-normal text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    rerunPass2Only();
                  }}
                  disabled={!result || status.kind === 'analyzing' || status.kind === 'uploading'}
                >
                  Re-run Pass 2
                </button>
                <button
                  className="rounded-full border px-2 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-100"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!result?.sections) return;
                    navigator.clipboard.writeText(JSON.stringify(result.sections, null, 2));
                  }}
                  aria-label="Copy canonical JSON"
                  title="Copy canonical JSON"
                >
                  ⧉
                </button>
              </div>
            </summary>

            <div className="grid grid-cols-1 gap-4 p-4">
              {!result && <div className="text-sm text-zinc-500">No data.</div>}
              {result && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'problem', label: 'Problem & Motivation' },
                      { id: 'landscape', label: 'Landscape' },
                      { id: 'contrib', label: 'Contributions' },
                      { id: 'tech', label: 'Technical Core' },
                      { id: 'cons', label: 'Consequences' },
                      { id: 'cites', label: 'Citations' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        className={classNames(
                          'rounded-full border px-3 py-1 text-xs',
                          activeTab === tab.id
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                        )}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        type="button"
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-md border bg-white p-3 max-h-[38vh] overflow-auto">
                    {activeTab === 'problem' && (
                      <>
                        {result.sections.problem_and_motivation.central_problems.length === 0 &&
                          result.sections.problem_and_motivation.origins.length === 0 &&
                          result.sections.problem_and_motivation.nontriviality.length === 0 &&
                          renderEmpty('No explicit items found.')}
                        {result.sections.problem_and_motivation.central_problems.length > 0 && (
                          <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                              Central problem
                            </div>
                            <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                              {result.sections.problem_and_motivation.central_problems.map(
                                (item, idx) => (
                                  <li key={`pm-cp-${idx}`} className="mb-2">
                                    <MathText text={item.description} />
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                    <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                                    <button
                                      className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-white"
                                      onClick={() => focusSentences(item.sentence_ids)}
                                      type="button"
                                    >
                                      View sentences
                                    </button>
                                    {renderCitationAction(item.sentence_ids)}
                                  </div>
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                        {result.sections.problem_and_motivation.origins.length > 0 && (
                          <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                              Origins
                            </div>
                            <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                              {result.sections.problem_and_motivation.origins.map((item, idx) => (
                                <li key={`pm-or-${idx}`} className="mb-2">
                                  <MathText text={item.description} />
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                    <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                                    <button
                                      className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-white"
                                      onClick={() => focusSentences(item.sentence_ids)}
                                      type="button"
                                    >
                                      View sentences
                                    </button>
                                    {renderCitationAction(item.sentence_ids)}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.sections.problem_and_motivation.nontriviality.length > 0 && (
                          <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                              Nontriviality
                            </div>
                            <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                              {result.sections.problem_and_motivation.nontriviality.map(
                                (item, idx) => (
                                  <li key={`pm-nt-${idx}`} className="mb-2">
                                    <MathText text={item.description} />
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                      <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                                      <button
                                        className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-white"
                                        onClick={() => focusSentences(item.sentence_ids)}
                                        type="button"
                                      >
                                        View sentences
                                      </button>
                                      {renderCitationAction(item.sentence_ids)}
                                    </div>
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                      </>
                    )}

                    {activeTab === 'landscape' && (
                      <>
                        {result.sections.landscape.known_results.length === 0 &&
                          result.sections.landscape.limitations.length === 0 &&
                          result.sections.landscape.competing_approaches.length === 0 &&
                          renderEmpty('No explicit items found.')}
                        {result.sections.landscape.known_results.length > 0 && (
                          <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                              Known results
                            </div>
                            <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                              {result.sections.landscape.known_results.map((item, idx) => (
                                <li key={`land-kr-${idx}`} className="mb-2">
                                  <MathText text={item.description} />
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                    <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                                    <button
                                      className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-white"
                                      onClick={() => focusSentences(item.sentence_ids)}
                                      type="button"
                                    >
                                      View sentences
                                    </button>
                                    {renderCitationAction(item.sentence_ids)}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.sections.landscape.limitations.length > 0 && (
                          <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                              Limitations
                            </div>
                            <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                              {result.sections.landscape.limitations.map((item, idx) => (
                                <li key={`land-lim-${idx}`} className="mb-2">
                                  <MathText text={item.description} />
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                    <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                                    <button
                                      className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-white"
                                      onClick={() => focusSentences(item.sentence_ids)}
                                      type="button"
                                    >
                                      View sentences
                                    </button>
                                    {renderCitationAction(item.sentence_ids)}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.sections.landscape.competing_approaches.length > 0 && (
                          <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                              Competing approaches
                            </div>
                            <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                              {result.sections.landscape.competing_approaches.map((item, idx) => (
                                <li key={`land-ca-${idx}`} className="mb-2">
                                  <MathText text={item.description} />
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                    <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                                    <button
                                      className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-white"
                                      onClick={() => focusSentences(item.sentence_ids)}
                                      type="button"
                                    >
                                      View sentences
                                    </button>
                                    {renderCitationAction(item.sentence_ids)}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}

                    {activeTab === 'contrib' && (
                      <>
                        {result.sections.contributions.contributions.length === 0 &&
                          renderEmpty('No explicit items found.')}
                        {result.sections.contributions.contributions.length > 0 && (
                          <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                              Contributions
                            </div>
                            <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                              {result.sections.contributions.contributions.map((item, idx) => (
                                <li key={`contrib-${idx}`} className="mb-3">
                                  <div className="font-medium">
                                    <MathText text={item.statement} />
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                    <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                                    <button
                                      className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-white"
                                      onClick={() => focusSentences(item.sentence_ids)}
                                      type="button"
                                    >
                                      View sentences
                                    </button>
                                    {renderCitationAction(item.sentence_ids)}
                                  </div>
                                  {(item.prior_state.text ||
                                    item.novelty.text ||
                                    item.nontriviality.text) && (
                                    <div className="mt-2 rounded-md border border-zinc-100 bg-white p-2 text-xs text-zinc-700">
                                      {item.prior_state.text && (
                                        <div className="mb-1">
                                          <span className="font-semibold text-zinc-800">Prior:</span>{' '}
                                          {item.prior_state.text}{' '}
                                          <span className="text-zinc-500">
                                            <span className="sr-only">
                                              ids {formatIdRanges(item.prior_state.sentence_ids)}
                                            </span>
                                          </span>
                                        </div>
                                      )}
                                      {item.novelty.text && (
                                        <div className="mb-1">
                                          <span className="font-semibold text-zinc-800">
                                            Novelty:
                                          </span>{' '}
                                          {item.novelty.text}{' '}
                                          <span className="text-zinc-500">
                                            <span className="sr-only">
                                              ids {formatIdRanges(item.novelty.sentence_ids)}
                                            </span>
                                          </span>
                                        </div>
                                      )}
                                      {item.nontriviality.text && (
                                        <div>
                                          <span className="font-semibold text-zinc-800">
                                            Nontriviality:
                                          </span>{' '}
                                          {item.nontriviality.text}{' '}
                                          <span className="text-zinc-500">
                                            <span className="sr-only">
                                              ids {formatIdRanges(item.nontriviality.sentence_ids)}
                                            </span>
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}

                    {activeTab === 'tech' && (
                      <>
                        {result.sections.technical_core.key_ideas.length === 0 &&
                          result.sections.technical_core.technical_obstacles.length === 0 &&
                          result.sections.technical_core.reusable_constructions.length === 0 &&
                          renderEmpty('No explicit items found.')}
                        {result.sections.technical_core.key_ideas.length > 0 && (
                          <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                              Key ideas
                            </div>
                            <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                              {result.sections.technical_core.key_ideas.map((item, idx) => (
                                <li key={`tech-ki-${idx}`} className="mb-2">
                                  <MathText text={item.description} />
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                    <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                                    <button
                                      className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-white"
                                      onClick={() => focusSentences(item.sentence_ids)}
                                      type="button"
                                    >
                                      View sentences
                                    </button>
                                    {renderCitationAction(item.sentence_ids)}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.sections.technical_core.technical_obstacles.length > 0 && (
                          <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                              Technical obstacles
                            </div>
                            <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                              {result.sections.technical_core.technical_obstacles.map((item, idx) => (
                                <li key={`tech-to-${idx}`} className="mb-2">
                                  <MathText text={item.description} />
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                    <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                                    <button
                                      className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-white"
                                      onClick={() => focusSentences(item.sentence_ids)}
                                      type="button"
                                    >
                                      View sentences
                                    </button>
                                    {renderCitationAction(item.sentence_ids)}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.sections.technical_core.reusable_constructions.length > 0 && (
                          <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                              Reusable constructions
                            </div>
                            <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                              {result.sections.technical_core.reusable_constructions.map(
                                (item, idx) => (
                                  <li key={`tech-rc-${idx}`} className="mb-2">
                                    <MathText text={item.description} />
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                      <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                                      <button
                                        className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-white"
                                        onClick={() => focusSentences(item.sentence_ids)}
                                        type="button"
                                      >
                                        View sentences
                                      </button>
                                      {renderCitationAction(item.sentence_ids)}
                                    </div>
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                      </>
                    )}

                    {activeTab === 'cons' && (
                      <>
                        {result.sections.consequences.open_questions.length === 0 &&
                          result.sections.consequences.speculative_extensions.length === 0 &&
                          renderEmpty('No explicit items found.')}
                        {result.sections.consequences.open_questions.length > 0 && (
                          <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                              Open questions
                            </div>
                            <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                              {result.sections.consequences.open_questions.map((item, idx) => (
                                <li key={`cons-oq-${idx}`} className="mb-2">
                                  <MathText text={item.description} />
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                    <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                                    <button
                                      className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-white"
                                      onClick={() => focusSentences(item.sentence_ids)}
                                      type="button"
                                    >
                                      View sentences
                                    </button>
                                    {renderCitationAction(item.sentence_ids)}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.sections.consequences.speculative_extensions.length > 0 && (
                          <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                              Speculative extensions
                            </div>
                            <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                              {result.sections.consequences.speculative_extensions.map((item, idx) => (
                                <li key={`cons-se-${idx}`} className="mb-2">
                                  <MathText text={item.description} />
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                    <span className="sr-only">ids {formatIdRanges(item.sentence_ids)}</span>
                                    <button
                                      className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-white"
                                      onClick={() => focusSentences(item.sentence_ids)}
                                      type="button"
                                    >
                                      View sentences
                                    </button>
                                    {renderCitationAction(item.sentence_ids)}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}

                    {activeTab === 'cites' && (
                      <>
                        {Object.keys(result.citations ?? {}).length === 0 &&
                          renderEmpty('No citations detected.')}
                        {(focusedCitationKeys.length > 0
                          ? focusedCitationKeys
                              .map((key) => result.citations?.[key])
                              .filter(Boolean)
                          : Object.values(result.citations ?? {})
                        ).map((entry) => (
                          <div
                            key={`cite-${entry.key}`}
                            className={classNames(
                              'mb-3 rounded-md border p-2 text-sm',
                              focusedCitationKeys.includes(entry.key)
                                ? 'border-amber-200 bg-amber-50'
                                : 'border-zinc-100 bg-zinc-50'
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-zinc-900">
                                {formatCitationLabel(entry)}
                              </span>
                              {entry.labels.map((l) => (
                                <LabelPill key={`${entry.key}-${l}`} label={l} />
                              ))}
                            </div>
                            {entry.text && (
                              <div className="mt-1 text-xs text-zinc-700">{entry.text}</div>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span>{entry.sentence_ids.length} sentences</span>
                              <button
                                className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-white"
                                onClick={() => focusSentences(entry.sentence_ids)}
                                type="button"
                                disabled={entry.sentence_ids.length === 0}
                              >
                                View sentences
                              </button>
                            </div>
                          </div>
                        ))}
                        {focusedCitationKeys.length > 0 && (
                          <button
                            className="rounded-full border px-3 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50"
                            type="button"
                            onClick={() => setFocusedCitationKeys([])}
                          >
                            Clear filter
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </details>

          <details className="rounded-lg border bg-white" open>
            <summary className="flex cursor-pointer items-center justify-between border-b px-4 py-3 text-sm font-semibold">
              <span>Audience views (Pass 3)</span>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border px-2 py-0.5 text-xs font-normal text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    rerunPass3Only();
                  }}
                  disabled={!result || status.kind === 'analyzing' || status.kind === 'uploading'}
                >
                  Re-run Pass 3
                </button>
                <button
                  className="rounded-full border px-2 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-100"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!result?.audience_views) return;
                    navigator.clipboard.writeText(
                      JSON.stringify(result.audience_views, null, 2)
                    );
                  }}
                  aria-label="Copy audience view JSON"
                  title="Copy audience view JSON"
                >
                  ⧉
                </button>
              </div>
            </summary>
            <div className="grid grid-cols-1 gap-4 p-4">
              {!result?.audience_views && <div className="text-sm text-zinc-500">No data.</div>}
              {result?.audience_views && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'A', label: 'Domain Expert' },
                      { id: 'B', label: 'Adjacent-field Researcher' },
                      { id: 'C', label: 'Grad Student' },
                      { id: 'D', label: 'Author Self' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        className={classNames(
                          'rounded-full border px-3 py-1 text-xs',
                          audienceTab === tab.id
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                        )}
                        onClick={() => setAudienceTab(tab.id as typeof audienceTab)}
                        type="button"
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-md border bg-white p-3 max-h-[42vh] overflow-auto">
                    {audienceTab === 'A' && (
                      <>
                        <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Problem statement
                          </div>
                          <div className="mt-2 text-sm text-zinc-900">
                            <MathText
                              text={result.audience_views.domain_expert.problem_statement?.text ?? ''}
                            />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            {result.audience_views.domain_expert.problem_statement?.sentence_ids?.length ? (
                              <button
                                className="rounded-full border px-2 py-0.5 text-[10px] hover:bg-white"
                                type="button"
                                onClick={() =>
                                  focusSentences(
                                    result.audience_views.domain_expert.problem_statement!.sentence_ids
                                  )
                                }
                              >
                                View sentences
                              </button>
                            ) : null}
                            {renderCitationActionForKeys(
                              getCitationsForSentenceIds(
                                result.audience_views.domain_expert.problem_statement?.sentence_ids ?? []
                              ).map((e) => e.key)
                            )}
                          </div>
                        </div>

                        <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Delta summary
                          </div>
                          {renderGroundedList(result.audience_views.domain_expert.delta_summary)}
                        </div>

                        <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Technical highlights
                          </div>
                          <div className="mt-2 text-xs font-semibold text-zinc-500">
                            Nonstandard ideas
                          </div>
                          {renderGroundedList(
                            result.audience_views.domain_expert.technical_highlights
                              .nonstandard_ideas
                          )}
                          <div className="mt-3 text-xs font-semibold text-zinc-500">
                            Clever reductions
                          </div>
                          {renderGroundedList(
                            result.audience_views.domain_expert.technical_highlights.clever_reductions
                          )}
                        </div>

                        <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Reusable components
                          </div>
                          {renderGroundedList(result.audience_views.domain_expert.reusable_components)}
                        </div>

                      </>
                    )}

                    {audienceTab === 'B' && (
                      <>
                        <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Problem statement (plain math)
                          </div>
                          <div className="mt-2 text-sm text-zinc-900">
                            <MathText text={result.audience_views.adjacent_researcher.problem_statement.text} />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            {result.audience_views.adjacent_researcher.problem_statement?.sentence_ids?.length ? (
                              <button
                                className="rounded-full border px-2 py-0.5 text-[10px] hover:bg-white"
                                type="button"
                                onClick={() =>
                                  focusSentences(
                                    result.audience_views.adjacent_researcher.problem_statement
                                      .sentence_ids
                                  )
                                }
                              >
                                View sentences
                              </button>
                            ) : null}
                            {renderCitationActionForKeys(
                              getCitationsForSentenceIds(
                                result.audience_views.adjacent_researcher.problem_statement.sentence_ids ?? []
                              ).map((e) => e.key)
                            )}
                          </div>
                        </div>

                        <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Why this matters
                          </div>
                          {renderGroundedList(result.audience_views.adjacent_researcher.why_matters)}
                        </div>

                        <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Prerequisite map
                          </div>
                          <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                            {result.audience_views.adjacent_researcher.prerequisite_map.map(
                              (item, idx) => (
                                <li key={`b-pre-${idx}`} className="mb-2">
                                  <MathText text={item} />
                                </li>
                              )
                            )}
                          </ul>
                        </div>

                        <div className="rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Reading path
                          </div>
                          <div className="mt-2 text-xs font-semibold text-zinc-500">Read</div>
                          <ul className="mt-1 list-disc pl-4 text-sm text-zinc-900">
                            {result.audience_views.adjacent_researcher.reading_path.read.map(
                              (item, idx) => (
                                <li key={`b-read-${idx}`} className="mb-2">
                                  <MathText text={item} />
                                </li>
                              )
                            )}
                          </ul>
                          <div className="mt-2 text-xs font-semibold text-zinc-500">Skim</div>
                          <ul className="mt-1 list-disc pl-4 text-sm text-zinc-900">
                            {result.audience_views.adjacent_researcher.reading_path.skim.map(
                              (item, idx) => (
                                <li key={`b-skim-${idx}`} className="mb-2">
                                  <MathText text={item} />
                                </li>
                              )
                            )}
                          </ul>
                          <div className="mt-2 text-xs font-semibold text-zinc-500">Skip</div>
                          <ul className="mt-1 list-disc pl-4 text-sm text-zinc-900">
                            {result.audience_views.adjacent_researcher.reading_path.skip.map(
                              (item, idx) => (
                                <li key={`b-skip-${idx}`} className="mb-2">
                                  <MathText text={item} />
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      </>
                    )}

                    {audienceTab === 'C' && (
                      <>
                        <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Problem statement
                          </div>
                          <div className="mt-2 text-sm text-zinc-900">
                            <MathText
                              text={result.audience_views.grad_student.problem_statement?.text ?? ''}
                            />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            {result.audience_views.grad_student.problem_statement?.sentence_ids?.length ? (
                              <button
                                className="rounded-full border px-2 py-0.5 text-[10px] hover:bg-white"
                                type="button"
                                onClick={() =>
                                  focusSentences(
                                    result.audience_views.grad_student.problem_statement!.sentence_ids
                                  )
                                }
                              >
                                View sentences
                              </button>
                            ) : null}
                            {renderCitationActionForKeys(
                              getCitationsForSentenceIds(
                                result.audience_views.grad_student.problem_statement?.sentence_ids ?? []
                              ).map((e) => e.key)
                            )}
                          </div>
                        </div>

                        <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Conceptual map
                          </div>
                          <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                            {result.audience_views.grad_student.conceptual_map.map((item, idx) => (
                              <li key={`c-map-${idx}`} className="mb-2">
                                <MathText text={item} />
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Suggested first pass
                          </div>
                          <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                            {result.audience_views.grad_student.suggested_first_pass.map(
                              (item, idx) => (
                                <li key={`c-pass-${idx}`} className="mb-2">
                                  <MathText text={item} />
                                </li>
                              )
                            )}
                          </ul>
                        </div>

                        <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Key ideas before technicalities
                          </div>
                          {renderGroundedList(result.audience_views.grad_student.key_ideas)}
                          {renderCitationActionForKeys(
                            getCitationsForSentenceIds(
                              collectSentenceIds(result.audience_views.grad_student.key_ideas)
                            ).map((e) => e.key)
                          )}
                        </div>

                        <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            What to ignore initially
                          </div>
                          <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                            {result.audience_views.grad_student.ignore_initially.map(
                              (item, idx) => (
                                <li key={`c-ign-${idx}`} className="mb-2">
                                  <MathText text={item} />
                                </li>
                              )
                            )}
                          </ul>
                        </div>

                        <div className="rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Permission to skip
                          </div>
                          <div className="mt-2 text-sm text-zinc-900">
                            <MathText text={result.audience_views.grad_student.permission_to_skip} />
                          </div>
                        </div>
                      </>
                    )}

                    {audienceTab === 'D' && (
                      <>
                        <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Problem statement
                          </div>
                          <div className="mt-2 text-sm text-zinc-900">
                            <MathText
                              text={result.audience_views.author_self.problem_statement?.text ?? ''}
                            />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            {result.audience_views.author_self.problem_statement?.sentence_ids?.length ? (
                              <button
                                className="rounded-full border px-2 py-0.5 text-[10px] hover:bg-white"
                                type="button"
                                onClick={() =>
                                  focusSentences(
                                    result.audience_views.author_self.problem_statement!.sentence_ids
                                  )
                                }
                              >
                                View sentences
                              </button>
                            ) : null}
                            {renderCitationActionForKeys(
                              getCitationsForSentenceIds(
                                result.audience_views.author_self.problem_statement?.sentence_ids ?? []
                              ).map((e) => e.key)
                            )}
                          </div>
                        </div>

                        <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            One-page contribution summary
                          </div>
                          <div className="mt-2 text-sm text-zinc-900">
                            <MathText text={result.audience_views.author_self.one_page_summary} />
                          </div>
                        </div>

                        <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Fragile arguments
                          </div>
                          {renderGroundedList(result.audience_views.author_self.fragile_arguments)}
                          {renderCitationActionForKeys(
                            getCitationsForSentenceIds(
                              collectSentenceIds(result.audience_views.author_self.fragile_arguments)
                            ).map((e) => e.key)
                          )}
                        </div>

                        <div className="mb-3 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Robust arguments
                          </div>
                          {renderGroundedList(result.audience_views.author_self.robust_arguments)}
                          {renderCitationActionForKeys(
                            getCitationsForSentenceIds(
                              collectSentenceIds(result.audience_views.author_self.robust_arguments)
                            ).map((e) => e.key)
                          )}
                        </div>

                        <div className="rounded-md border border-zinc-100 bg-zinc-50 p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            Notes to self
                          </div>
                          <ul className="mt-2 list-disc pl-4 text-sm text-zinc-900">
                            {result.audience_views.author_self.notes_to_self.map((item, idx) => (
                              <li key={`d-note-${idx}`} className="mb-2">
                                <MathText text={item} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}
                    <details className="rounded-md border bg-white" open>
                      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-zinc-600">
                        Supporting text
                      </summary>
                      {renderAudienceFullText()}
                    </details>
                  </div>
                </>
              )}
            </div>
          </details>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-10 text-xs text-zinc-500" />
    </div>
  );
}
