import pLimit from 'p-limit';

import {
    ConsequencesSchema,
    ContributionsSchema,
    LandscapeSchema,
    ProblemAndMotivationSchema,
    TechnicalCoreSchema,
} from '../schemas';
import { callJson } from '../llm/call';
import {
    PASS2_CONSEQ_SYSTEM,
    PASS2_CONTRIB_SYSTEM,
    PASS2_LANDSCAPE_SYSTEM,
    PASS2_PROBLEM_SYSTEM,
    PASS2_TECH_SYSTEM,
    pass2UserPrompt,
} from '../llm/prompts';
import type { Logger } from '../logging';
import type {
    CanonicalSections,
    DiscourseLabel,
    Sentence,
    SentenceLabelMap,
} from './types';

function emptyProblem() {
    return { central_problems: [], origins: [], nontriviality: [] };
}

function emptyLandscape() {
    return { known_results: [], limitations: [], competing_approaches: [] };
}

function emptyContributions() {
    return { contributions: [] };
}

function emptyTechnicalCore() {
    return { key_ideas: [], technical_obstacles: [], reusable_constructions: [] };
}

function emptyConsequences() {
    return { open_questions: [], speculative_extensions: [] };
}

export type Pass2Options = {
    concurrency?: number;
    logger?: Logger;
    document_title?: string;
    abstract?: string;
};

function sentencesWithLabel(
    sentences: Sentence[],
    labels: SentenceLabelMap,
    label: DiscourseLabel
): Sentence[] {
    const sids = new Set(
        Object.entries(labels)
            .filter(([, labs]) => labs.includes(label))
            .map(([sid]) => Number(sid))
    );
    return sentences.filter((s) => sids.has(s.id));
}

function formatSentencesForPrompt(sentences: Sentence[]): string {
    return sentences.map((s) => `[${s.id}] ${s.text}`).join('\n');
}

function formatIdRanges(ids: number[]): string {
    if (ids.length === 0) return '[]';
    const sorted = Array.from(new Set(ids)).sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        const cur = sorted[i];
        if (cur === prev + 1) {
            prev = cur;
            continue;
        }
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = cur;
        prev = cur;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    return `[${ranges.join(', ')}]`;
}

export function renderSectionsConcatenated(sections: CanonicalSections): string {
    const lines: string[] = [];

    lines.push('# Problem & Motivation');
    for (const p of sections.problem_and_motivation.central_problems) {
        lines.push(`- Central problem: ${p.description} (ids: ${formatIdRanges(p.sentence_ids)})`);
    }
    for (const o of sections.problem_and_motivation.origins) {
        lines.push(`- Origin: ${o.description} (ids: ${formatIdRanges(o.sentence_ids)})`);
    }
    for (const n of sections.problem_and_motivation.nontriviality) {
        lines.push(`- Nontriviality: ${n.description} (ids: ${formatIdRanges(n.sentence_ids)})`);
    }

    lines.push('\n# Landscape');
    for (const k of sections.landscape.known_results) {
        lines.push(`- Known result: ${k.description} (ids: ${formatIdRanges(k.sentence_ids)})`);
    }
    for (const l of sections.landscape.limitations) {
        lines.push(`- Limitation: ${l.description} (ids: ${formatIdRanges(l.sentence_ids)})`);
    }
    for (const c of sections.landscape.competing_approaches) {
        lines.push(
            `- Competing approach: ${c.description} (ids: ${formatIdRanges(c.sentence_ids)})`
        );
    }

    lines.push('\n# Contributions');
    for (const c of sections.contributions.contributions) {
        lines.push(`- ${c.statement} (ids: ${formatIdRanges(c.sentence_ids)})`);
        if (c.prior_state.text) {
            lines.push(
                `  - Prior: ${c.prior_state.text} (ids: ${formatIdRanges(
                    c.prior_state.sentence_ids
                )})`
            );
        }
        if (c.novelty.text) {
            lines.push(
                `  - Novelty: ${c.novelty.text} (ids: ${formatIdRanges(
                    c.novelty.sentence_ids
                )})`
            );
        }
        if (c.nontriviality.text) {
            lines.push(
                `  - Nontriviality: ${c.nontriviality.text} (ids: ${formatIdRanges(
                    c.nontriviality.sentence_ids
                )})`
            );
        }
    }

    lines.push('\n# Technical Core');
    for (const k of sections.technical_core.key_ideas) {
        lines.push(`- Key idea: ${k.description} (ids: ${formatIdRanges(k.sentence_ids)})`);
    }
    for (const o of sections.technical_core.technical_obstacles) {
        lines.push(`- Obstacle: ${o.description} (ids: ${formatIdRanges(o.sentence_ids)})`);
    }
    for (const r of sections.technical_core.reusable_constructions) {
        lines.push(
            `- Reusable construction: ${r.description} (ids: ${formatIdRanges(r.sentence_ids)})`
        );
    }

    lines.push('\n# Consequences');
    for (const q of sections.consequences.open_questions) {
        lines.push(`- Open question: ${q.description} (ids: ${formatIdRanges(q.sentence_ids)})`);
    }
    for (const s of sections.consequences.speculative_extensions) {
        lines.push(
            `- Speculative extension: ${s.description} (ids: ${formatIdRanges(s.sentence_ids)})`
        );
    }

    return lines.join('\n');
}

export async function runPass2(
    sentences: Sentence[],
    labels: SentenceLabelMap,
    opts: Pass2Options = {}
): Promise<{ sections: CanonicalSections; sections_concatenated_text: string }> {
    const limit = pLimit(opts.concurrency ?? 5);

    opts.logger?.info('pass2:start', {
        sentences: sentences.length,
        labeled: Object.keys(labels).length,
    });

    const problemSentences = sentencesWithLabel(sentences, labels, 'Problem');
    const landscapeSentences = sentencesWithLabel(sentences, labels, 'Landscape');
    const contribSentences = sentencesWithLabel(sentences, labels, 'Contribution');
    const techSentences = sentencesWithLabel(sentences, labels, 'TechnicalCore');
    const conseqSentences = sentencesWithLabel(sentences, labels, 'Consequences');

    opts.logger?.info('pass2:label_counts', {
        Problem: problemSentences.length,
        Landscape: landscapeSentences.length,
        Contribution: contribSentences.length,
        TechnicalCore: techSentences.length,
        Consequences: conseqSentences.length,
    });

    const problemTask = limit(() =>
        problemSentences.length
            ? callJson({
                system: PASS2_PROBLEM_SYSTEM,
                user: pass2UserPrompt({
                    sentencesWithIds: formatSentencesForPrompt(problemSentences),
                    title: opts.document_title,
                    abstract: opts.abstract,
                }),
                schema: ProblemAndMotivationSchema,
                temperature: 0,
                maxRetries: 2,
                logger: opts.logger,
                name: 'pass2:problem_and_motivation',
            })
            : Promise.resolve(emptyProblem())
    );
    const landscapeTask = limit(() =>
        landscapeSentences.length
            ? callJson({
                system: PASS2_LANDSCAPE_SYSTEM,
                user: pass2UserPrompt({
                    sentencesWithIds: formatSentencesForPrompt(landscapeSentences),
                    title: opts.document_title,
                    abstract: opts.abstract,
                }),
                schema: LandscapeSchema,
                temperature: 0,
                maxRetries: 2,
                logger: opts.logger,
                name: 'pass2:landscape',
            })
            : Promise.resolve(emptyLandscape())
    );
    const contribTask = limit(() =>
        contribSentences.length
            ? callJson({
                system: PASS2_CONTRIB_SYSTEM,
                user: pass2UserPrompt({
                    sentencesWithIds: formatSentencesForPrompt(contribSentences),
                    title: opts.document_title,
                    abstract: opts.abstract,
                }),
                schema: ContributionsSchema,
                temperature: 0,
                maxRetries: 2,
                logger: opts.logger,
                name: 'pass2:contributions',
            })
            : Promise.resolve(emptyContributions())
    );
    const techTask = limit(() =>
        techSentences.length
            ? callJson({
                system: PASS2_TECH_SYSTEM,
                user: pass2UserPrompt({
                    sentencesWithIds: formatSentencesForPrompt(techSentences),
                    title: opts.document_title,
                    abstract: opts.abstract,
                }),
                schema: TechnicalCoreSchema,
                temperature: 0,
                maxRetries: 2,
                logger: opts.logger,
                name: 'pass2:technical_core',
            })
            : Promise.resolve(emptyTechnicalCore())
    );
    const conseqTask = limit(() =>
        conseqSentences.length
            ? callJson({
                system: PASS2_CONSEQ_SYSTEM,
                user: pass2UserPrompt({
                    sentencesWithIds: formatSentencesForPrompt(conseqSentences),
                    title: opts.document_title,
                    abstract: opts.abstract,
                }),
                schema: ConsequencesSchema,
                temperature: 0,
                maxRetries: 2,
                logger: opts.logger,
                name: 'pass2:consequences',
            })
            : Promise.resolve(emptyConsequences())
    );

    const [problem_and_motivation_raw, landscape_raw, contributions_raw, technical_core_raw, consequences_raw] =
        await Promise.all([problemTask, landscapeTask, contribTask, techTask, conseqTask]);

    const problemIds = new Set(problemSentences.map((s) => s.id));
    const landscapeIds = new Set(landscapeSentences.map((s) => s.id));
    const contribIds = new Set(contribSentences.map((s) => s.id));
    const techIds = new Set(techSentences.map((s) => s.id));
    const conseqIds = new Set(conseqSentences.map((s) => s.id));

    const filterIds = (ids: number[], allowed: Set<number>) =>
        ids.filter((id) => allowed.has(id));

    const sanitizeCanonicalItems = (
        items: CanonicalSections['problem_and_motivation']['central_problems'],
        allowed: Set<number>
    ) =>
        items.map((item) => ({
            ...item,
            sentence_ids: filterIds(item.sentence_ids, allowed),
        }));

    const sanitizeProblem = (section: CanonicalSections['problem_and_motivation']) => ({
        central_problems: sanitizeCanonicalItems(section.central_problems, problemIds),
        origins: sanitizeCanonicalItems(section.origins, problemIds),
        nontriviality: sanitizeCanonicalItems(section.nontriviality, problemIds),
    });

    const sanitizeLandscape = (section: CanonicalSections['landscape']) => ({
        known_results: sanitizeCanonicalItems(section.known_results, landscapeIds),
        limitations: sanitizeCanonicalItems(section.limitations, landscapeIds),
        competing_approaches: sanitizeCanonicalItems(section.competing_approaches, landscapeIds),
    });

    const sanitizeTechnicalCore = (section: CanonicalSections['technical_core']) => ({
        key_ideas: sanitizeCanonicalItems(section.key_ideas, techIds),
        technical_obstacles: sanitizeCanonicalItems(section.technical_obstacles, techIds),
        reusable_constructions: sanitizeCanonicalItems(section.reusable_constructions, techIds),
    });

    const sanitizeConsequences = (section: CanonicalSections['consequences']) => ({
        open_questions: sanitizeCanonicalItems(section.open_questions, conseqIds),
        speculative_extensions: sanitizeCanonicalItems(section.speculative_extensions, conseqIds),
    });

    const sanitizeContributions = (section: CanonicalSections['contributions']) => ({
        contributions: section.contributions.map((item) => ({
            ...item,
            sentence_ids: filterIds(item.sentence_ids, contribIds),
            prior_state: {
                ...item.prior_state,
                sentence_ids: filterIds(item.prior_state.sentence_ids, contribIds),
            },
            novelty: {
                ...item.novelty,
                sentence_ids: filterIds(item.novelty.sentence_ids, contribIds),
            },
            nontriviality: {
                ...item.nontriviality,
                sentence_ids: filterIds(item.nontriviality.sentence_ids, contribIds),
            },
        })),
    });

    const problem_and_motivation = sanitizeProblem(problem_and_motivation_raw);
    const landscape = sanitizeLandscape(landscape_raw);
    const contributions = sanitizeContributions(contributions_raw);
    const technical_core = sanitizeTechnicalCore(technical_core_raw);
    const consequences = sanitizeConsequences(consequences_raw);

    const sections: CanonicalSections = {
        problem_and_motivation,
        landscape,
        contributions,
        technical_core,
        consequences,
    };

    return {
        sections,
        sections_concatenated_text: renderSectionsConcatenated(sections),
    };
}
