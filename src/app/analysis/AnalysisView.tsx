'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import type { AnalysisResult, DiscourseLabel, Sentence } from '@/lib/pipeline/client';
import { expandSentenceIdsByEnvironment } from '@/lib/pipeline/env_propagation';
import { buildAudienceSupportingText } from '@/lib/ui/supportingText';
import { formatIdRanges } from '@/lib/ui/idRanges';
import {
  formatCitationLabel,
  getCitationEntries,
  getCitationKeysForSentenceIds,
} from '@/lib/ui/citations';
import { usePdfCompile } from '@/lib/ui/usePdfCompile';
import type { AnalyzeStatus } from '@/lib/ui/useAnalyzeStream';
import { MathText } from '@/components/MathText';
import { LabelPill } from '@/components/LabelPill';
import { AudienceViewsCard } from '@/components/AudienceViewsCard';
import { CanonicalSectionsCard } from '@/components/CanonicalSectionsCard';
import { TextPanel } from '@/components/TextPanel';
import { PdfViewerCard } from '@/components/PdfViewerCard';
import { useAnalysis } from '@/components/AnalysisContext';
import { AppLogo } from '@/components/AppLogo';
import {
  buildCanonicalSectionTitles,
  buildSentenceMap,
  extractSectionHeadings,
  renderReadingPathText as renderReadingPathTextRaw,
} from '@/lib/ui/sectionHints';
import { buildAudienceExport } from '@/lib/ui/audienceExport';
import { isTexEnabled } from '@/lib/features';

type AnalysisMode = 'core' | 'audience';

export function AnalysisView({ mode }: { mode: AnalysisMode }) {
  const isAudiencePage = mode === 'audience';
  const texEnabled = isTexEnabled();
  const [showCorePdf, setShowCorePdf] = useState(false);
  const {
    file,
    status,
    setStatus,
    result,
    setResult,
    processingWindows,
    onAnalyze,
  } = useAnalysis();
  const canViewAudience = Boolean(result?.audience_views);
  const [pdfMode, setPdfMode] = useState<'original' | 'audience'>('original');
  const [activeTab, setActiveTab] = useState<
    'problem' | 'landscape' | 'contrib' | 'tech' | 'cons' | 'cites'
  >('problem');
  const [audienceTab, setAudienceTab] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [highlightedIds, setHighlightedIds] = useState<number[]>([]);
  const [focusedCitationKeys, setFocusedCitationKeys] = useState<string[]>([]);
  const textDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const canonicalDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const pdfTab = pdfMode === 'original' ? 'original' : audienceTab;
  const [manualHighlightIds, setManualHighlightIds] = useState<number[] | null>(null);
  const [focusSentenceId, setFocusSentenceId] = useState<number | null>(null);
  const [labelFilter, setLabelFilter] = useState<DiscourseLabel[]>([]);
  const hasSetAudienceModeRef = useRef(false);
  const updateAudienceViews = useCallback(
    (updater: (views: NonNullable<AnalysisResult['audience_views']>) => void) => {
      setResult((prev) => {
        if (!prev?.audience_views) return prev;
        const views = JSON.parse(JSON.stringify(prev.audience_views)) as NonNullable<
          AnalysisResult['audience_views']
        >;
        updater(views);
        return { ...prev, audience_views: views };
      });
    },
    [setResult]
  );
  useEffect(() => {
    if (!isAudiencePage) {
      setPdfMode('original');
    }
  }, [isAudiencePage]);

  useEffect(() => {
    if (!isAudiencePage) return;
    if (hasSetAudienceModeRef.current) return;
    if (result?.audience_views) {
      setPdfMode('audience');
      hasSetAudienceModeRef.current = true;
    }
  }, [isAudiencePage, result?.audience_views]);

  useEffect(() => {
    setManualHighlightIds(null);
    setFocusSentenceId(null);
  }, [audienceTab]);

  useEffect(() => {
    if (pdfMode === 'original') {
      setManualHighlightIds(null);
      setFocusSentenceId(null);
    }
  }, [pdfMode]);
  async function rerunPass2Only() {
    if (!result) return;
    setStatus({ kind: 'analyzing', phase: 'pass2', message: 'Re-running Pass 2…' });
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
  const sentenceOrder = useMemo(() => {
    if (!result?.sentences) return [];
    return [...result.sentences].sort(
      (a, b) => (a.original_start ?? a.start ?? 0) - (b.original_start ?? b.start ?? 0)
    );
  }, [result]);
  const sentenceIndexById = useMemo(() => {
    const map = new Map<number, number>();
    sentenceOrder.forEach((s, idx) => map.set(s.id, idx));
    return map;
  }, [sentenceOrder]);
  const focusSentenceIndex =
    focusSentenceId != null ? sentenceIndexById.get(focusSentenceId) ?? null : null;

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
  const renderReadingPathTextPlain = (text: string) => {
    if (!canonicalSectionTitles) return text;
    return renderReadingPathTextRaw(text, canonicalSectionTitles);
  };

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
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <MathText text={item.text} />
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500 shrink-0">
              {isAudiencePage && item.sentence_ids && item.sentence_ids.length > 0 && (
                <button
                  className="rounded-full border px-2 py-0.5 text-sm hover:bg-white"
                  type="button"
                  onClick={() => focusSentences(item.sentence_ids ?? [])}
                  aria-label="Focus highlighted sentences in PDF"
                  title="Focus highlighted sentences in PDF"
                >
                  <Search className="h-4 w-4" aria-hidden />
                </button>
              )}
              {!isAudiencePage &&
                renderCitationActionForKeys(
                  item.sentence_ids
                    ? getCitationsForSentenceIds(item.sentence_ids).map((e) => e.key)
                    : []
                )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );

  const audienceSupporting = useMemo(() => {
    if (!result?.audience_views) {
      return {
        abstract: '',
        segments: [] as Array<{ text: string; startId: number; endId: number }>,
        sentenceIds: [] as number[],
      };
    }
    return buildAudienceSupportingText(result, audienceTab);
  }, [result, audienceTab]);

  const pdfSupporting = useMemo(() => {
    if (pdfTab === 'original') {
      return { sentenceIds: [] as number[] };
    }
    if (manualHighlightIds && manualHighlightIds.length > 0) {
      return { sentenceIds: manualHighlightIds };
    }
    if (!result?.audience_views) {
      return { sentenceIds: [] as number[] };
    }
    return buildAudienceSupportingText(result, pdfTab as 'A' | 'B' | 'C' | 'D');
  }, [result, pdfTab, manualHighlightIds]);

  const renderAudienceFullText = () => {
    if (!result) return null;
    const { abstract, segments } = audienceSupporting;
    return (
      <div className="mt-3 rounded-md border bg-zinc-50 p-4 text-sm leading-6 whitespace-pre-wrap">
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

  function EditableTextBlock({
    value,
    onChange,
  }: {
    value: string;
    onChange: (next: string) => void;
  }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);

    useEffect(() => {
      if (editing) return;
      setDraft(value);
    }, [value, editing]);

    if (!editing) {
      return (
        <div
          className="whitespace-pre-wrap"
          onDoubleClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          title="Double click to edit (temporary)"
        >
          {value}
        </div>
      );
    }

    return (
      <textarea
        className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-base text-zinc-900"
        value={draft}
        rows={Math.max(2, Math.min(10, Math.ceil(draft.length / 90)))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onChange(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        autoFocus
      />
    );
  }

  const [supportingAbstractOverride, setSupportingAbstractOverride] = useState<string | null>(null);
  const [supportingSegmentOverrides, setSupportingSegmentOverrides] = useState<Record<number, string>>({});

  useEffect(() => {
    // Supporting text segments change with audience tab / new results.
    // Clear temporary edits to avoid applying overrides to the wrong segment indices.
    setSupportingAbstractOverride(null);
    setSupportingSegmentOverrides({});
  }, [audienceTab, result?.audience_views]);

  const supportingTextView = useMemo(() => {
    if (!result || !isAudiencePage) return null;
    const { abstract, segments } = audienceSupporting;
    const abstractValue = supportingAbstractOverride ?? abstract;
    return (
      <div className="text-sm leading-6">
        <div className="text-xs text-zinc-500">
          Debug view. Double click any block to edit (temporary).
        </div>
        <div className="mt-3 rounded-md border bg-white p-4">
          <div className="font-semibold text-zinc-700">Abstract</div>
          <div className="mt-2">
            <EditableTextBlock
              value={abstractValue}
              onChange={(next) => setSupportingAbstractOverride(next)}
            />
          </div>
        </div>

        <div className="mt-3 rounded-md border bg-white p-4">
          <div className="font-semibold text-zinc-700">Supporting segments</div>
          {segments.length === 0 ? (
            <div className="mt-2 text-sm text-zinc-500">No supporting sentences found.</div>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {segments.map((segment, idx) => {
                const override = supportingSegmentOverrides[idx];
                const value = override ?? segment.text;
                return (
                  <div key={`supporting-edit-${segment.startId}-${idx}`} className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-500">Sentences {segment.startId}–{segment.endId}</div>
                    <div className="mt-2">
                      <EditableTextBlock
                        value={value}
                        onChange={(next) =>
                          setSupportingSegmentOverrides((prev) => ({ ...prev, [idx]: next }))
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }, [result, isAudiencePage, audienceSupporting, supportingAbstractOverride, supportingSegmentOverrides]);

  const buildSupportingTexExport = () => {
    if (!result) return null;
    const { abstract, segments } = audienceSupporting;
    const abstractValue = (supportingAbstractOverride ?? abstract ?? '').trim();
    const segTexts = segments.map((seg, idx) => ({
      range: `${seg.startId}–${seg.endId}`,
      text: (supportingSegmentOverrides[idx] ?? seg.text ?? '').trim(),
    }));

    const lines: string[] = [];
    lines.push(`% FourFold supporting export`);
    lines.push(`% Audience tab: ${audienceTab}`);
    lines.push(`% Document: ${documentTitle}`);
    lines.push('');
    if (abstractValue) {
      lines.push('% Abstract');
      lines.push(abstractValue);
      lines.push('');
    }
    if (segTexts.length === 0) {
      lines.push('% No supporting segments.');
    } else {
      segTexts.forEach((seg, idx) => {
        lines.push(`% Segment ${idx + 1} (sentences ${seg.range})`);
        if (seg.text) lines.push(seg.text);
        lines.push('');
      });
    }
    return `${lines.join('\n').trimEnd()}\n`;
  };

  const slugify = (value: string) =>
    (value || 'untitled')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
      .slice(0, 80) || 'untitled';

  const handleDownloadSupportingTex = () => {
    const tex = buildSupportingTexExport();
    if (!tex) return;
    downloadBlob(tex, `supporting-${audienceTab}-${slugify(documentTitle)}.tex`, 'text/x-tex;charset=utf-8');
  };

  const expandedAudienceHighlightIds = useMemo(() => {
    if (!result || pdfTab === 'original') return [];
    const ids = pdfSupporting.sentenceIds ?? [];
    if (ids.length === 0) return [];
    return expandSentenceIdsByEnvironment(result.original_latex, result.sentences, ids);
  }, [result, pdfTab, pdfSupporting]);


  const { pdfUrl, status: pdfStatus, compilePdf } = usePdfCompile({
    file,
    mode: pdfTab === 'original' ? 'original' : 'highlighted',
    originalLatex: result?.original_latex ?? null,
    sentences: result?.sentences,
    highlightIds: expandedAudienceHighlightIds,
  });

  const lastPdfKeyRef = useRef<string | null>(null);
  const highlightKey = useMemo(() => {
    if (pdfTab === 'original') return null;
    if (!expandedAudienceHighlightIds.length) return null;
    return `aud:${audienceTab}:${expandedAudienceHighlightIds.join(',')}`;
  }, [pdfTab, audienceTab, expandedAudienceHighlightIds]);


  const originalKey = useMemo(() => {
    if (pdfTab !== 'original') return null;
    const name = file?.name ?? result?.filename ?? '';
    const len = result?.original_latex?.length ?? 0;
    return `orig:${name}:${len}`;
  }, [pdfTab, file, result?.filename, result?.original_latex]);

  useEffect(() => {
    if (pdfTab === 'original') return;
    if (!result || expandedAudienceHighlightIds.length === 0) return;
    if (!texEnabled) return;
    if (highlightKey && lastPdfKeyRef.current === highlightKey) return;
    if (highlightKey) lastPdfKeyRef.current = highlightKey;
    void compilePdf();
  }, [pdfTab, expandedAudienceHighlightIds, result, compilePdf, highlightKey, texEnabled]);

  useEffect(() => {
    if (pdfTab !== 'original') return;
    if (!file && !result?.original_latex) return;
    if (!texEnabled) return;
    if (originalKey && lastPdfKeyRef.current === originalKey) return;
    if (originalKey) lastPdfKeyRef.current = originalKey;
    void compilePdf();
  }, [pdfTab, file, result, compilePdf, originalKey, texEnabled]);

  const handlePdfTabChange = (id: string) => {
    if (!isAudiencePage) return;
    if (id === 'original') {
      setPdfMode('original');
      return;
    }
    if (id === 'audience') {
      setPdfMode('audience');
      return;
    }
    setPdfMode('audience');
    setAudienceTab(id as typeof audienceTab);
  };

  const handleAudienceTabChange = (tab: typeof audienceTab) => {
    setAudienceTab(tab);
    if (isAudiencePage) {
      setPdfMode('audience');
    }
  };

  const statusPhase = useMemo<'pass1' | 'pass2' | 'pass3' | null>(() => {
    if (status.kind === 'done') return null;
    if (status.kind === 'analyzing') return status.phase;
    if (status.kind === 'uploading' || status.kind === 'idle') return 'pass1';
    return 'pass1';
  }, [status]);

  const headerPhaseLabel = useMemo(() => {
    if (status.kind === 'idle') return null;
    if (status.kind === 'uploading') return 'Uploading';
    if (status.kind === 'done') return null;
    if (status.kind === 'error') return 'Error';
    if (status.kind === 'analyzing') {
      if (status.phase === 'pass1') return 'Semantic Sequence Classification';
      if (status.phase === 'pass2') return 'Canonical sectioning';
      return 'Audience synthesis';
    }
    return null;
  }, [status]);

  const buildStatusLine = (
    phase: 'pass1' | 'pass2' | 'pass3',
    currentStatus: AnalyzeStatus,
    ready: boolean
  ): ReactNode | null => {
    if (currentStatus.kind === 'done') {
      return ready ? 'Ready' : null;
    }
    if (statusPhase !== phase) return null;
    if (currentStatus.kind === 'idle') {
      return result ? null : 'Upload a .tex file to begin';
    }
    if (currentStatus.kind === 'uploading') return 'Uploading…';
    if (currentStatus.kind === 'analyzing') {
      const base = currentStatus.message ?? 'Processing…';
      if (phase === 'pass1' && processingWindows.length > 0) {
        return (
          <>
            {base} · {processingWindows.length} windows
          </>
        );
      }
      return base;
    }
    if (currentStatus.kind === 'error') return `Error: ${currentStatus.message}`;
    return null;
  };

  const pass1Status = buildStatusLine('pass1', status, Boolean(result));
  const pass2Status = buildStatusLine('pass2', status, Boolean(result?.sections));
  // Note: pass3Status intentionally not used in header UI to keep it high-level.


  const downloadBlob = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const buildAudienceExportPayload = () => {
    if (!result?.audience_views) return null;
    return buildAudienceExport({
      result,
      documentTitle,
      audienceTab,
      renderReadingPathText: renderReadingPathTextPlain,
    });
  };

  const handleDownloadAudienceText = () => {
    const payload = buildAudienceExportPayload();
    if (!payload) return;
    downloadBlob(payload.text, `${payload.filenameBase}.txt`, 'text/plain;charset=utf-8');
  };

  const handleDownloadAudienceHtml = () => {
    const payload = buildAudienceExportPayload();
    if (!payload) return;
    downloadBlob(payload.html, `${payload.filenameBase}.html`, 'text/html;charset=utf-8');
  };

  const focusSentences = (ids: number[]) => {
    if (!ids || ids.length === 0) return;
    setHighlightedIds(ids);
    setManualHighlightIds(ids);
    setFocusSentenceId(ids[0]);
    if (isAudiencePage) {
      setPdfMode('audience');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <AppLogo />
            <div>
              <h1 className="text-lg font-semibold">
                {isAudiencePage ? 'Audience view' : 'Analysis workspace'}
              </h1>
              <p className="text-sm text-zinc-500">
                {isAudiencePage
                  ? 'Review audience summaries with highlighted PDFs.'
                  : 'Review sentence labels and canonical sections with the original PDF.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-full border bg-white p-1 text-sm text-zinc-600">
              <Link
                className={
                  isAudiencePage
                    ? 'rounded-full px-3 py-1.5 hover:bg-zinc-50'
                    : 'rounded-full bg-zinc-900 px-3 py-1.5 text-white'
                }
                href="/analysis"
                aria-label="Core analysis"
                title="Core analysis"
              >
                Core
              </Link>
              {canViewAudience ? (
                <Link
                  className={
                    isAudiencePage
                      ? 'rounded-full bg-zinc-900 px-3 py-1.5 text-white'
                      : 'rounded-full px-3 py-1.5 hover:bg-zinc-50'
                  }
                  href="/analysis/audience"
                  aria-label="Audience view"
                  title="Audience view"
                >
                  <span className="inline-flex items-center gap-2">
                    Audience
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                      Ready
                    </span>
                  </span>
                </Link>
              ) : (
                <span
                  className="rounded-full px-3 py-1.5 text-zinc-300"
                  aria-label="Audience view unavailable"
                  title="Audience view unavailable"
                >
                  Audience
                </span>
              )}
            </div>

            {headerPhaseLabel ? (
              <div className="hidden md:block text-xs text-zinc-500 max-w-[320px] truncate" title={headerPhaseLabel}>
                {headerPhaseLabel}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {isAudiencePage ? (
        <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6">
          <section className="flex flex-col gap-4">
            <AudienceViewsCard
              result={result}
              audienceTab={audienceTab}
              setAudienceTab={handleAudienceTabChange}
              statusKind={status.kind}
              onDownloadAudienceText={handleDownloadAudienceText}
              onDownloadAudienceHtml={handleDownloadAudienceHtml}
              focusSentences={focusSentences}
              renderGroundedList={renderGroundedList}
              renderReadingPathText={renderReadingPathText}
              renderAudienceFullText={renderAudienceFullText}
              showSupportingText={false}
              editable
              onUpdateAudienceViews={updateAudienceViews}
            />
          </section>
          <PdfViewerCard
            canCompile={
              pdfTab === 'original'
                ? !!file || !!result?.original_latex
                : expandedAudienceHighlightIds.length > 0
            }
            status={pdfStatus}
            pdfUrl={pdfUrl}
            onCompile={() => {
              if (!texEnabled) return;
              void compilePdf({ force: true });
            }}
            selectedTab={pdfTab}
            onTabChange={handlePdfTabChange}
            showToggle
            focusSentenceIndex={focusSentenceIndex}
            totalSentences={sentenceOrder.length || undefined}
            variant="full"
            supportingTitle="Supporting"
            supportingContent={supportingTextView}
            defaultView={texEnabled ? 'pdf' : 'supporting'}
            showCompile={texEnabled}
            onDownloadSupportingTex={handleDownloadSupportingTex}
          />
        </main>
      ) : (
        <main
          className={
            showCorePdf
              ? 'mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
              : 'mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6'
          }
        >
          <section className="flex flex-col gap-4">
            <TextPanel
              result={result}
              documentTitle={documentTitle}
              renderedOriginalText={renderedOriginalText}
              labelCounts={labelCounts}
              labelFilter={labelFilter}
              processingWindows={processingWindows}
              headerStatus={pass1Status}
              highlightedIds={highlightedIds}
              textDetailsRef={textDetailsRef}
              onToggleLabelFilter={toggleLabelFilter}
              onClearFilters={() => {
                setLabelFilter([]);
              }}
              onReRunPass1={onAnalyze}
              showViewerButton
              isViewerOpen={showCorePdf}
              onToggleViewer={() => setShowCorePdf((v) => !v)}
              isSentenceProcessing={isSentenceProcessing}
            />

            <CanonicalSectionsCard
              result={result}
              detailsRef={canonicalDetailsRef}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              status={status}
              onRerunPass2={rerunPass2Only}
              onCopyCanonical={() => {
                if (!result?.sections) return;
                navigator.clipboard.writeText(JSON.stringify(result.sections, null, 2));
              }}
              renderEmpty={renderEmpty}
              renderCitationAction={renderCitationAction}
              focusSentences={focusSentences}
              formatIdRanges={formatIdRanges}
              formatCitationLabel={formatCitationLabel}
              LabelPill={LabelPill}
              focusedCitationKeys={focusedCitationKeys}
              setFocusedCitationKeys={setFocusedCitationKeys}
              headerStatus={pass2Status}
              showSentenceActions={false}
            />
          </section>

          {showCorePdf && (
            <div className="lg:sticky lg:top-6 lg:self-start">
              <PdfViewerCard
                canCompile={
                  pdfTab === 'original'
                    ? !!file || !!result?.original_latex
                    : expandedAudienceHighlightIds.length > 0
                }
                status={pdfStatus}
                pdfUrl={pdfUrl}
                onCompile={() => {
                  if (!texEnabled) return;
                  void compilePdf({ force: true });
                }}
                selectedTab={pdfTab}
                onTabChange={handlePdfTabChange}
                showToggle={isAudiencePage}
                focusSentenceIndex={focusSentenceIndex}
                totalSentences={sentenceOrder.length || undefined}
                showCompile={texEnabled}
              />
            </div>
          )}
        </main>
      )}

      <footer className="mx-auto max-w-6xl px-6 pb-10 text-xs text-zinc-500" />
    </div>
  );
}
