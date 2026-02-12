import type { Sentence } from './types';

export const WINDOW_SIZE = 20;
export const STRIDE = 3;

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
