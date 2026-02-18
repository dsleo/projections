import type { Sentence } from './types';

export const WINDOW_SIZE = 20;
/**
 * Number of sentences to carry over as context from the previous window.
 *
 * Example (WINDOW_SIZE=20, WINDOW_OVERLAP=1):
 *   window1: 1..20
 *   window2: 20..39 (overlap last 1 sentence)
 */
export const WINDOW_OVERLAP = 1;

/**
 * Step between windows.
 *
 * Note: historically this was set to 3 (very dense overlap). We now derive it
 * from overlap to avoid excessive redundant LLM tokens.
 */
export const STRIDE = WINDOW_SIZE - WINDOW_OVERLAP;

export type SentenceWindow = {
    /** 0-based sentence position index */
    start: number;
    /** exclusive */
    end: number;
    sentences: Sentence[];
};

export function buildSlidingWindows(
    sentences: Sentence[],
    windowSize = WINDOW_SIZE,
    stride = STRIDE
): SentenceWindow[] {
    const windows: SentenceWindow[] = [];
    if (sentences.length === 0) return windows;

    for (let start = 0; start < sentences.length; start += stride) {
        const end = Math.min(start + windowSize, sentences.length);
        windows.push({ start, end, sentences: sentences.slice(start, end) });
        if (end === sentences.length) break;
    }
    return windows;
}
