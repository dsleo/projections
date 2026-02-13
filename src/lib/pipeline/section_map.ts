import type { Sentence } from './types';

type Heading = {
    level: 'section' | 'subsection' | 'subsubsection';
    title: string;
    index: number;
};

export function extractSectionMap(latex: string, sentences: Sentence[]): string {
    const headings: Heading[] = [];
    const re = /\\(section|subsection|subsubsection)\*?\{([^}]+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(latex))) {
        headings.push({
            level: match[1] as Heading['level'],
            title: match[2].replace(/\s+/g, ' ').trim(),
            index: match.index,
        });
    }
    if (headings.length === 0) return '(none)';
    headings.sort((a, b) => a.index - b.index);

    const lines: string[] = [];
    let currentSection = '';
    let currentSub = '';
    let currentSubSub = '';
    let idx = 0;

    for (const s of sentences) {
        const pos = s.original_start ?? s.start ?? 0;
        while (idx < headings.length && headings[idx].index <= pos) {
            const h = headings[idx];
            if (h.level === 'section') {
                currentSection = h.title;
                currentSub = '';
                currentSubSub = '';
            } else if (h.level === 'subsection') {
                currentSub = h.title;
                currentSubSub = '';
            } else {
                currentSubSub = h.title;
            }
            idx += 1;
        }
        const parts = [];
        if (currentSection) parts.push(currentSection);
        if (currentSub) parts.push(currentSub);
        if (currentSubSub) parts.push(currentSubSub);
        if (parts.length === 0) continue;
        const path = parts.join(' → ');
        const last = lines[lines.length - 1];
        if (last?.startsWith(path + ':')) {
            const ids = last.split(':')[1]?.trim() ?? '';
            lines[lines.length - 1] = `${path}: ${ids}, ${s.id}`;
        } else {
            lines.push(`${path}: ${s.id}`);
        }
    }

    return lines.join('\n');
}
