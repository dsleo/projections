import { describe, expect, it } from 'vitest';

import type { AnalysisResult } from '@/lib/pipeline/client';
import {
  formatCitationLabel,
  getCitationEntries,
  getCitationKeysForSentenceIds,
} from '@/lib/ui/citations';

const baseResult: AnalysisResult = {
  document_title: 'Test',
  abstract: '',
  filename: 'test.tex',
  original_latex: '',
  preprocessed_latex: '',
  sentences: [],
  labels: {},
  citations: {
    A: { key: 'A', label: 'Doe 2020', text: 'Doe, J. (2020). Title.', labels: [], sentence_ids: [] },
    B: { key: 'B', text: 'Smith, J., Another (2019).', labels: [], sentence_ids: [] },
  },
  sentence_citations: {
    '1': ['A', 'B'],
    '2': ['A'],
  },
  sections: {
    problem_and_motivation: { central_problems: [], origins: [], nontriviality: [] },
    landscape: { known_results: [], limitations: [], competing_approaches: [] },
    contributions: { contributions: [] },
    technical_core: { key_ideas: [], technical_obstacles: [], reusable_constructions: [] },
    consequences: { open_questions: [], speculative_extensions: [] },
  },
  sections_concatenated_text: '',
  audience_views: undefined,
};

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
