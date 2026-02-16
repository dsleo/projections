'use client';

import type { DiscourseLabel } from '@/lib/pipeline/client';
import { LABEL_COLORS } from '@/lib/ui/labels';
import { classNames } from '@/lib/ui/classNames';

type Props = {
  resultExists: boolean;
  labelCounts: Record<DiscourseLabel, number>;
  unlabeledCount: number;
  labelFilter: DiscourseLabel[];
  showUnlabeledOnly: boolean;
  onToggleUnlabeled: () => void;
  onToggleLabelFilter: (label: DiscourseLabel) => void;
  onClearFilters: () => void;
  setLabelFilter: (labels: DiscourseLabel[]) => void;
};

export function LabelFilterBar({
  resultExists,
  labelCounts,
  unlabeledCount,
  labelFilter,
  showUnlabeledOnly,
  onToggleUnlabeled,
  onToggleLabelFilter,
  onClearFilters,
  setLabelFilter,
}: Props) {
  return (
    <div className="border-b px-4 py-2 text-xs text-zinc-600 flex flex-wrap items-center gap-2">
      {resultExists &&
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
  );
}
