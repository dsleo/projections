import type { DiscourseLabel, Sentence, SentenceLabelMap } from './types';

export type CitationEntry = {
    key: string;
    label?: string;
    text: string;
    labels: DiscourseLabel[];
    sentence_ids: number[];
};

export type CitationMap = Record<string, CitationEntry>;
export type SentenceCitationMap = Record<string, string[]>;

const CITE_COMMAND = /\\cite[a-zA-Z*]*\s*(\[[^\]]*\]\s*)*\{([^}]+)\}/g;
const BIB_ENV = /\\begin\{thebibliography\}([\s\S]*?)\\end\{thebibliography\}/g;
const BIB_ITEM = /\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}/g;
const BIB_ITEM_WITH_LABEL = /\\bibitem\[([^\]]+)\]\{([^}]+)\}/;

function normalizeText(raw: string): string {
    return raw
        .replace(/\\[a-zA-Z*]+(?:\[[^\]]*\])?/g, '')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractBibliographyEntries(latex: string): CitationMap {
    const entries: CitationMap = {};
    let envMatch: RegExpExecArray | null;
    while ((envMatch = BIB_ENV.exec(latex))) {
        const content = envMatch[1] ?? '';
        const itemMatches = Array.from(content.matchAll(BIB_ITEM));
        for (let i = 0; i < itemMatches.length; i++) {
            const current = itemMatches[i];
            const key = current[1]?.trim();
            if (!key) continue;
            const start = current.index + current[0].length;
            const end = i + 1 < itemMatches.length ? itemMatches[i + 1].index : content.length;
            const rawEntry = content.slice(start, end);
            const labelMatch = current[0].match(BIB_ITEM_WITH_LABEL);
            const label = labelMatch?.[1]?.trim();
            entries[key] = {
                key,
                label,
                text: normalizeText(rawEntry),
                labels: [],
                sentence_ids: [],
            };
        }
    }
    return entries;
}

function extractCitationKeys(text: string): string[] {
    const keys: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = CITE_COMMAND.exec(text))) {
        const raw = match[2] ?? '';
        for (const part of raw.split(',')) {
            const key = part.trim();
            if (key) keys.push(key);
        }
    }
    return keys;
}

export function extractCitationsForSentences(
    latex: string,
    sentences: Sentence[]
): SentenceCitationMap {
    const sentenceCitations: SentenceCitationMap = {};
    for (const s of sentences) {
        const start = s.original_start ?? s.start ?? 0;
        const end = s.original_end ?? s.end ?? 0;
        if (end <= start) continue;
        const chunk = latex.slice(start, end);
        const keys = extractCitationKeys(chunk);
        if (keys.length > 0) {
            sentenceCitations[String(s.id)] = Array.from(new Set(keys));
        }
    }
    return sentenceCitations;
}

export function buildCitationData(
    latex: string,
    sentences: Sentence[],
    labels: SentenceLabelMap
): { sentence_citations: SentenceCitationMap; citations: CitationMap } {
    const citations = extractBibliographyEntries(latex);
    const sentence_citations = extractCitationsForSentences(latex, sentences);

    const citationLabels: Record<string, Set<DiscourseLabel>> = {};
    const citationSentenceIds: Record<string, Set<number>> = {};

    for (const [sid, keys] of Object.entries(sentence_citations)) {
        const sentenceLabels = labels[sid] ?? [];
        const sentenceId = Number(sid);
        for (const key of keys) {
            if (!citations[key]) {
                citations[key] = { key, text: '', labels: [], sentence_ids: [] };
            }
            const labelSet = (citationLabels[key] ??= new Set());
            for (const l of sentenceLabels) labelSet.add(l);
            const idSet = (citationSentenceIds[key] ??= new Set());
            idSet.add(sentenceId);
        }
    }

    for (const [key, entry] of Object.entries(citations)) {
        entry.labels = Array.from(citationLabels[key] ?? []);
        entry.sentence_ids = Array.from(citationSentenceIds[key] ?? []);
    }

    return { sentence_citations, citations };
}
