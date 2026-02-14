import type { AnalysisResult } from '@/lib/pipeline/client';

export type CanonicalSectionTitles = {
  problem: string[];
  landscape: string[];
  contrib: string[];
  tech: string[];
  cons: string[];
};

export function extractSectionHeadings(latex: string) {
  const headings: Array<{ start: number; title: string }> = [];
  const re = /\\(section|subsection|subsubsection)\*?\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(latex))) {
    const title = match[2].replace(/\s+/g, ' ').trim();
    if (!title) continue;
    headings.push({ start: match.index, title });
  }
  return headings.sort((a, b) => a.start - b.start);
}

export function buildSentenceMap(result: AnalysisResult) {
  return new Map(result.sentences.map((s) => [s.id, s]));
}

export function sectionTitleForSentence(
  result: AnalysisResult,
  headings: Array<{ start: number; title: string }>,
  sentenceId: number,
  sentenceById: Map<number, AnalysisResult['sentences'][number]>
) {
  const sentence = sentenceById.get(sentenceId);
  if (!sentence) return null;
  const pos = sentence.original_start ?? sentence.start ?? 0;
  let current: string | null = null;
  for (const heading of headings) {
    if (heading.start > pos) break;
    current = heading.title;
  }
  return current;
}

export function sectionTitlesForSentenceIds(
  result: AnalysisResult,
  headings: Array<{ start: number; title: string }>,
  sentenceIds: number[],
  sentenceById: Map<number, AnalysisResult['sentences'][number]>
) {
  const counts = new Map<string, number>();
  for (const id of sentenceIds) {
    const title = sectionTitleForSentence(result, headings, id, sentenceById);
    if (!title) continue;
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([title]) => title)
    .slice(0, 2);
}

export function buildCanonicalSectionTitles(
  result: AnalysisResult,
  headings: Array<{ start: number; title: string }>,
  sentenceById: Map<number, AnalysisResult['sentences'][number]>
): CanonicalSectionTitles {
  const problemIds = [
    ...result.sections.problem_and_motivation.central_problems.flatMap((i) => i.sentence_ids),
    ...result.sections.problem_and_motivation.origins.flatMap((i) => i.sentence_ids),
    ...result.sections.problem_and_motivation.nontriviality.flatMap((i) => i.sentence_ids),
  ];
  const landscapeIds = [
    ...(result.sections.landscape.known_results ?? []).flatMap((i) => i.sentence_ids),
    ...(result.sections.landscape.limitations ?? []).flatMap((i) => i.sentence_ids),
    ...(result.sections.landscape.relations ?? []).flatMap((i) => i.sentence_ids),
  ];
  const contribIds = result.sections.contributions.contributions.flatMap(
    (i) => i.sentence_ids
  );
  const techIds = [
    ...(result.sections.technical_core.core_mechanisms ?? []).flatMap((i) => i.sentence_ids),
    ...(result.sections.technical_core.key_steps ?? []).flatMap((i) => i.sentence_ids),
    ...(result.sections.technical_core.reusable_constructions ?? []).flatMap((i) => i.sentence_ids),
  ];
  const consIds = [
    ...result.sections.consequences.open_questions.flatMap((i) => i.sentence_ids),
    ...result.sections.consequences.speculative_extensions.flatMap((i) => i.sentence_ids),
  ];

  return {
    problem: sectionTitlesForSentenceIds(result, headings, problemIds, sentenceById),
    landscape: sectionTitlesForSentenceIds(result, headings, landscapeIds, sentenceById),
    contrib: sectionTitlesForSentenceIds(result, headings, contribIds, sentenceById),
    tech: sectionTitlesForSentenceIds(result, headings, techIds, sentenceById),
    cons: sectionTitlesForSentenceIds(result, headings, consIds, sentenceById),
  };
}

export function renderReadingPathText(
  text: string,
  canonical: CanonicalSectionTitles
) {
  const replacements: Array<{ label: RegExp; titles: string[] }> = [
    { label: /Problem\s*&\s*Motivation/gi, titles: canonical.problem },
    { label: /Landscape/gi, titles: canonical.landscape },
    { label: /Contributions?/gi, titles: canonical.contrib },
    { label: /Technical\s*Core/gi, titles: canonical.tech },
    { label: /Consequences/gi, titles: canonical.cons },
  ];
  let updated = text;
  for (const { label, titles } of replacements) {
    if (!titles || titles.length === 0) continue;
    updated = updated.replace(label, (match) => {
      const suffix = ` (Sections: ${titles.join(', ')})`;
      return `${match}${suffix}`;
    });
  }
  return updated;
}

