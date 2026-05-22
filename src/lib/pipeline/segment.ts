import type { Sentence } from './types';

type Range = { start: number; end: number };

/**
 * Deterministic sentence segmentation:
 * - Split on ., ?, !
 * - Do NOT split inside common LaTeX math spans/environments
 * - Preserve strict order and assign global integer IDs
 */
export function segmentSentences(latex: string, startingId = 1): Sentence[] {
    const sentences: Sentence[] = [];
    let buf = '';
    let bufStart = 0;

    let id = startingId;
    let position = 0;
    const protectedRanges = findProtectedRanges(latex);
    let protectedIdx = 0;

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

    for (let i = 0; i < latex.length; i++) {
        const ch = latex[i];

        if (buf.length === 0) bufStart = i;
        buf += ch;

        while (
            protectedIdx < protectedRanges.length &&
            i >= protectedRanges[protectedIdx].end
        ) {
            protectedIdx += 1;
        }
        const protectedRange = protectedRanges[protectedIdx];
        const isProtected =
            protectedRange != null && i >= protectedRange.start && i < protectedRange.end;

        // Splitting logic in unprotected text only.
        if (!isProtected && (ch === '.' || ch === '?' || ch === '!')) {
            // Do not split on common LaTeX patterns like e.g. \cite{...}. or decimals are allowed.
            // We implement a conservative split: punctuation followed by whitespace/newline.
            const prev = latex[i - 1] ?? '';
            const next = latex[i + 1] ?? '';
            if (isSentenceBoundary(buf, ch, prev, next)) {
                flush();
            }
        }
    }

    flush();
    return sentences;
}

function findProtectedRanges(latex: string): Range[] {
    const ranges: Range[] = [];
    const displayEnvRe = /^\\begin\{((?:equation|align|gather|multline|eqnarray)\*?)\}/;
    let i = 0;

    while (i < latex.length) {
        if (latex.startsWith('\\(', i)) {
            const close = latex.indexOf('\\)', i + 2);
            if (close === -1) break;
            ranges.push({ start: i, end: close + 2 });
            i = close + 2;
            continue;
        }
        if (latex.startsWith('\\[', i)) {
            const close = latex.indexOf('\\]', i + 2);
            if (close === -1) break;
            ranges.push({ start: i, end: close + 2 });
            i = close + 2;
            continue;
        }
        if (latex.startsWith('$$', i)) {
            const close = latex.indexOf('$$', i + 2);
            if (close === -1) break;
            ranges.push({ start: i, end: close + 2 });
            i = close + 2;
            continue;
        }
        if (latex[i] === '$' && latex[i - 1] !== '\\') {
            const close = findUnescapedDollar(latex, i + 1);
            if (close === -1) break;
            ranges.push({ start: i, end: close + 1 });
            i = close + 1;
            continue;
        }

        const envMatch = latex.slice(i).match(displayEnvRe);
        if (envMatch) {
            const endToken = `\\end{${envMatch[1]}}`;
            const close = latex.indexOf(endToken, i + envMatch[0].length);
            if (close === -1) break;
            ranges.push({ start: i, end: close + endToken.length });
            i = close + endToken.length;
            continue;
        }

        i += 1;
    }

    return ranges.sort((a, b) => a.start - b.start);
}

function findUnescapedDollar(latex: string, start: number) {
    for (let i = start; i < latex.length; i += 1) {
        if (latex[i] !== '$') continue;
        if (latex[i + 1] === '$') {
            i += 1;
            continue;
        }
        let backslashes = 0;
        for (let j = i - 1; j >= 0 && latex[j] === '\\'; j -= 1) {
            backslashes += 1;
        }
        if (backslashes % 2 === 0) return i;
    }
    return -1;
}

function isSentenceBoundary(buffer: string, punctuation: string, prev: string, next: string) {
    if (!/\s/.test(next)) return false;
    if (punctuation === '.' && /\d/.test(prev) && /\d/.test(next)) return false;

    const trimmed = buffer.trimEnd();
    const tokenMatch = trimmed.match(/([A-Za-z]+)\.$/);
    const token = tokenMatch?.[1]?.toLowerCase();
    if (!token) return true;

    const abbreviations = new Set([
        'al',
        'cf',
        'dr',
        'eg',
        'eq',
        'eqs',
        'etc',
        'fig',
        'figs',
        'ie',
        'mr',
        'mrs',
        'ms',
        'no',
        'prof',
        'sec',
        'secs',
        'vs',
    ]);
    if (token.length === 1 || abbreviations.has(token)) return false;
    return true;
}
