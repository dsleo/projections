import type { AnalysisResult } from '@/lib/pipeline/client';
import { getEnvironmentRanges } from '@/lib/pipeline/env_propagation';

const DISPLAY_ENVS = [
  'theorem',
  'lemma',
  'proposition',
  'corollary',
  'claim',
  'conjecture',
  'definition',
  'remark',
  'example',
  'proof',
  'algorithm',
] as const;
const STATEMENT_ENVS = [
  'theorem',
  'lemma',
  'proposition',
  'corollary',
  'claim',
  'conjecture',
  'definition',
  'remark',
  'example',
] as const;

type AudienceTab = 'A' | 'B' | 'C' | 'D';

export type SupportingTextSegment = { text: string; startId: number; endId: number };
export type SupportingTextResult = {
  abstract: string;
  segments: SupportingTextSegment[];
  sentenceIds: number[];
};

function stripInjectedLabels(value: string) {
  return value.replace(
    /(?:\s|[.;,])*?(Problem|Landscape|Contribution|TechnicalCore|Consequences)\s*$/g,
    ''
  );
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s$\\]/g, '')
    .trim();
}

function collectAudienceSentenceIds(
  audienceViews: NonNullable<AnalysisResult['audience_views']>,
  tab: AudienceTab
): number[] {
  const ids = new Set<number>();
  const add = (arr?: Array<{ sentence_ids?: number[] }>) => {
    if (!arr) return;
    for (const item of arr) {
      for (const id of item.sentence_ids ?? []) ids.add(id);
    }
  };
  const addOne = (item?: { sentence_ids?: number[] }) => {
    if (!item) return;
    for (const id of item.sentence_ids ?? []) ids.add(id);
  };
  const v = audienceViews;
  if (tab === 'A') {
    addOne(v.domain_expert.problem_statement);
    add(v.domain_expert.delta_summary);
    add(v.domain_expert.technical_highlights.nonstandard_ideas);
    add(v.domain_expert.technical_highlights.clever_reductions);
    add(v.domain_expert.reusable_components);
  } else if (tab === 'B') {
    addOne(v.adjacent_researcher.problem_statement);
    add(v.adjacent_researcher.why_matters);
  } else if (tab === 'C') {
    addOne(v.grad_student.problem_statement);
    add(v.grad_student.key_ideas);
  } else if (tab === 'D') {
    addOne(v.author_self.problem_statement);
  }
  return Array.from(ids).sort((a, b) => a - b);
}

export function buildAudienceSupportingText(
  result: AnalysisResult,
  tab: AudienceTab
): SupportingTextResult {
  const baseIds = collectAudienceSentenceIds(result.audience_views!, tab);
  const byId = new Map(result.sentences.map((s) => [s.id, s.text]));
  const abstract = result.abstract?.trim() ?? '';
  const abstractNorm = abstract ? normalizeText(abstract) : '';
  const sentencesSorted = [...result.sentences].sort(
    (a, b) => (a.original_start ?? a.start ?? 0) - (b.original_start ?? b.start ?? 0)
  );
  const selectedIds = new Set(baseIds);
  const filteredBaseIds = baseIds.filter((id) => {
    const sentence = byId.get(id) ?? '';
    if (!sentence) return false;
    if (!abstractNorm) return true;
    const sentNorm = normalizeText(sentence);
    if (!sentNorm) return false;
    return !abstractNorm.includes(sentNorm);
  });

  const ranges = getEnvironmentRanges(result.original_latex, DISPLAY_ENVS).sort(
    (a, b) => a.start - b.start
  );
  const selectedEnvInfos = ranges
    .map((range) => {
      const sentenceIds = sentencesSorted
        .filter((s) => {
          const start = s.original_start ?? s.start ?? 0;
          const end = s.original_end ?? s.end ?? 0;
          return start < range.end && end > range.start;
        })
        .map((s) => s.id);
      if (sentenceIds.length === 0) return null;
      const hasSelected = sentenceIds.some((id) => selectedIds.has(id));
      if (!hasSelected) return null;
      return {
        range,
        sentenceIds,
        text: result.original_latex.slice(range.start, range.end),
      };
    })
    .filter(Boolean) as Array<{
    range: { name: string; start: number; end: number };
    sentenceIds: number[];
    text: string;
  }>;

  if (selectedEnvInfos.length > 0) {
    const selectedKeys = new Set(
      selectedEnvInfos.map((env) => `${env.range.start}-${env.range.end}`)
    );
    const proofEnvs = selectedEnvInfos.filter((env) => env.range.name === 'proof');
    for (const proofEnv of proofEnvs) {
      const statementEnv = [...ranges]
        .filter((r) => STATEMENT_ENVS.includes(r.name) && r.end <= proofEnv.range.start)
        .sort((a, b) => b.end - a.end)[0];
      if (!statementEnv) continue;
      const key = `${statementEnv.start}-${statementEnv.end}`;
      if (selectedKeys.has(key)) continue;
      const sentenceIds = sentencesSorted
        .filter((s) => {
          const start = s.original_start ?? s.start ?? 0;
          const end = s.original_end ?? s.end ?? 0;
          return start < statementEnv.end && end > statementEnv.start;
        })
        .map((s) => s.id);
      if (sentenceIds.length === 0) continue;
      selectedEnvInfos.push({
        range: statementEnv,
        sentenceIds,
        text: result.original_latex.slice(statementEnv.start, statementEnv.end),
      });
      selectedKeys.add(key);
    }
  }

  const sentenceToEnv = new Map<number, { key: string; sentenceIds: number[]; text: string }>();
  for (const env of selectedEnvInfos) {
    const key = `${env.range.start}-${env.range.end}`;
    for (const id of env.sentenceIds) {
      const existing = sentenceToEnv.get(id);
      if (
        !existing ||
        env.range.end - env.range.start >
          parseInt(existing.key.split('-')[1], 10) -
            parseInt(existing.key.split('-')[0], 10)
      ) {
        sentenceToEnv.set(id, { key, sentenceIds: env.sentenceIds, text: env.text });
      }
    }
  }

  const renderedEnvKeys = new Set<string>();
  const segments: SupportingTextSegment[] = [];
  const outputIds = new Set<number>();
  for (const s of sentencesSorted) {
    const env = sentenceToEnv.get(s.id);
    if (env) {
      if (renderedEnvKeys.has(env.key)) continue;
      renderedEnvKeys.add(env.key);
      const sortedEnvIds = Array.from(new Set(env.sentenceIds)).sort((a, b) => a - b);
      for (const id of sortedEnvIds) outputIds.add(id);
      segments.push({
        text: env.text,
        startId: sortedEnvIds[0],
        endId: sortedEnvIds[sortedEnvIds.length - 1],
      });
      continue;
    }
    const isSelected = selectedIds.has(s.id);
    if (!isSelected) continue;
    const isDuplicate =
      abstractNorm.length > 0 &&
      (() => {
        const sentence = byId.get(s.id) ?? '';
        if (!sentence) return false;
        const sentNorm = normalizeText(sentence);
        if (!sentNorm) return false;
        return abstractNorm.includes(sentNorm);
      })();
    const allowDuplicate = filteredBaseIds.length === 0;
    if (!isDuplicate || allowDuplicate) {
      outputIds.add(s.id);
      segments.push({
        text: stripInjectedLabels(byId.get(s.id) ?? ''),
        startId: s.id,
        endId: s.id,
      });
    }
  }

  return { abstract, segments, sentenceIds: Array.from(outputIds).sort((a, b) => a - b) };
}
