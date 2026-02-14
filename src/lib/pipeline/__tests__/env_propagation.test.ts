import { describe, expect, it } from 'vitest';

import type { Sentence, SentenceLabelMap } from '@/lib/pipeline/types';
import {
  expandSentenceIdsByEnvironment,
  getEnvironmentRanges,
  propagateLabelsByEnvironment,
} from '@/lib/pipeline/env_propagation';

function span(latex: string, snippet: string, fromIndex = 0) {
  const start = latex.indexOf(snippet, fromIndex);
  if (start === -1) throw new Error(`snippet not found: ${snippet}`);
  return { start, end: start + snippet.length };
}

function makeSentences(latex: string): Sentence[] {
  const s1 = span(latex, 'Before.');
  const s2 = span(latex, 'A.');
  const s3 = span(latex, 'B.');
  const s4 = span(latex, 'After.');
  return [
    { id: 1, text: 'Before.', position: 0, original_start: s1.start, original_end: s1.end },
    { id: 2, text: 'A.', position: 1, original_start: s2.start, original_end: s2.end },
    { id: 3, text: 'B.', position: 2, original_start: s3.start, original_end: s3.end },
    { id: 4, text: 'After.', position: 3, original_start: s4.start, original_end: s4.end },
  ];
}

describe('env propagation helpers', () => {
  const latex = [
    'Before.',
    '\\begin{theorem}',
    'A.',
    'B.',
    '\\end{theorem}',
    'After.',
  ].join('\n');

  it('detects environment ranges', () => {
    const ranges = getEnvironmentRanges(latex, ['theorem']);
    expect(ranges.length).toBe(1);
    expect(latex.slice(ranges[0].start, ranges[0].end)).toContain('\\begin{theorem}');
    expect(latex.slice(ranges[0].start, ranges[0].end)).toContain('\\end{theorem}');
  });

  it('expands sentence ids within the same environment', () => {
    const sentences = makeSentences(latex);
    const expanded = expandSentenceIdsByEnvironment(latex, sentences, [2], ['theorem']);
    expect(expanded).toEqual([2, 3]);
  });

  it('propagates labels to all sentences in an environment', () => {
    const sentences = makeSentences(latex);
    const labels: SentenceLabelMap = { '2': ['Contribution'] };
    const updated = propagateLabelsByEnvironment(latex, sentences, labels, ['theorem']);
    expect(updated['2']).toEqual(['Contribution']);
    expect(updated['3']).toEqual(['Contribution']);
    expect(updated['1']).toBeUndefined();
    expect(updated['4']).toBeUndefined();
  });

  it('returns unchanged labels when no environments are present', () => {
    const plain = 'Before.\nA.\nB.\nAfter.';
    const sentences = makeSentences(plain);
    const labels: SentenceLabelMap = { '2': ['Contribution'] };
    const updated = propagateLabelsByEnvironment(plain, sentences, labels, ['theorem']);
    expect(updated).toEqual(labels);
  });
});
