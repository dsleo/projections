'use client';

import type React from 'react';

import type { AnalysisResult, DiscourseLabel, Sentence } from '@/lib/pipeline/client';
import { LABEL_COLORS } from '@/lib/ui/labels';
import { classNames } from '@/lib/ui/classNames';
import { LabelPill } from '@/components/LabelPill';

type Props = {
  result: AnalysisResult | null;
  documentTitle: string;
  renderedOriginalText: Array<{ text: string; sentence: Sentence | null }> | null;
  labelCounts: Record<DiscourseLabel, number>;
  unlabeledCount: number;
  labelFilter: DiscourseLabel[];
  showUnlabeledOnly: boolean;
  envPropagationPrev: AnalysisResult['labels'] | null;
  envPropagationMsg: string;
  envPropagationDetails: string;
  useEnvPropagation: boolean;
  processingWindows: Array<{ start: number; end: number }>;
  highlightedIds: number[];
  textDetailsRef: React.RefObject<HTMLDetailsElement | null>;
  onToggleLabelFilter: (label: DiscourseLabel) => void;
  onClearFilters: () => void;
  onToggleUnlabeled: () => void;
  onApplyPropagation: () => void;
  onToggleUseEnvPropagation: (checked: boolean) => void;
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
  envPropagationPrev,
  envPropagationMsg,
  envPropagationDetails,
  useEnvPropagation,
  processingWindows,
  highlightedIds,
  textDetailsRef,
  onToggleLabelFilter,
  onClearFilters,
  onToggleUnlabeled,
  onApplyPropagation,
  onToggleUseEnvPropagation,
  onReRunPass1,
  isSentenceProcessing,
  focusSentences,
  setLabelFilter,
  setShowUnlabeledOnly,
}: Props) {
  return (
    <details ref={textDetailsRef} className="rounded-lg border bg-white" open>
      <summary className="list-none cursor-pointer border-b px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
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
            onToggleUnlabeled();
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
            onChange={(e) => onToggleUseEnvPropagation(e.target.checked)}
          />
          Propagate labels in environments
        </label>
        <button
          className="rounded-full border px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50"
          type="button"
          onClick={onApplyPropagation}
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
              onClick={() => onToggleLabelFilter(label)}
              type="button"
            >
              {label} · {labelCounts[label]}
            </button>
          ))}
        {(labelFilter.length > 0 || showUnlabeledOnly) && (
          <button
            className="rounded-full border px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50"
            onClick={onClearFilters}
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
