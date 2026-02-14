import type { Sentence } from './types';

/**
 * Minimal preprocessing per spec:
 * - Remove comments (% ...)
 * - Remove macro definitions (\newcommand, \def, etc.)
 * - Remove preamble and common setup commands (\documentclass, \usepackage, etc.)
 * - Remove bibliography section
 * Preserve everything else.
 */

const MACRO_COMMANDS = [
    '\\newcommand',
    '\\renewcommand',
    '\\providecommand',
    '\\def',
    '\\edef',
    '\\gdef',
    '\\xdef',
    '\\DeclareMathOperator',
    '\\DeclareMathOperator*',
    '\\DeclareRobustCommand',
];

const PREAMBLE_COMMANDS = [
    '\\documentclass',
    '\\usepackage',
    '\\RequirePackage',
    '\\title',
    '\\author',
    '\\date',
    '\\thanks',
    '\\maketitle',
    '\\hypersetup',
    '\\geometry',
    '\\setlength',
    '\\setcounter',
    '\\pagestyle',
    '\\thispagestyle',
];

function stripComments(tex: string): string {
    // Remove unescaped % to end-of-line. Preserve \%.
    return tex
        .split(/\r?\n/)
        .map((line) => {
            let out = '';
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '%') {
                    // count backslashes immediately before %
                    let bs = 0;
                    let j = i - 1;
                    while (j >= 0 && line[j] === '\\') {
                        bs++;
                        j--;
                    }
                    // if even number of backslashes, % is not escaped
                    if (bs % 2 === 0) break;
                }
                out += ch;
            }
            return out;
        })
        .join('\n');
}

function stripPreambleAndDocument(tex: string): string {
    const beginDoc = tex.search(/\\begin\{document\}/);
    if (beginDoc !== -1) {
        tex = tex.slice(beginDoc).replace(/\\begin\{document\}/, '');
    }
    tex = tex.replace(/\\end\{document\}/g, '');
    return tex;
}

function removeBibliography(tex: string): string {
    // Remove thebibliography environment
    tex = tex.replace(
        /\\begin\{thebibliography\}([\s\S]*?)\\end\{thebibliography\}/g,
        ''
    );
    // Remove \bibliography{...}, \printbibliography (command form)
    tex = tex.replace(/\\bibliography\s*\{[^}]*\}/g, '');
    tex = tex.replace(/\\printbibliography\b[^\n]*/g, '');
    return tex;
}

function removeMacroDefinitions(tex: string): string {
    // Conservative line-based removal: drop lines that start with macro commands.
    // This intentionally does NOT rewrite other LaTeX structure.
    const cmdRegex = new RegExp(
        `^\\s*(?:${MACRO_COMMANDS.map((c) => c.replace('\\\\', '\\\\\\\\')).join(
            '|'
        )})\\b`
    );

    const lines = tex.split(/\r?\n/);
    const kept: string[] = [];
    for (const line of lines) {
        if (cmdRegex.test(line)) continue;
        kept.push(line);
    }
    return kept.join('\n');
}

function removePreambleCommands(tex: string): string {
    const cmdRegex = new RegExp(
        `^\\s*(?:${PREAMBLE_COMMANDS.map((c) => c.replace('\\\\', '\\\\\\\\')).join(
            '|'
        )})\\b`
    );

    const lines = tex.split(/\r?\n/);
    const kept: string[] = [];
    for (const line of lines) {
        if (cmdRegex.test(line)) continue;
        kept.push(line);
    }
    return kept.join('\n');
}

export type PreprocessResult = {
    text: string;
    /** map[i] is the original index for text[i] */
    map: number[];
};

export function mapSentencesToOriginal(
    sentences: Sentence[],
    map: number[]
): Sentence[] {
    return sentences.map((s) => {
        if (s.start == null || s.end == null) return s;
        const start = map[s.start];
        const end = map[s.end - 1];
        if (start == null || end == null) return s;
        return { ...s, original_start: start, original_end: end + 1 };
    });
}

function stripCommentsWithMap(
    line: string,
    lineStart: number
): { chars: string[]; idxs: number[] } {
    const chars: string[] = [];
    const idxs: number[] = [];
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '%') {
            // count backslashes immediately before %
            let bs = 0;
            let j = i - 1;
            while (j >= 0 && line[j] === '\\') {
                bs++;
                j--;
            }
            // if even number of backslashes, % is not escaped
            if (bs % 2 === 0) break;
        }
        chars.push(ch);
        idxs.push(lineStart + i);
    }
    return { chars, idxs };
}

function removeSpansFromLine(
    line: string,
    idxs: number[],
    pattern: RegExp
): { line: string; idxs: number[] } {
    let outLine = line;
    let outIdxs = idxs;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(outLine))) {
        const start = match.index;
        const end = start + match[0].length;
        outLine = outLine.slice(0, start) + outLine.slice(end);
        outIdxs = outIdxs.slice(0, start).concat(outIdxs.slice(end));
        pattern.lastIndex = start;
    }
    return { line: outLine, idxs: outIdxs };
}

export function preprocessLatexWithMap(tex: string): PreprocessResult {
    const outChars: string[] = [];
    const map: number[] = [];

    const macroCmd = new RegExp(
        `^\\s*(?:${MACRO_COMMANDS.map((c) => c.replace('\\\\', '\\\\\\\\')).join(
            '|'
        )})\\b`
    );
    const preambleCmd = new RegExp(
        `^\\s*(?:${PREAMBLE_COMMANDS.map((c) => c.replace('\\\\', '\\\\\\\\')).join(
            '|'
        )})\\b`
    );

    const hasBeginDocument = tex.includes('\\begin{document}');
    let inDocument = !hasBeginDocument;
    let inBibliography = false;

    for (let cursor = 0; cursor < tex.length; ) {
        let lineEnd = tex.indexOf('\n', cursor);
        let newline = '';
        if (lineEnd === -1) {
            lineEnd = tex.length;
        } else {
            if (lineEnd > cursor && tex[lineEnd - 1] === '\r') {
                newline = '\r\n';
                lineEnd -= 1;
            } else {
                newline = '\n';
            }
        }

        const lineStart = cursor;
        const lineRaw = tex.slice(lineStart, lineEnd);
        if (newline.length === 0) {
            cursor = tex.length;
        } else {
            cursor = lineEnd + newline.length;
        }

        let { chars, idxs } = stripCommentsWithMap(lineRaw, lineStart);
        let line = chars.join('');

        if (!inDocument) {
            const beginIdx = line.indexOf('\\begin{document}');
            if (beginIdx === -1) {
                continue;
            }
            const start = beginIdx + '\\begin{document}'.length;
            line = line.slice(start);
            idxs = idxs.slice(start);
            inDocument = true;
        }

        if (inDocument) {
            const endIdx = line.indexOf('\\end{document}');
            if (endIdx !== -1) {
                line = line.slice(0, endIdx);
                idxs = idxs.slice(0, endIdx);
                inDocument = false;
            }
        }

        if (inBibliography) {
            if (line.includes('\\end{thebibliography}')) {
                inBibliography = false;
            }
            continue;
        }

        if (line.includes('\\begin{thebibliography}')) {
            inBibliography = true;
            continue;
        }

        const trimmed = line.trim();
        if (trimmed.length > 0 && (macroCmd.test(trimmed) || preambleCmd.test(trimmed))) {
            continue;
        }

        ({ line, idxs } = removeSpansFromLine(
            line,
            idxs,
            /\\bibliography\s*\{[^}]*\}/g
        ));
        ({ line, idxs } = removeSpansFromLine(
            line,
            idxs,
            /\\printbibliography\b[^\n]*/g
        ));

        if (line.length > 0) {
            for (let i = 0; i < line.length; i++) {
                outChars.push(line[i]);
                map.push(idxs[i]);
            }
            if (newline) {
                for (let i = 0; i < newline.length; i++) {
                    outChars.push(newline[i]);
                    map.push(lineEnd + i);
                }
            }
        } else if (newline && inDocument) {
            for (let i = 0; i < newline.length; i++) {
                outChars.push(newline[i]);
                map.push(lineEnd + i);
            }
        }
    }

    return { text: outChars.join(''), map };
}

export function minimalPreprocessLatex(tex: string): string {
    return preprocessLatexWithMap(tex).text;
}

export function extractDocumentTitle(latex: string): string | null {
    const titleMatch = latex.match(/\\title(?:\[[^\]]*\])?\{([\s\S]*?)\}/);
    if (!titleMatch) return null;
    let title = titleMatch[1]
        .replace(/\\[a-zA-Z*]+(?:\[[^\]]*\])?/g, '')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!title) return null;
    return title;
}

export function extractAbstract(latex: string): string | null {
    const envMatch = latex.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
    const cmdMatch = latex.match(/\\abstract\s*\{([\s\S]*?)\}/);
    const sectionMatch = latex.match(
        /\\section\*?\{\s*Abstract\s*\}([\s\S]*?)(?=\\section|\\subsection|\\paragraph|\\begin\{|\\end\{document\}|\Z)/
    );
    const raw = envMatch?.[1] ?? cmdMatch?.[1] ?? sectionMatch?.[1];
    if (!raw) return null;
    const mathMatches = new Map<string, string>();
    let mathIndex = 0;
    const protectedRaw = raw.replace(
        /\$\$[\s\S]*?\$\$|\$[^\$]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g,
        (match) => {
            const key = `__MATH_${mathIndex}__`;
            mathIndex += 1;
            mathMatches.set(key, match);
            return key;
        }
    );
    let abstract = protectedRaw
        .replace(/\\[a-zA-Z*]+(?:\[[^\]]*\])?/g, '')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    for (const [key, value] of mathMatches.entries()) {
        abstract = abstract.replace(key, value);
    }
    if (!abstract) return null;
    return abstract;
}
