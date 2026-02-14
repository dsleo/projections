'use client';

import type { DiscourseLabel } from '@/lib/pipeline/client';
import { LABEL_COLORS } from '@/lib/ui/labels';
import { classNames } from '@/lib/ui/classNames';

type Props = {
  label: DiscourseLabel;
};

export function LabelPill({ label }: Props) {
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
