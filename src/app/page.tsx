'use client';

import type React from 'react';
import { useMemo, useRef, useState } from 'react';

import type { AnalysisResult, DiscourseLabel, Sentence } from '@/lib/pipeline/client';
import { propagateLabelsByEnvironment } from '@/lib/pipeline/env_propagation';
import { buildAudienceSupportingText } from '@/lib/ui/supportingText';
import { formatIdRanges } from '@/lib/ui/idRanges';
import {
  formatCitationLabel,
  getCitationEntries,
  getCitationKeysForSentenceIds,
} from '@/lib/ui/citations';
import { useAnalyzeStream } from '@/lib/ui/useAnalyzeStream';
import { MathText } from '@/components/MathText';
import { LabelPill } from '@/components/LabelPill';
import { AudienceViewsCard } from '@/components/AudienceViewsCard';
import { CanonicalSectionsCard } from '@/components/CanonicalSectionsCard';
import { UploadCard } from '@/components/UploadCard';
import { TextPanel } from '@/components/TextPanel';
import {
  buildCanonicalSectionTitles,
  buildSentenceMap,
  extractSectionHeadings,
  renderReadingPathText as renderReadingPathTextRaw,
} from '@/lib/ui/sectionHints';

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [useEnvPropagation, setUseEnvPropagation] = useState(false);
  const { status, setStatus, result, setResult, processingWindows, onAnalyze } = useAnalyzeStream({
    file,
    useEnvPropagation,
  });
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
          abstract: data.abstract ?? prev.abstract,
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
          abstract: data.abstract ?? prev.abstract,
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

  const sentenceById = useMemo(
    () => (result?.sentences ? buildSentenceMap(result) : new Map<number, Sentence>()),
    [result]
  );

  const sectionHeadingMap = useMemo(
    () => (result?.original_latex ? extractSectionHeadings(result.original_latex) : []),
    [result?.original_latex]
  );

  const canonicalSectionTitles = useMemo(() => {
    if (!result) return null;
    return buildCanonicalSectionTitles(result, sectionHeadingMap, sentenceById);
  }, [result, sectionHeadingMap, sentenceById]);

  const renderReadingPathText = (text: string) => {
    if (!canonicalSectionTitles) return <MathText text={text} />;
    return <MathText text={renderReadingPathTextRaw(text, canonicalSectionTitles)} />;
  };

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

  const labelCounts = useMemo<Record<DiscourseLabel, number>>(() => {
    const counts: Record<DiscourseLabel, number> = {
      Problem: 0,
      Landscape: 0,
      Contribution: 0,
      TechnicalCore: 0,
      Consequences: 0,
    };
    if (!result) return counts;
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

  const getCitationsForSentenceIds = (ids: number[]) =>
    getCitationEntries(result, getCitationKeysForSentenceIds(result, ids));

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
                onClick={() => focusSentences(item.sentence_ids ?? [])}
              >
                View sentences
              </button>
            )}
            {renderCitationActionForKeys(
              item.sentence_ids
                ? getCitationsForSentenceIds(item.sentence_ids).map((e) => e.key)
                : []
            )}
          </div>
        </li>
      ))}
    </ul>
  );

  const collectSentenceIds = (items: Array<{ sentence_ids?: number[] }>) =>
    Array.from(new Set(items.flatMap((item) => item.sentence_ids ?? [])));

  const audienceSupporting = useMemo(() => {
    if (!result?.audience_views) {
      return { abstract: '', segments: [] as Array<{ text: string; startId: number; endId: number }> };
    }
    return buildAudienceSupportingText(result, audienceTab);
  }, [result, audienceTab]);

  const renderAudienceFullText = () => {
    if (!result) return null;
    const { abstract, segments } = audienceSupporting;
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
        {segments.length === 0 ? (
          <div className="text-xs text-zinc-500">No supporting sentences found.</div>
        ) : (
          segments.map((segment, idx) => {
            const prevEnd = idx > 0 ? segments[idx - 1].endId : null;
            const showGap = prevEnd !== null && segment.startId !== prevEnd + 1;
            return (
              <span key={`aud-text-${segment.startId}-${idx}`}>
                {showGap && (
                  <>
                    {'\n'}
                    <span className="text-xs text-zinc-400">⋯ gap</span>
                    {'\n'}
                  </>
                )}
                {segment.text}
                {idx < segments.length - 1 ? '\n' : ''}
              </span>
            );
          })
        )}
      </div>
    );
  };

  const handleCopyAudienceViews = () => {
    if (!result?.audience_views) return;
    navigator.clipboard.writeText(JSON.stringify(result.audience_views, null, 2));
  };

  const handleApplyPropagation = () => {
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
              Upload a .tex paper → label sentences (Pass 1) → build canonical sections (Pass 2) →
              produce audience views (Pass 3).
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
        <UploadCard
          file={file}
          status={status}
          processingWindows={processingWindows}
          onFileChange={setFile}
          onAnalyze={onAnalyze}
        />

        <section className="col-span-12 flex flex-col gap-4">
          <TextPanel
            result={result}
            documentTitle={documentTitle}
            renderedOriginalText={renderedOriginalText}
            labelCounts={labelCounts}
            unlabeledCount={unlabeledCount}
            labelFilter={labelFilter}
            showUnlabeledOnly={showUnlabeledOnly}
            envPropagationPrev={envPropagationPrev}
            envPropagationMsg={envPropagationMsg}
            envPropagationDetails={envPropagationDetails}
            processingWindows={processingWindows}
            highlightedIds={highlightedIds}
            textDetailsRef={textDetailsRef}
            useEnvPropagation={useEnvPropagation}
            onToggleUseEnvPropagation={setUseEnvPropagation}
            onToggleLabelFilter={toggleLabelFilter}
            onClearFilters={() => {
              setLabelFilter([]);
              setShowUnlabeledOnly(false);
            }}
            onToggleUnlabeled={() => setShowUnlabeledOnly((prev) => !prev)}
            onApplyPropagation={handleApplyPropagation}
            onReRunPass1={onAnalyze}
            isSentenceProcessing={isSentenceProcessing}
            focusSentences={focusSentences}
            setLabelFilter={setLabelFilter}
            setShowUnlabeledOnly={setShowUnlabeledOnly}
          />

          <CanonicalSectionsCard
            result={result}
            detailsRef={canonicalDetailsRef}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            statusKind={status.kind}
            onRerunPass2={rerunPass2Only}
            onCopyCanonical={() => {
              if (!result?.sections) return;
              navigator.clipboard.writeText(JSON.stringify(result.sections, null, 2));
            }}
            renderEmpty={renderEmpty}
            renderGroundedList={renderGroundedList}
            renderCitationAction={renderCitationAction}
            focusSentences={focusSentences}
            formatIdRanges={formatIdRanges}
            formatCitationLabel={formatCitationLabel}
            LabelPill={LabelPill}
            focusedCitationKeys={focusedCitationKeys}
            setFocusedCitationKeys={setFocusedCitationKeys}
          />

          <AudienceViewsCard
            result={result}
            audienceTab={audienceTab}
            setAudienceTab={setAudienceTab}
            statusKind={status.kind}
            onRerunPass3={rerunPass3Only}
            onCopyAudienceViews={handleCopyAudienceViews}
            focusSentences={focusSentences}
            renderGroundedList={renderGroundedList}
            renderCitationActionForKeys={renderCitationActionForKeys}
            getCitationsForSentenceIds={getCitationsForSentenceIds}
            collectSentenceIds={collectSentenceIds}
            renderReadingPathText={renderReadingPathText}
            renderAudienceFullText={renderAudienceFullText}
          />
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-10 text-xs text-zinc-500" />
    </div>
  );
}
