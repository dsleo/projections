import { describe, expect, it } from 'vitest';

import {
  buildCanonicalSectionTitles,
  buildSentenceMap,
  extractSectionHeadings,
  renderReadingPathText,
} from '../sectionHints';
import type { AnalysisResult } from '../../pipeline/types';

function span(latex: string, snippet: string, fromIndex = 0) {
  const start = latex.indexOf(snippet, fromIndex);
  if (start === -1) throw new Error(`snippet not found: ${snippet}`);
  return { start, end: start + snippet.length };
}

describe('sectionHints', () => {
  it('maps internal labels to nearby section titles', () => {
    const latex = [
      '\\section{Intro}',
      'Intro sentence.',
      '\\section{Results}',
      'Result sentence.',
    ].join('\n');
    const s1 = span(latex, 'Intro sentence.');
    const s2 = span(latex, 'Result sentence.');
    const result: AnalysisResult = {
      document_title: 'Test',
      abstract: '',
      filename: 'test.tex',
      original_latex: latex,
      preprocessed_latex: latex,
      sentences: [
        { id: 1, text: 'Intro sentence.', position: 0, start: s1.start, end: s1.end, original_start: s1.start, original_end: s1.end },
        { id: 2, text: 'Result sentence.', position: 1, start: s2.start, end: s2.end, original_start: s2.start, original_end: s2.end },
      ],
      labels: {},
      sentence_citations: {},
      citations: {},
      sections: {
        problem_and_motivation: {
          central_problems: [{ description: 'x', sentence_ids: [1] }],
          origins: [],
          nontriviality: [],
        },
        landscape: { known_results: [], limitations: [], competing_approaches: [] },
        contributions: { contributions: [{ statement: 'x', sentence_ids: [2], prior_state: { text: '', sentence_ids: [] }, novelty: { text: '', sentence_ids: [] }, nontriviality: { text: '', sentence_ids: [] } }] },
        technical_core: { key_ideas: [], technical_obstacles: [], reusable_constructions: [] },
        consequences: { open_questions: [], speculative_extensions: [] },
      },
      sections_concatenated_text: '',
    };

    const headings = extractSectionHeadings(result.original_latex);
    const sentenceMap = buildSentenceMap(result);
    const canonical = buildCanonicalSectionTitles(result, headings, sentenceMap);
    const updated = renderReadingPathText('Read the Contributions first.', canonical);
    expect(updated).toContain('Sections: Results');
  });
});
