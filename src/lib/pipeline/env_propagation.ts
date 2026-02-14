import type { DiscourseLabel, Sentence, SentenceLabelMap } from './types';

export const DEFAULT_PROPAGATION_ENVS = [
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
    'equation',
    'equation*',
    'align',
    'align*',
    'gather',
    'gather*',
    'multline',
    'multline*',
    'eqnarray',
    'eqnarray*',
    'cases',
] as const;

type EnvRange = { name: string; start: number; end: number };

function findEnvironmentRanges(latex: string, envNames: Set<string>): EnvRange[] {
    const ranges: EnvRange[] = [];
    const stack: Array<{ name: string; start: number }> = [];
    const re = /\\(begin|end)\{([^}]+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(latex))) {
        const kind = match[1];
        const name = match[2];
        if (!envNames.has(name)) continue;
        if (kind === 'begin') {
            stack.push({ name, start: match.index });
        } else {
            for (let i = stack.length - 1; i >= 0; i--) {
                if (stack[i].name === name) {
                    const { start } = stack[i];
                    stack.splice(i, 1);
                    const end = match.index + match[0].length;
                    ranges.push({ name, start, end });
                    break;
                }
            }
        }
    }
    return ranges;
}

export function getEnvironmentRanges(
    latex: string,
    envList: readonly string[] = DEFAULT_PROPAGATION_ENVS
): EnvRange[] {
    const envNames = new Set(envList);
    return findEnvironmentRanges(latex, envNames);
}

function sentenceIntersectsRange(sentence: Sentence, range: EnvRange): boolean {
    const start = sentence.original_start ?? sentence.start ?? 0;
    const end = sentence.original_end ?? sentence.end ?? 0;
    if (end <= start) return false;
    return start < range.end && end > range.start;
}

export function expandSentenceIdsByEnvironment(
    latex: string,
    sentences: Sentence[],
    sentenceIds: number[],
    envList: readonly string[] = DEFAULT_PROPAGATION_ENVS
): number[] {
    if (!sentenceIds || sentenceIds.length === 0) return [];
    const envNames = new Set(envList);
    const ranges = findEnvironmentRanges(latex, envNames);
    if (ranges.length === 0) return Array.from(new Set(sentenceIds)).sort((a, b) => a - b);

    const selected = new Set(sentenceIds);
    const expanded = new Set<number>(sentenceIds);
    for (const range of ranges) {
        const inRange = sentences.filter((s) => sentenceIntersectsRange(s, range));
        if (inRange.length === 0) continue;
        const hasSelected = inRange.some((s) => selected.has(s.id));
        if (!hasSelected) continue;
        for (const s of inRange) expanded.add(s.id);
    }
    return Array.from(expanded).sort((a, b) => a - b);
}

export function propagateLabelsByEnvironment(
    latex: string,
    sentences: Sentence[],
    labels: SentenceLabelMap,
    envList: readonly string[] = DEFAULT_PROPAGATION_ENVS
): SentenceLabelMap {
    const envNames = new Set(envList);
    const ranges = findEnvironmentRanges(latex, envNames);
    if (ranges.length === 0) return labels;

    const result: SentenceLabelMap = { ...labels };

    for (const range of ranges) {
        const inRange = sentences.filter((s) => sentenceIntersectsRange(s, range));
        if (inRange.length === 0) continue;
        const labelSet = new Set<DiscourseLabel>();
        for (const s of inRange) {
            const labs = result[String(s.id)] ?? [];
            for (const l of labs) labelSet.add(l);
        }
        if (labelSet.size === 0) continue;
        const merged = Array.from(labelSet);
        for (const s of inRange) {
            result[String(s.id)] = merged;
        }
    }

    return result;
}
