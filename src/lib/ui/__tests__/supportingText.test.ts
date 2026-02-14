import { describe, expect, it } from 'vitest';

import { buildAudienceSupportingText } from '../supportingText';
import type { AnalysisResult } from '../../pipeline/types';

function span(latex: string, snippet: string, fromIndex?: number) {
  const start = latex.indexOf(snippet, fromIndex ?? 0);
  if (start === -1) throw new Error(`snippet not found: ${snippet}`);
  return { start, end: start + snippet.length };
}

function makeBaseResult(latex: string, snippets: string[]) {
  const spans = snippets.map((snippet, idx) =>
    span(latex, snippet, idx === 0 ? 0 : undefined)
  );
  return {
    document_title: 'Test',
    abstract: '',
    filename: 'test.tex',
    original_latex: latex,
    preprocessed_latex: latex,
    sentences: spans.map((s, i) => ({
      id: i + 1,
      text: snippets[i],
      start: s.start,
      end: s.end,
      original_start: s.start,
      original_end: s.end,
    })),
    labels: {},
    sentence_citations: {},
    citations: {},
    sections: {
      problem_and_motivation: { central_problems: [], origins: [], nontriviality: [] },
      landscape: { known_results: [], limitations: [], relations: [] },
      contributions: { contributions: [] },
      technical_core: { core_mechanisms: [], key_steps: [], reusable_constructions: [] },
      consequences: { open_questions: [], speculative_extensions: [] },
    },
    sections_concatenated_text: '',
  } satisfies AnalysisResult;
}

describe('buildAudienceSupportingText', () => {
  it('renders full theorem env when a sentence inside is selected', () => {
    const latex = [
      '\\begin{theorem}',
      'Statement line.',
      '\\begin{equation}',
      'a=b',
      '\\end{equation}',
      'More statement.',
      '\\end{theorem}',
    ].join('\n');
    const result = makeBaseResult(latex, ['Statement line.', 'a=b', 'More statement.']);
    const audience = {
      problem_statement: { text: 'x', sentence_ids: [2] },
      delta_summary: [],
      technical_highlights: { nonstandard_ideas: [], clever_reductions: [] },
      reusable_components: [],
    };
    result.audience_views = {
      domain_expert: audience,
      adjacent_researcher: {
        problem_statement: { text: 'x', sentence_ids: [] },
        why_matters: [],
        prerequisite_map: [],
        reading_path: { read: [], skim: [], skip: [] },
      },
      grad_student: {
        problem_statement: { text: 'x', sentence_ids: [] },
        key_ideas: [],
        conceptual_map: [],
        suggested_first_pass: [],
        ignore_initially: [],
        permission_to_skip: '',
      },
      author_self: {
        problem_statement: { text: 'x', sentence_ids: [] },
        one_page_summary: '',
        fragile_arguments: [],
        robust_arguments: [],
        notes_to_self: [],
      },
    };

    const { segments } = buildAudienceSupportingText(result, 'A');
    expect(segments.length).toBe(1);
    expect(segments[0].text).toContain('\\begin{theorem}');
    expect(segments[0].text).toContain('a=b');
  });

  it('adds the statement env when a proof is selected', () => {
    const latex = [
      '\\begin{theorem}',
      'Statement line.',
      '\\end{theorem}',
      '\\begin{proof}',
      'Proof line.',
      '\\end{proof}',
    ].join('\n');
    const result = makeBaseResult(latex, ['Statement line.', 'Proof line.']);
    const audience = {
      problem_statement: { text: 'x', sentence_ids: [] },
      delta_summary: [{ text: 'x', sentence_ids: [2] }],
      technical_highlights: { nonstandard_ideas: [], clever_reductions: [] },
      reusable_components: [],
    };
    result.audience_views = {
      domain_expert: audience,
      adjacent_researcher: {
        problem_statement: { text: 'x', sentence_ids: [] },
        why_matters: [],
        prerequisite_map: [],
        reading_path: { read: [], skim: [], skip: [] },
      },
      grad_student: {
        problem_statement: { text: 'x', sentence_ids: [] },
        key_ideas: [],
        conceptual_map: [],
        suggested_first_pass: [],
        ignore_initially: [],
        permission_to_skip: '',
      },
      author_self: {
        problem_statement: { text: 'x', sentence_ids: [] },
        one_page_summary: '',
        fragile_arguments: [],
        robust_arguments: [],
        notes_to_self: [],
      },
    };

    const { segments } = buildAudienceSupportingText(result, 'A');
    expect(segments.length).toBe(2);
    expect(segments[0].text).toContain('\\begin{theorem}');
    expect(segments[1].text).toContain('\\begin{proof}');
  });
});
