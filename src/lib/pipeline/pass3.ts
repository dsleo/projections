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
    SentenceCitationMap,
} from './types';

export type Pass3Options = {
    concurrency?: number;
    logger?: Logger;
    document_title?: string;
    abstract?: string;
    citations: CitationMap;
    sentence_citations: SentenceCitationMap;
};

function formatCitationLabel(key: string, citations: CitationMap): string {
    const entry = citations[key];
    if (!entry) return key;
    if (entry.label?.trim()) return entry.label.trim();
    if (entry.text) {
        const year = entry.text.match(/\b(19|20)\d{2}\b/)?.[0];
        const author = entry.text.split(',')[0]?.trim();
        if (author && year) return `${author} ${year}`;
        if (author) return author;
    }
    return key;
}

function citationKeysForSentenceIds(
    sentenceIds: number[],
    sentenceCitations: SentenceCitationMap,
    citations: CitationMap
): string[] {
    const keys = new Set<string>();
    for (const id of sentenceIds) {
        const arr = sentenceCitations[String(id)] ?? [];
        for (const k of arr) keys.add(k);
    }
    return Array.from(keys);
}

function formatCitationLegend(citations: CitationMap): string {
    const lines: string[] = [];
    for (const key of Object.keys(citations)) {
        const label = formatCitationLabel(key, citations);
        lines.push(`${key}: ${label}`);
    }
    return lines.length > 0 ? lines.join('\n') : '(none)';
}

function formatCanonicalWithCitations(
    sections: CanonicalSections,
    sentenceCitations: SentenceCitationMap,
    citations: CitationMap
): string {
    const lines: string[] = [];

    const pushItems = (label: string, items: { description: string; sentence_ids: number[] }[]) => {
        for (const item of items) {
            const cites = citationKeysForSentenceIds(
                item.sentence_ids,
                sentenceCitations,
                citations
            );
            lines.push(`- ${label}: ${item.description}`);
            if (cites.length > 0) lines.push(`  citations: ${cites.join('; ')}`);
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
        const cites = citationKeysForSentenceIds(c.sentence_ids, sentenceCitations, citations);
        lines.push(`- Contribution: ${c.statement}`);
        if (cites.length > 0) lines.push(`  citations: ${cites.join('; ')}`);
        if (c.prior_state.text) {
            const priorCites = citationKeysForSentenceIds(
                c.prior_state.sentence_ids,
                sentenceCitations,
                citations
            );
            lines.push(`  prior_state: ${c.prior_state.text}`);
            if (priorCites.length > 0) lines.push(`  citations: ${priorCites.join('; ')}`);
        }
        if (c.novelty.text) {
            const noveltyCites = citationKeysForSentenceIds(
                c.novelty.sentence_ids,
                sentenceCitations,
                citations
            );
            lines.push(`  novelty: ${c.novelty.text}`);
            if (noveltyCites.length > 0) lines.push(`  citations: ${noveltyCites.join('; ')}`);
        }
        if (c.nontriviality.text) {
            const ntCites = citationKeysForSentenceIds(
                c.nontriviality.sentence_ids,
                sentenceCitations,
                citations
            );
            lines.push(`  nontriviality: ${c.nontriviality.text}`);
            if (ntCites.length > 0) lines.push(`  citations: ${ntCites.join('; ')}`);
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
    const canonical_with_citations = formatCanonicalWithCitations(
        sections,
        opts.sentence_citations,
        opts.citations
    );
    const user = pass3UserPrompt({
        title: opts.document_title,
        abstract: opts.abstract,
        canonical_with_citations,
        citation_legend: formatCitationLegend(opts.citations),
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
