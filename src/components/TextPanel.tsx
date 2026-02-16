'use client';

import type React from 'react';

import type { AnalysisResult, DiscourseLabel, Sentence } from '@/lib/pipeline/client';
import { classNames } from '@/lib/ui/classNames';
import { LabelPill } from '@/components/LabelPill';
import { LabelFilterBar } from '@/components/LabelFilterBar';

type Props = {
  result: AnalysisResult | null;
  documentTitle: string;
  renderedOriginalText: Array<{ text: string; sentence: Sentence | null }> | null;
  labelCounts: Record<DiscourseLabel, number>;
  unlabeledCount: number;
  labelFilter: DiscourseLabel[];
  showUnlabeledOnly: boolean;
  processingWindows: Array<{ start: number; end: number }>;
  headerStatus?: React.ReactNode;
  highlightedIds: number[];
  textDetailsRef: React.RefObject<HTMLDetailsElement | null>;
  onToggleLabelFilter: (label: DiscourseLabel) => void;
  onClearFilters: () => void;
  onToggleUnlabeled: () => void;
  onReRunPass1: () => void;
  isSentenceProcessing: (position: number) => boolean;
  focusSentences: (ids: number[]) => void;
  setLabelFilter: (labels: DiscourseLabel[]) => void;
  setShowUnlabeledOnly: (value: boolean) => void;
};

export function TextPanel({
  result,
  documentTitle,
  renderedOriginalText,
  labelCounts,
  unlabeledCount,
  labelFilter,
  showUnlabeledOnly,
  processingWindows,
  headerStatus,
  highlightedIds,
  textDetailsRef,
  onToggleLabelFilter,
  onClearFilters,
  onToggleUnlabeled,
  onReRunPass1,
  isSentenceProcessing,
  focusSentences,
  setLabelFilter,
  setShowUnlabeledOnly,
}: Props) {
  return (
    <details ref={textDetailsRef} className="rounded-lg border bg-white" open>
      <summary className="list-none cursor-pointer border-b px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <span>{documentTitle}</span>
            <button
              className="rounded-full border px-2 py-0.5 text-[11px] font-normal text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onReRunPass1();
              }}
              disabled={!result || processingWindows.length > 0}
              aria-label="Re-run Pass 1"
              title="Re-run Pass 1"
            >
              ⟳
            </button>
          </span>
          {headerStatus && (
            <span className="text-xs font-normal text-zinc-500">{headerStatus}</span>
          )}
        </div>
      </summary>
      <LabelFilterBar
        resultExists={Boolean(result)}
        labelCounts={labelCounts}
        unlabeledCount={unlabeledCount}
        labelFilter={labelFilter}
        showUnlabeledOnly={showUnlabeledOnly}
        onToggleUnlabeled={onToggleUnlabeled}
        onToggleLabelFilter={onToggleLabelFilter}
        onClearFilters={onClearFilters}
        setLabelFilter={setLabelFilter}
      />
      <div className="max-h-[70vh] overflow-auto">
        {!result && <div className="p-4 text-sm text-zinc-500">Upload a .tex file to begin.</div>}
        {result && (
          <div className="p-4 text-sm leading-7 whitespace-pre-wrap">
            {(() => {
              if (!renderedOriginalText) return null;
              const rendered: React.ReactNode[] = [];
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
  );
}
