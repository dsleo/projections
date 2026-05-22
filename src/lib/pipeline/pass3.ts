import pLimit from 'p-limit';

import {
    Pass3AudienceASchema,
    Pass3AudienceBSchema,
    Pass3AudienceCSchema,
    Pass3AudienceDSchema,
} from '../schemas';
import { callJson } from '../llm/call';
import {
    PASS3_AUDIENCE_A_SYSTEM,
    PASS3_AUDIENCE_B_SYSTEM,
    PASS3_AUDIENCE_C_SYSTEM,
    PASS3_AUDIENCE_D_SYSTEM,
    pass3UserPrompt,
} from '../llm/prompts';
import type { Logger } from '../logging';
import type {
    CanonicalSections,
    CitationMap,
    GroundedCitationItem,
    Pass3Views,
    Sentence,
    SentenceCitationMap,
} from './types';

export type Pass3Options = {
    concurrency?: number;
    logger?: Logger;
    document_title?: string;
    abstract?: string;
    citations: CitationMap;
    sentence_citations: SentenceCitationMap;
    sentences: Sentence[];
    original_latex: string;
};

function formatCanonicalWithCitations(sections: CanonicalSections): string {
    const lines: string[] = [];

    const pushItems = (label: string, items: { description: string; sentence_ids: number[] }[]) => {
        for (const item of items) {
            lines.push(`- ${label}: ${item.description}`);
            lines.push(`  sentence_ids: ${item.sentence_ids.join(', ')}`);
        }
    };

    lines.push('# Problem & Motivation');
    pushItems('Central problem', sections.problem_and_motivation.central_problems);
    pushItems('Origin', sections.problem_and_motivation.origins);
    pushItems('Nontriviality', sections.problem_and_motivation.nontriviality);

    lines.push('\n# Landscape');
    pushItems('Known result', sections.landscape.known_results);
    pushItems('Limitation', sections.landscape.limitations);
    pushItems('Competing approach', sections.landscape.competing_approaches);

    lines.push('\n# Contributions');
    for (const c of sections.contributions.contributions) {
        lines.push(`- Contribution: ${c.statement}`);
        lines.push(`  sentence_ids: ${c.sentence_ids.join(', ')}`);
        if (c.prior_state.text) {
            lines.push(`  prior_state: ${c.prior_state.text}`);
            lines.push(`  sentence_ids: ${c.prior_state.sentence_ids.join(', ')}`);
        }
        if (c.novelty.text) {
            lines.push(`  novelty: ${c.novelty.text}`);
            lines.push(`  sentence_ids: ${c.novelty.sentence_ids.join(', ')}`);
        }
        if (c.nontriviality.text) {
            lines.push(`  nontriviality: ${c.nontriviality.text}`);
            lines.push(`  sentence_ids: ${c.nontriviality.sentence_ids.join(', ')}`);
        }
    }

    lines.push('\n# Technical Core');
    pushItems('Key idea', sections.technical_core.key_ideas);
    pushItems('Technical obstacle', sections.technical_core.technical_obstacles);
    pushItems('Reusable construction', sections.technical_core.reusable_constructions);

    lines.push('\n# Consequences');
    pushItems('Open question', sections.consequences.open_questions);
    pushItems('Speculative extension', sections.consequences.speculative_extensions);

    return lines.join('\n');
}

function collectAllowedSentenceIds(sections: CanonicalSections): Set<number> {
    const ids = new Set<number>();
    const add = (values: number[]) => values.forEach((id) => ids.add(id));

    for (const item of sections.problem_and_motivation.central_problems) add(item.sentence_ids);
    for (const item of sections.problem_and_motivation.origins) add(item.sentence_ids);
    for (const item of sections.problem_and_motivation.nontriviality) add(item.sentence_ids);
    for (const item of sections.landscape.known_results) add(item.sentence_ids);
    for (const item of sections.landscape.limitations) add(item.sentence_ids);
    for (const item of sections.landscape.competing_approaches) add(item.sentence_ids);
    for (const item of sections.contributions.contributions) {
        add(item.sentence_ids);
        add(item.prior_state.sentence_ids);
        add(item.novelty.sentence_ids);
        add(item.nontriviality.sentence_ids);
    }
    for (const item of sections.technical_core.key_ideas) add(item.sentence_ids);
    for (const item of sections.technical_core.technical_obstacles) add(item.sentence_ids);
    for (const item of sections.technical_core.reusable_constructions) add(item.sentence_ids);
    for (const item of sections.consequences.open_questions) add(item.sentence_ids);
    for (const item of sections.consequences.speculative_extensions) add(item.sentence_ids);

    return ids;
}

function sanitizeGroundedItem(
    item: GroundedCitationItem,
    allowedIds: Set<number>
): GroundedCitationItem {
    const sentence_ids = Array.from(new Set(item.sentence_ids.filter((id) => allowedIds.has(id))));
    return {
        ...item,
        sentence_ids,
        text: sentence_ids.length > 0 ? item.text : '',
    };
}

function sanitizeGroundedList(
    items: GroundedCitationItem[],
    allowedIds: Set<number>
): GroundedCitationItem[] {
    return items
        .map((item) => sanitizeGroundedItem(item, allowedIds))
        .filter((item) => item.sentence_ids.length > 0 && item.text.trim().length > 0);
}

function sanitizePass3Views(views: Pass3Views, sections: CanonicalSections): Pass3Views {
    const allowedIds = collectAllowedSentenceIds(sections);
    return {
        domain_expert: {
            ...views.domain_expert,
            problem_statement: sanitizeGroundedItem(
                views.domain_expert.problem_statement,
                allowedIds
            ),
            delta_summary: sanitizeGroundedList(views.domain_expert.delta_summary, allowedIds),
            technical_highlights: {
                nonstandard_ideas: sanitizeGroundedList(
                    views.domain_expert.technical_highlights.nonstandard_ideas,
                    allowedIds
                ),
                clever_reductions: sanitizeGroundedList(
                    views.domain_expert.technical_highlights.clever_reductions,
                    allowedIds
                ),
            },
            reusable_components: sanitizeGroundedList(
                views.domain_expert.reusable_components,
                allowedIds
            ),
        },
        adjacent_researcher: {
            ...views.adjacent_researcher,
            problem_statement: sanitizeGroundedItem(
                views.adjacent_researcher.problem_statement,
                allowedIds
            ),
            why_matters: sanitizeGroundedList(views.adjacent_researcher.why_matters, allowedIds),
        },
        grad_student: {
            ...views.grad_student,
            problem_statement: sanitizeGroundedItem(
                views.grad_student.problem_statement,
                allowedIds
            ),
            key_ideas: sanitizeGroundedList(views.grad_student.key_ideas, allowedIds),
        },
        author_self: {
            ...views.author_self,
            problem_statement: sanitizeGroundedItem(views.author_self.problem_statement, allowedIds),
        },
    };
}

export async function runPass3(
    sections: CanonicalSections,
    opts: Pass3Options
): Promise<Pass3Views> {
    const limit = pLimit(opts.concurrency ?? 4);
    const canonical_with_citations = formatCanonicalWithCitations(sections);
    const user = pass3UserPrompt({
        title: opts.document_title,
        abstract: opts.abstract,
        canonical_with_citations,
    });

    const expertTask = limit(() =>
        callJson({
            system: PASS3_AUDIENCE_A_SYSTEM,
            user,
            schema: Pass3AudienceASchema,
            temperature: 0,
            maxRetries: 2,
            logger: opts.logger,
            name: 'pass3:domain_expert',
        })
    );
    const adjacentTask = limit(() =>
        callJson({
            system: PASS3_AUDIENCE_B_SYSTEM,
            user,
            schema: Pass3AudienceBSchema,
            temperature: 0,
            maxRetries: 2,
            logger: opts.logger,
            name: 'pass3:adjacent_researcher',
        })
    );
    const studentTask = limit(() =>
        callJson({
            system: PASS3_AUDIENCE_C_SYSTEM,
            user,
            schema: Pass3AudienceCSchema,
            temperature: 0,
            maxRetries: 2,
            logger: opts.logger,
            name: 'pass3:grad_student',
        })
    );
    const authorTask = limit(() =>
        callJson({
            system: PASS3_AUDIENCE_D_SYSTEM,
            user,
            schema: Pass3AudienceDSchema,
            temperature: 0,
            maxRetries: 2,
            logger: opts.logger,
            name: 'pass3:author_self',
        })
    );

    const [domain_expert, adjacent_researcher, grad_student, author_self] =
        await Promise.all([expertTask, adjacentTask, studentTask, authorTask]);

    return sanitizePass3Views(
        { domain_expert, adjacent_researcher, grad_student, author_self },
        sections
    );
}
