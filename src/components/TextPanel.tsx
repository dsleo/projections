'use client';

import type React from 'react';
import { PanelRight, RefreshCw } from 'lucide-react';

import type { AnalysisResult, DiscourseLabel, Sentence } from '@/lib/pipeline/client';
import { classNames } from '@/lib/ui/classNames';
import { IconButton } from '@/components/IconButton';
import { LabelPill } from '@/components/LabelPill';
import { LabelFilterBar } from '@/components/LabelFilterBar';

type Props = {
  result: AnalysisResult | null;
  documentTitle: string;
  renderedOriginalText: Array<{ text: string; sentence: Sentence | null }> | null;
  labelCounts: Record<DiscourseLabel, number>;
  labelFilter: DiscourseLabel[];
  processingWindows: Array<{ start: number; end: number }>;
  headerStatus?: React.ReactNode;
  highlightedIds: number[];
  textDetailsRef: React.RefObject<HTMLDetailsElement | null>;
  onToggleLabelFilter: (label: DiscourseLabel) => void;
  onClearFilters: () => void;
  onReRunPass1: () => void;
  showViewerButton?: boolean;
  isViewerOpen?: boolean;
  onToggleViewer?: () => void;
  isSentenceProcessing: (position: number) => boolean;
};

export function TextPanel({
  result,
  documentTitle,
  renderedOriginalText,
  labelCounts,
  labelFilter,
  processingWindows,
  headerStatus,
  highlightedIds,
  textDetailsRef,
  onToggleLabelFilter,
  onClearFilters,
  onReRunPass1,
  showViewerButton = false,
  isViewerOpen = false,
  onToggleViewer,
  isSentenceProcessing,
}: Props) {
  return (
    <details
      ref={textDetailsRef}
      className="rounded-2xl border border-[color:var(--border)] bg-white/80"
      open
    >
      <summary className="list-none cursor-pointer border-b border-[color:var(--border)] px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <span>{documentTitle}</span>
            <span
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="inline-flex"
            >
              <IconButton
                icon={RefreshCw}
                label="Re-run Pass 1"
                onClick={onReRunPass1}
                disabled={!result || processingWindows.length > 0}
                size="sm"
              />
            </span>

            {showViewerButton && (
              <span
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="inline-flex"
              >
                <IconButton
                  icon={PanelRight}
                  label={isViewerOpen ? 'Hide document viewer' : 'Show document viewer'}
                  onClick={onToggleViewer}
                  disabled={!onToggleViewer}
                  size="sm"
                  className={isViewerOpen ? 'text-zinc-900 border-zinc-300' : undefined}
                />
              </span>
            )}
          </span>
          {headerStatus && (
            <span className="text-xs font-normal text-[color:var(--muted)]">{headerStatus}</span>
          )}
        </div>
      </summary>
      <LabelFilterBar
        resultExists={Boolean(result)}
        labelCounts={labelCounts}
        labelFilter={labelFilter}
        onToggleLabelFilter={onToggleLabelFilter}
        onClearFilters={onClearFilters}
      />
      <div className="max-h-[70vh] overflow-auto">
        {!result && (
          <div className="p-4 text-sm text-[color:var(--muted)]">
            Upload a .tex file to begin.
          </div>
        )}
        {result && (
          <div className="p-4 text-sm leading-7 whitespace-pre-wrap">
            {(() => {
              if (!renderedOriginalText) return null;
              const rendered: React.ReactNode[] = [];
              let lastRenderedSentenceId: number | null = null;
              renderedOriginalText.forEach((seg, idx) => {
                if (!seg.sentence) {
                  if (labelFilter.length > 0) return;
                  rendered.push(<span key={`plain-${idx}`}>{seg.text}</span>);
                  return;
                }
                const labels = result.labels[String(seg.sentence.id)] ?? [];
                if (labelFilter.length > 0 && !labels.some((l) => labelFilter.includes(l))) {
                  return;
                }
                const shouldShowGap =
                  labelFilter.length > 0 &&
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
                      {labels.length > 0 && labelFilter.length === 0 && (
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
