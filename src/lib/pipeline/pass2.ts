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

export function renderSectionsConcatenated(sections: CanonicalSections): string {
    const lines: string[] = [];

    lines.push('# Problem & Motivation');
    for (const p of sections.problem_and_motivation.central_problems) {
        lines.push(`- Central problem: ${p.description} (ids: ${p.sentence_ids.join(', ')})`);
    }
    for (const o of sections.problem_and_motivation.origins) {
        lines.push(`- Origin: ${o.description} (ids: ${o.sentence_ids.join(', ')})`);
    }
    for (const n of sections.problem_and_motivation.nontriviality) {
        lines.push(`- Nontriviality: ${n.description} (ids: ${n.sentence_ids.join(', ')})`);
    }

    lines.push('\n# Landscape');
    for (const k of sections.landscape.known_results) {
        lines.push(`- Known result: ${k.description} (ids: ${k.sentence_ids.join(', ')})`);
    }
    for (const l of sections.landscape.limitations) {
        lines.push(`- Limitation: ${l.description} (ids: ${l.sentence_ids.join(', ')})`);
    }
    for (const c of sections.landscape.competing_approaches) {
        lines.push(
            `- Competing approach: ${c.description} (ids: ${c.sentence_ids.join(', ')})`
        );
    }

    lines.push('\n# Contributions');
    for (const c of sections.contributions.contributions) {
        lines.push(`- ${c.statement} (ids: ${c.sentence_ids.join(', ')})`);
        if (c.prior_state) lines.push(`  - Prior: ${c.prior_state}`);
        if (c.novelty) lines.push(`  - Novelty: ${c.novelty}`);
        if (c.nontriviality) lines.push(`  - Nontriviality: ${c.nontriviality}`);
    }

    lines.push('\n# Technical Core');
    for (const k of sections.technical_core.key_ideas) {
        lines.push(`- Key idea: ${k.description} (ids: ${k.sentence_ids.join(', ')})`);
    }
    for (const o of sections.technical_core.technical_obstacles) {
        lines.push(`- Obstacle: ${o.description} (ids: ${o.sentence_ids.join(', ')})`);
    }
    for (const r of sections.technical_core.reusable_constructions) {
        lines.push(
            `- Reusable construction: ${r.description} (ids: ${r.sentence_ids.join(', ')})`
        );
    }

    lines.push('\n# Consequences');
    for (const q of sections.consequences.open_questions) {
        lines.push(`- Open question: ${q.description} (ids: ${q.sentence_ids.join(', ')})`);
    }
    for (const s of sections.consequences.speculative_extensions) {
        lines.push(
            `- Speculative extension: ${s.description} (ids: ${s.sentence_ids.join(', ')})`
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
                user: pass2UserPrompt(formatSentencesForPrompt(problemSentences)),
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
                user: pass2UserPrompt(formatSentencesForPrompt(landscapeSentences)),
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
                user: pass2UserPrompt(formatSentencesForPrompt(contribSentences)),
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
                user: pass2UserPrompt(formatSentencesForPrompt(techSentences)),
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
                user: pass2UserPrompt(formatSentencesForPrompt(conseqSentences)),
                schema: ConsequencesSchema,
                temperature: 0,
                maxRetries: 2,
                logger: opts.logger,
                name: 'pass2:consequences',
            })
            : Promise.resolve(emptyConsequences())
    );

    const [problem_and_motivation, landscape, contributions, technical_core, consequences] =
        await Promise.all([problemTask, landscapeTask, contribTask, techTask, conseqTask]);

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
