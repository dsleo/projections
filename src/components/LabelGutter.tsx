'use client';

import type { DiscourseLabel } from '@/lib/pipeline/client';
import { LABEL_SWATCH } from '@/lib/ui/labels';

const LABEL_ORDER: DiscourseLabel[] = [
  'Problem',
  'Landscape',
  'Contribution',
  'TechnicalCore',
  'Consequences',
];

type Props = {
  labels: DiscourseLabel[];
  showUnlabeled: boolean;
};

export function LabelGutter({ labels, showUnlabeled }: Props) {
  const ordered = labels
    .slice()
    .sort((a, b) => LABEL_ORDER.indexOf(a) - LABEL_ORDER.indexOf(b));
  const visible = ordered.slice(0, 3);
  const extraCount = ordered.length - visible.length;

  if (ordered.length === 0 && !showUnlabeled) return null;

  return (
    <span className="label-tick-stack" aria-hidden>
      {ordered.length === 0 ? (
        <span className="label-tick label-tick-muted" />
      ) : (
        <>
          {visible.map((label) => (
            <span
              key={label}
              className="label-tick"
              style={{ backgroundColor: LABEL_SWATCH[label] }}
            />
          ))}
          {extraCount > 0 && <span className="label-tick label-tick-more">+</span>}
        </>
      )}
    </span>
  );
}
