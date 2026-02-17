import type { Sentence } from '@/lib/pipeline/client';

const WORD_CMD = '\\dfhighlightword';
const MATH_CMD = '\\dfhighlightmath';

export const HIGHLIGHT_MACRO_BLOCK = [
  '% Discourse pipeline highlights',
  '\\usepackage{xcolor}',
  `\\newcommand{${WORD_CMD}}[1]{\\begingroup\\setlength\\fboxsep{0.4pt}\\colorbox{yellow}{\\strut #1}\\endgroup}`,
  `\\newcommand{${MATH_CMD}}[1]{\\begingroup\\setlength\\fboxsep{0.4pt}\\colorbox{yellow}{\\strut #1}\\endgroup}`,
  '',
].join('\n');

const PAR_BREAK_RE = /\\par|\n\s*\n/;
const DISPLAY_MATH_RE = /\$\$|\\\[|\\\]|\\begin\{(equation|align|gather|multline|eqnarray)\*?\}/;
const INLINE_MATH_RE = /\$|\\\(|\\\)|\\\[|\\\]/;
const MATH_COMMAND_RE =
  /\\(Pr|ge|le|neq|approx|cup|cap|cdot|times|log|exp|sqrt|psi|varphi|eps|epsilon|alpha|beta|gamma|delta|theta|lambda|mu|nu|rho|sigma|tau|phi|chi|omega|mathbb|mathcal|mathbf|mathrm)\b/;
const SKIP_COMMANDS = new Set([
  'cite',
  'citet',
  'citep',
  'citeauthor',
  'ref',
  'eqref',
  'cref',
  'Cref',
  'autoref',
  'label',
  'bibitem',
  'begin',
  'end',
]);

function injectMacros(latex: string) {
  const docClass = latex.indexOf('\\documentclass');
  const beginDoc = latex.indexOf('\\begin{document}');
  const macroBlock = HIGHLIGHT_MACRO_BLOCK;
  if (docClass !== -1) {
    const lineEnd = latex.indexOf('\n', docClass);
    const insertAt = lineEnd === -1 ? latex.length : lineEnd + 1;
    return `${latex.slice(0, insertAt)}${macroBlock}\n${latex.slice(insertAt)}`;
  }
  if (beginDoc !== -1) {
    return `${latex.slice(0, beginDoc)}\n${macroBlock}\n${latex.slice(beginDoc)}`;
  }
  return `${macroBlock}\n${latex}`;
}

export function highlightLatex(
  latex: string,
  sentences: Sentence[],
  sentenceIds: number[],
  envs: readonly string[] = []
) {
  if (!latex || sentenceIds.length === 0) return latex;
  const expandedIds = expandByEnvironment(latex, sentences, sentenceIds, envs);
  const beginDoc = latex.indexOf('\\begin{document}');
  if (beginDoc === -1) return latex;
  const endDoc = latex.lastIndexOf('\\end{document}');
  const docStart = beginDoc + '\\begin{document}'.length;
  const docEnd = endDoc === -1 ? latex.length : endDoc;
  const inlineMathRanges = findInlineMathRanges(latex, docStart, docEnd);
  const displayMathRanges = findDisplayMathRanges(latex, docStart, docEnd);

  const targets = new Set(expandedIds);
  const inserts: Array<{ at: number; text: string; kind: 'open' | 'close' }> = [];

  for (const s of sentences) {
    if (!targets.has(s.id)) continue;
    const start = s.original_start ?? s.start;
    const end = s.original_end ?? s.end;
    if (start == null || end == null || end <= start) continue;
    if (start < docStart || end > docEnd) continue;
    let adjusted = adjustRangeForInlineMath(start, end, inlineMathRanges);
    adjusted = adjustRangeForMathRanges(adjusted.start, adjusted.end, displayMathRanges);
    if (adjusted.start < docStart || adjusted.end > docEnd) continue;
    const slice = latex.slice(adjusted.start, adjusted.end);
    if (PAR_BREAK_RE.test(slice)) continue;
    const chunkInserts = buildChunkInsertsExcludingBlocks(slice, adjusted.start);
    if (chunkInserts.length === 0) continue;
    if (MATH_COMMAND_RE.test(slice) && !INLINE_MATH_RE.test(slice)) continue;
    inserts.push(...chunkInserts);
  }

  if (inserts.length === 0) return latex;
  inserts.sort((a, b) => {
    if (a.at !== b.at) return b.at - a.at;
    if (a.kind === b.kind) return 0;
    return a.kind === 'open' ? -1 : 1;
  });

  let highlighted = latex;
  for (const insert of inserts) {
    highlighted = highlighted.slice(0, insert.at) + insert.text + highlighted.slice(insert.at);
  }
  return injectMacros(highlighted);
}

type EnvRange = { name: string; start: number; end: number };
type Range = { start: number; end: number };

function findEnvironmentRanges(latex: string, envNames: Set<string>): EnvRange[] {
  const ranges: EnvRange[] = [];
  const stack: Array<{ name: string; start: number }> = [];
  const re = /\\(begin|end)\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(latex))) {
    const kind = match[1];
    const name = match[2];
    if (!envNames.has(name)) continue;
    if (kind === 'begin') {
      stack.push({ name, start: match.index });
    } else {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].name === name) {
          const { start } = stack[i];
          stack.splice(i, 1);
          const end = match.index + match[0].length;
          ranges.push({ name, start, end });
          break;
        }
      }
    }
  }
  return ranges;
}

function sentenceIntersectsRange(sentence: Sentence, range: EnvRange): boolean {
  const start = sentence.original_start ?? sentence.start ?? 0;
  const end = sentence.original_end ?? sentence.end ?? 0;
  if (end <= start) return false;
  return start < range.end && end > range.start;
}

function expandByEnvironment(
  latex: string,
  sentences: Sentence[],
  sentenceIds: number[],
  envs: readonly string[]
) {
  if (!envs.length || !sentenceIds.length) return sentenceIds;
  const envNames = new Set(envs);
  const ranges = findEnvironmentRanges(latex, envNames);
  if (!ranges.length) return sentenceIds;
  const selected = new Set(sentenceIds);
  const expanded = new Set(sentenceIds);
  for (const range of ranges) {
    const inRange = sentences.filter((s) => sentenceIntersectsRange(s, range));
    if (!inRange.length) continue;
    const hasSelected = inRange.some((s) => selected.has(s.id));
    if (!hasSelected) continue;
    for (const s of inRange) expanded.add(s.id);
  }
  return Array.from(expanded);
}

function findInlineMathRanges(latex: string, start: number, end: number): Range[] {
  const ranges: Range[] = [];
  let i = start;
  while (i < end) {
    const ch = latex[i];
    if (ch === '\\') {
      if (latex.startsWith('\\(', i)) {
        const close = latex.indexOf('\\)', i + 2);
        if (close === -1) break;
        ranges.push({ start: i, end: close + 2 });
        i = close + 2;
        continue;
      }
      i += 2;
      continue;
    }
    if (ch === '$') {
      if (latex[i + 1] === '$') {
        i += 2;
        continue;
      }
      if (i > start && latex[i - 1] === '\\') {
        i += 1;
        continue;
      }
      const open = i;
      i += 1;
      while (i < end) {
        if (latex[i] === '\\') {
          i += 2;
          continue;
        }
        if (latex[i] === '$' && latex[i - 1] !== '\\') {
          i += 1;
          break;
        }
        i += 1;
      }
      ranges.push({ start: open, end: i });
      continue;
    }
    i += 1;
  }
  return ranges;
}

function adjustRangeForInlineMath(start: number, end: number, ranges: Range[]) {
  return adjustRangeForMathRanges(start, end, ranges);
}

function findDisplayMathRanges(latex: string, start: number, end: number): Range[] {
  const ranges: Range[] = [];
  const slice = latex.slice(start, end);

  const addMatches = (re: RegExp) => {
    let match: RegExpExecArray | null;
    while ((match = re.exec(slice))) {
      const matchStart = start + match.index;
      const matchEnd = matchStart + match[0].length;
      ranges.push({ start: matchStart, end: matchEnd });
    }
  };

  addMatches(/\$\$[\s\S]*?\$\$/g);
  addMatches(/\\\[[\s\S]*?\\\]/g);
  addMatches(
    /\\begin\{(equation|align|gather|multline|eqnarray)\*?\}[\s\S]*?\\end\{\1\*?\}/g
  );
  return ranges;
}

function adjustRangeForMathRanges(start: number, end: number, ranges: Range[]) {
  let adjStart = start;
  let adjEnd = end;
  for (const range of ranges) {
    const intersects = adjStart < range.end && adjEnd > range.start;
    if (!intersects) continue;
    if (adjStart > range.start && adjStart < range.end) {
      adjStart = range.start;
    }
    if (adjEnd > range.start && adjEnd < range.end) {
      adjEnd = range.end;
    }
  }
  return { start: adjStart, end: adjEnd };
}

function buildChunkInserts(slice: string, baseOffset: number) {
  const inserts: Array<{ at: number; text: string; kind: 'open' | 'close' }> = [];
  const segments = splitInlineMath(slice);
  for (const segment of segments) {
    if (!segment.text.trim()) continue;
    if (segment.isMath) {
      inserts.push({ at: baseOffset + segment.start, text: `${MATH_CMD}{`, kind: 'open' });
      inserts.push({ at: baseOffset + segment.end, text: '}', kind: 'close' });
      continue;
    }
    inserts.push(...buildTextInserts(segment.text, baseOffset + segment.start));
  }
  return inserts;
}

function buildChunkInsertsExcludingEnvs(slice: string, baseOffset: number) {
  const inserts: Array<{ at: number; text: string; kind: 'open' | 'close' }> = [];
  const envRe = /\\(begin|end)\{[^}]+\}/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = envRe.exec(slice))) {
    const start = match.index;
    if (start > last) {
      inserts.push(...buildChunkInserts(slice.slice(last, start), baseOffset + last));
    }
    last = match.index + match[0].length;
  }
  if (last < slice.length) {
    inserts.push(...buildChunkInserts(slice.slice(last), baseOffset + last));
  }
  return inserts;
}

function buildChunkInsertsExcludingBlocks(slice: string, baseOffset: number) {
  const inserts: Array<{ at: number; text: string; kind: 'open' | 'close' }> = [];
  const blockRe =
    /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\begin\{(equation|align|gather|multline|eqnarray)\*?\}[\s\S]*?\\end\{\1\*?\}/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(slice))) {
    const start = match.index;
    if (start > last) {
      inserts.push(...buildChunkInsertsExcludingEnvs(slice.slice(last, start), baseOffset + last));
    }
    last = match.index + match[0].length;
  }
  if (last < slice.length) {
    inserts.push(...buildChunkInsertsExcludingEnvs(slice.slice(last), baseOffset + last));
  }
  return inserts;
}

function splitInlineMath(source: string) {
  const segments: Array<{ text: string; start: number; end: number; isMath: boolean }> = [];
  let i = 0;
  let last = 0;

  const pushText = (end: number) => {
    if (end > last) segments.push({ text: source.slice(last, end), start: last, end, isMath: false });
    last = end;
  };

  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\' && i + 1 < source.length) {
      i += 2;
      continue;
    }
    if (ch === '$') {
      if (source[i + 1] === '$') {
        i += 2;
        continue;
      }
      pushText(i);
      const start = i;
      i += 1;
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i] === '$') {
          i += 1;
          break;
        }
        i += 1;
      }
      const end = i;
      if (end > start) {
        segments.push({ text: source.slice(start, end), start, end, isMath: true });
        last = end;
      }
      continue;
    }
    if (source.startsWith('\\(', i)) {
      pushText(i);
      const start = i;
      const close = source.indexOf('\\)', i + 2);
      if (close === -1) {
        i += 2;
        continue;
      }
      const end = close + 2;
      segments.push({ text: source.slice(start, end), start, end, isMath: true });
      last = end;
      i = end;
      continue;
    }
    i += 1;
  }

  if (last < source.length) {
    segments.push({ text: source.slice(last), start: last, end: source.length, isMath: false });
  }
  return segments;
}

function buildTextInserts(text: string, baseOffset: number) {
  const inserts: Array<{ at: number; text: string; kind: 'open' | 'close' }> = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      i += 1;
      if (i >= text.length) break;
      // Control symbol like \\ or \%
      if (!/[a-zA-Z@]/.test(text[i])) {
        i += 1;
        continue;
      }
      const nameStart = i;
      while (i < text.length && /[a-zA-Z@*]/.test(text[i])) i += 1;
      const name = text.slice(nameStart, i);
      if (text[i] === '[') {
        i = skipBracket(text, i, '[', ']');
      }
      if (text[i] === '{') {
        const contentStart = i + 1;
        const contentEnd = findMatching(text, i, '{', '}');
        if (contentEnd !== -1) {
          if (!SKIP_COMMANDS.has(name)) {
            inserts.push(
              ...buildTextInserts(text.slice(contentStart, contentEnd), baseOffset + contentStart)
            );
          }
          i = contentEnd + 1;
          continue;
        }
      }
      continue;
    }
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    const wordStart = i;
    while (i < text.length && !/\s/.test(text[i]) && text[i] !== '\\') i += 1;
    const word = text.slice(wordStart, i);
    if (word.trim() && !word.includes('$')) {
      inserts.push({ at: baseOffset + wordStart, text: `${WORD_CMD}{`, kind: 'open' });
      inserts.push({ at: baseOffset + wordStart + word.length, text: '}', kind: 'close' });
    }
  }
  return inserts;
}

function skipBracket(text: string, start: number, open: string, close: string) {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === open) depth += 1;
    if (text[i] === close) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return start + 1;
}

function findMatching(text: string, start: number, open: string, close: string) {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === open) depth += 1;
    if (text[i] === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}
