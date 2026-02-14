import { describe, expect, it } from 'vitest';

import { formatIdRanges } from '@/lib/ui/idRanges';

describe('formatIdRanges', () => {
  it('returns empty brackets for empty input', () => {
    expect(formatIdRanges([])).toBe('[]');
  });

  it('coalesces contiguous ranges', () => {
    expect(formatIdRanges([3, 1, 2, 5, 7, 8, 10])).toBe('[1-3, 5, 7-8, 10]');
  });

  it('dedupes ids before formatting', () => {
    expect(formatIdRanges([2, 2, 3, 3, 4])).toBe('[2-4]');
  });
});
