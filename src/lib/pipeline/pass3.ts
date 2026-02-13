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

    return { domain_expert, adjacent_researcher, grad_student, author_self };
}
