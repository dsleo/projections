import pLimit from 'p-limit';

import { SentenceLabelMapSchema } from '../schemas';
import { callJson } from '../llm/call';
import { PASS1_SYSTEM_PROMPT, pass1UserPrompt } from '../llm/prompts';
import type { Logger } from '../logging';
import type { Sentence, SentenceLabelMap } from './types';
import type { SentenceWindow } from './windows';

export type Pass1Options = {
    concurrency?: number;
    logger?: Logger;
};

function formatSentencesForPrompt(sentences: Sentence[]): string {
    return sentences.map((s) => `[${s.id}] ${s.text}`).join('\n');
}

export async function classifyWindow(
    window: SentenceWindow,
    logger?: Logger
): Promise<SentenceLabelMap> {
    const user = pass1UserPrompt(formatSentencesForPrompt(window.sentences));
    const raw = await callJson({
        system: PASS1_SYSTEM_PROMPT,
        user,
        schema: SentenceLabelMapSchema,
        temperature: 0,
        maxRetries: 2,
        logger,
        name: `pass1:window:${window.start + 1}-${window.end}`,
    });

    // Enforce spec: only include sentences with >= 1 label.
    const cleaned: SentenceLabelMap = {};
    for (const [sid, labels] of Object.entries(raw)) {
        if (Array.isArray(labels) && labels.length > 0) cleaned[sid] = labels;
    }
    return cleaned;
}

export function unionAggregate(
    sentences: Sentence[],
    windowResults: SentenceLabelMap[]
): SentenceLabelMap {
    const finalMap: SentenceLabelMap = {};
    const validIds = new Set(sentences.map((s) => String(s.id)));

    for (const res of windowResults) {
        for (const [sid, labels] of Object.entries(res)) {
            if (!validIds.has(sid)) continue;
            const existing = finalMap[sid] ?? [];
            const merged = new Set([...existing, ...labels]);
            finalMap[sid] = Array.from(merged);
        }
    }

    // Keep deterministic label order by DISCOURSE_LABELS order
    const labelOrder = ['Problem', 'Landscape', 'Contribution', 'TechnicalCore', 'Consequences'] as const;
    for (const sid of Object.keys(finalMap)) {
        finalMap[sid] = [...finalMap[sid]].sort(
            (a, b) => labelOrder.indexOf(a) - labelOrder.indexOf(b)
        );
    }

    return finalMap;
}

export async function runPass1(
    windows: SentenceWindow[],
    sentences: Sentence[],
    opts: Pass1Options = {}
): Promise<SentenceLabelMap> {
    const limit = pLimit(opts.concurrency ?? 6);
    opts.logger?.info('pass1:start', { windows: windows.length, sentences: sentences.length });
    const tasks = windows.map((w) =>
        limit(() => classifyWindow(w, opts.logger))
    );
    const results = await Promise.all(tasks);
    opts.logger?.info('pass1:windows_done', { windows: results.length });
    return unionAggregate(sentences, results);
}
