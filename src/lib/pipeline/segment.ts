import type { Sentence } from './types';

type Mode = 'text' | 'math_inline' | 'math_display' | 'equation_env';

/**
 * Deterministic sentence segmentation:
 * - Split on ., ?, !
 * - Do NOT split inside: $...$, \[...\], \begin{equation}...\end{equation}
 * - Preserve strict order and assign global integer IDs
 */
export function segmentSentences(latex: string, startingId = 1): Sentence[] {
    const sentences: Sentence[] = [];

    let mode: Mode = 'text';
    let buf = '';
    let bufStart = 0;

    let id = startingId;
    let position = 0;

    const flush = () => {
        const text = buf.trim();
        if (text.length > 0) {
            let localStart = 0;
            let localEnd = buf.length;
            while (localStart < buf.length && /\s/.test(buf[localStart])) localStart++;
            while (localEnd > localStart && /\s/.test(buf[localEnd - 1])) localEnd--;
            const start = bufStart + localStart;
            const end = bufStart + localEnd;
            sentences.push({ id, text, position, start, end });
            id++;
            position++;
        }
        buf = '';
    };

    const beginsWithAt = (s: string, i: number, needle: string) =>
        s.slice(i, i + needle.length) === needle;

    for (let i = 0; i < latex.length; i++) {
        const ch = latex[i];

        // Mode transitions
        if (mode === 'text') {
            // equation env begin
            if (beginsWithAt(latex, i, '\\begin{equation}')) {
                mode = 'equation_env';
            } else if (beginsWithAt(latex, i, '\\[')) {
                mode = 'math_display';
            } else if (ch === '$') {
                // Handle escaped \$
                const prev = latex[i - 1];
                if (prev !== '\\') {
                    mode = 'math_inline';
                }
            }
        } else if (mode === 'math_inline') {
            if (ch === '$') {
                const prev = latex[i - 1];
                if (prev !== '\\') {
                    mode = 'text';
                }
            }
        } else if (mode === 'math_display') {
            if (beginsWithAt(latex, i, '\\]')) {
                // include the closing delimiter then switch back
                // (switch after appending below)
                mode = 'text';
            }
        } else if (mode === 'equation_env') {
            if (beginsWithAt(latex, i, '\\end{equation}')) {
                mode = 'text';
            }
        }

        if (buf.length === 0) bufStart = i;
        buf += ch;

        // Splitting logic in text mode only.
        if (mode === 'text' && (ch === '.' || ch === '?' || ch === '!')) {
            // Do not split on common LaTeX patterns like e.g. \cite{...}. or decimals are allowed.
            // We implement a conservative split: punctuation followed by whitespace/newline.
            const next = latex[i + 1] ?? '';
            if (next === ' ' || next === '\n' || next === '\r' || next === '\t') {
                flush();
            }
        }
    }

    flush();
    return sentences;
}
