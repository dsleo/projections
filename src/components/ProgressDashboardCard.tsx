'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AnalyzeStatus } from '@/lib/ui/useAnalyzeStream';
import { TRIVIA_ITEMS } from '@/lib/ui/trivia';

const formatRange = (low: number, high: number) => {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return 'Estimating…';
  if (high <= 0) return 'Less than a minute';
  const min = Math.max(1, Math.round(low / 60));
  const max = Math.max(1, Math.round(high / 60));
  return min === max ? `~${min} min` : `~${min}–${max} min`;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function TriviaRotator() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % TRIVIA_ITEMS.length);
    }, 9000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--paper)] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
        While you wait
      </div>
      <div className="mt-2 text-sm text-[color:var(--ink)]">{TRIVIA_ITEMS[index]}</div>
      <div className="mt-3 text-xs text-[color:var(--muted)]">
        Clear summaries reduce the time to first understanding.
      </div>
    </div>
  );
}

type Props = {
  status: AnalyzeStatus;
  totalWindows: number | null;
  completedWindows: number;
  processingWindows: Array<{ start: number; end: number }>;
  sentencesCount: number;
  readyToView?: boolean;
  onViewSummaries?: () => void;
  completed?: boolean;
  showTrivia?: boolean;
};

export function ProgressDashboardCard({
  status,
  totalWindows,
  completedWindows,
  processingWindows,
  sentencesCount,
  readyToView = false,
  onViewSummaries,
  completed = false,
  showTrivia = true,
}: Props) {
  const phase =
    status.kind === 'analyzing'
      ? status.phase
      : status.kind === 'uploading'
        ? 'pass1'
        : null;

  const progressFraction = useMemo(() => {
    if (phase === 'pass1' && totalWindows) {
      return clamp(completedWindows / totalWindows, 0, 1);
    }
    if (phase === 'pass2') return 0.7;
    if (phase === 'pass3') return 0.9;
    if (status.kind === 'done') return 1;
    return 0.1;
  }, [phase, totalWindows, completedWindows, status.kind]);

  const eta = useMemo(() => {
    if (!phase) return 'Estimating…';
    if (phase === 'pass1') {
      if (!totalWindows) return 'Estimating…';
      const remaining = Math.max(totalWindows - completedWindows, 0);
      return formatRange(remaining * 4, remaining * 6);
    }
    if (phase === 'pass2') {
      const base = Math.max(8, (sentencesCount / 50) * 2);
      return formatRange(base * 0.7, base * 1.3);
    }
    if (phase === 'pass3') {
      return formatRange(10, 20);
    }
    return 'Estimating…';
  }, [phase, totalWindows, completedWindows, sentencesCount]);

  const statusLine =
    status.kind === 'analyzing'
      ? status.phase === 'pass1'
        ? 'Classifying sentences…'
        : status.phase === 'pass2'
          ? 'Structuring canonical sections…'
          : 'Generating audience summaries…'
      : status.kind === 'uploading'
        ? 'Uploading your TeX source…'
        : 'Preparing your summaries…';

  const accentClass = completed ? 'bg-emerald-600' : 'bg-[color:var(--accent)]';
  const badgeText = completed ? 'Completed' : null;
  const badgeClass = completed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : '';

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-[color:var(--border)] bg-white/80 p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Building audience-ready summaries
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="text-2xl font-semibold text-[color:var(--ink)]">
            Audience summaries
          </div>
          {badgeText && (
            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${badgeClass}`}>
              {badgeText}
            </span>
          )}
          {readyToView && (
            <button
              type="button"
              onClick={onViewSummaries}
              className="ml-auto inline-flex items-center rounded-full border border-emerald-200 bg-emerald-600 px-4 py-2 text-sm text-white shadow-sm transition hover:opacity-90 animate-pulse"
            >
              View summaries
            </button>
          )}
        </div>
        <div className="mt-2 text-sm text-[color:var(--muted)]">
          {completed ? 'Summaries are ready.' : statusLine}
        </div>

        {!completed && (
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-[color:var(--muted)]">
              <span>Estimated remaining</span>
              <span className="font-semibold text-[color:var(--ink)]">{eta}</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[color:var(--highlight)]">
              <div
                className={`h-full rounded-full transition-all ${accentClass}`}
                style={{ width: `${Math.round(progressFraction * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm" />
      </div>
      {showTrivia && <TriviaRotator />}
    </div>
  );
}
