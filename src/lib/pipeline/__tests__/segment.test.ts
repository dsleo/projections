import { describe, expect, it } from 'vitest';

import { segmentSentences } from '@/lib/pipeline/segment';

describe('segmentSentences', () => {
  it('does not split inside common display math environments', () => {
    const latex = [
      'We prove the following.',
      '\\begin{align}',
      'a &= b. \\\\',
      'c &= d.',
      '\\end{align}',
      'This completes the setup.',
    ].join('\n');

    const sentences = segmentSentences(latex);

    expect(sentences.map((s) => s.text)).toEqual([
      'We prove the following.',
      [
        '\\begin{align}',
        'a &= b. \\\\',
        'c &= d.',
        '\\end{align}',
        'This completes the setup.',
      ].join('\n'),
    ]);
  });

  it('does not split inside inline math delimiters', () => {
    const latex = 'Let \\(f. g\\) be fixed. Now choose $x. y$. Done.';

    const sentences = segmentSentences(latex);

    expect(sentences.map((s) => s.text)).toEqual([
      'Let \\(f. g\\) be fixed.',
      'Now choose $x. y$.',
      'Done.',
    ]);
  });

  it('avoids common scholarly abbreviations', () => {
    const latex = 'See Fig. 2 for the construction. This proves the claim.';

    const sentences = segmentSentences(latex);

    expect(sentences.map((s) => s.text)).toEqual([
      'See Fig. 2 for the construction.',
      'This proves the claim.',
    ]);
  });
});
