import { describe, expect, it } from 'vitest';

import type { AnalysisResult } from '@/lib/pipeline/client';
import {
  formatCitationLabel,
  getCitationEntries,
  getCitationKeysForSentenceIds,
} from '@/lib/ui/citations';

const baseResult = {
  citations: {
    A: { key: 'A', label: 'Doe 2020', text: 'Doe, J. (2020). Title.' },
    B: { key: 'B', text: 'Smith, J., Another (2019).' },
  },
  sentence_citations: {
    '1': ['A', 'B'],
    '2': ['A'],
  },
} as AnalysisResult;

describe('citations helpers', () => {
  it('collects unique keys per sentence ids', () => {
    expect(getCitationKeysForSentenceIds(baseResult, [1, 2]).sort()).toEqual(['A', 'B']);
  });

  it('resolves citation entries by key', () => {
    const entries = getCitationEntries(baseResult, ['A', 'B']);
    expect(entries.map((e) => e.key).sort()).toEqual(['A', 'B']);
  });

  it('formats labels with fallback', () => {
    expect(formatCitationLabel(baseResult.citations.A)).toBe('Doe 2020');
    expect(formatCitationLabel(baseResult.citations.B)).toBe('Smith 2019');
  });
});
