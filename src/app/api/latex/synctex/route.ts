import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { Sentence } from '@/lib/pipeline/client';
import { getCompilation } from '@/lib/latex/compileStore';
import { HIGHLIGHT_MACRO_BLOCK } from '@/lib/latex/highlight';
import { isTexEnabled } from '@/lib/features';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

type SyncResult = {
  input?: string;
  line?: number;
  column?: number;
};

function parseSyncTeX(output: string): SyncResult | null {
  if (!output) return null;
  const lines = output.split(/\r?\n/);
  const result: SyncResult = {};
  for (const line of lines) {
    if (line.startsWith('Input:')) {
      result.input = line.slice('Input:'.length).trim();
    } else if (line.startsWith('Line:')) {
      const val = Number.parseInt(line.slice('Line:'.length).trim(), 10);
      if (!Number.isNaN(val)) result.line = val;
    } else if (line.startsWith('Column:')) {
      const val = Number.parseInt(line.slice('Column:'.length).trim(), 10);
      if (!Number.isNaN(val)) result.column = val;
    }
  }
  if (result.line == null) return null;
  return result;
}

function buildLineStarts(text: string) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function countNewlines(text: string) {
  let count = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') count += 1;
  }
  return count;
}

function getMacroInsertLine(latex: string) {
  const docClass = latex.indexOf('\\documentclass');
  if (docClass !== -1) {
    const line = 1 + countNewlines(latex.slice(0, docClass));
    return line + 1; // inserted after documentclass line
  }
  const beginDoc = latex.indexOf('\\begin{document}');
  if (beginDoc !== -1) {
    const line = 1 + countNewlines(latex.slice(0, beginDoc));
    return line;
  }
  return 1;
}

function getLineNumber(lineStarts: number[], offset: number) {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const start = lineStarts[mid];
    const next = mid + 1 < lineStarts.length ? lineStarts[mid + 1] : Number.POSITIVE_INFINITY;
    if (offset >= start && offset < next) return mid + 1;
    if (offset < start) hi = mid - 1;
    else lo = mid + 1;
  }
  return 1;
}

function buildSentenceLineRanges(lineStarts: number[], sentences: Sentence[]) {
  return sentences
    .map((s) => {
      const start = s.original_start ?? s.start ?? 0;
      const end = s.original_end ?? s.end ?? 0;
      if (end <= start) return null;
      const startLine = getLineNumber(lineStarts, start);
      const endLine = getLineNumber(lineStarts, Math.max(start, end - 1));
      return { id: s.id, startLine, endLine };
    })
    .filter(Boolean) as Array<{ id: number; startLine: number; endLine: number }>;
}

function pickSentenceIdsByLine(
  ranges: Array<{ id: number; startLine: number; endLine: number }>,
  line: number
): number[] {
  let bestId: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const matches: number[] = [];
  for (const r of ranges) {
    if (line >= r.startLine && line <= r.endLine) {
      matches.push(r.id);
      continue;
    }
    const dist = line < r.startLine ? r.startLine - line : line - r.endLine;
    if (dist < bestDistance) {
      bestDistance = dist;
      bestId = r.id;
    }
  }
  if (matches.length > 0) return matches;
  return bestId == null ? [] : [bestId];
}

async function runSyncTeX(pdfPath: string, page: number, x: number, y: number) {
  const bin = process.env.SYNCTEX_BIN ?? 'synctex';
  const { stdout } = await execFileAsync(bin, ['edit', '-o', `${page}:${x}:${y}:${pdfPath}`], {
    timeout: 15_000,
  });
  return stdout.toString();
}

export async function POST(req: Request) {
  if (!isTexEnabled()) {
    return new Response(
      JSON.stringify({
        error:
          'TeX compilation is disabled in this deployment (enable NEXT_PUBLIC_ENABLE_TEX to override).',
      }),
      {
        status: 501,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  try {
    const payload = (await req.json()) as {
      token?: string;
      page?: number;
      points?: Array<{ x: number; y: number }>;
      page_height?: number;
      original_latex?: string;
      sentences?: Sentence[];
    };
    const token = payload.token ?? '';
    const page = payload.page ?? 0;
    const points = payload.points ?? [];
    const pageHeight = payload.page_height ?? null;
    const original = payload.original_latex ?? '';
    const sentences = payload.sentences ?? [];
    if (!token || !page || points.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing token/page/points.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const entry = await getCompilation(token);
    if (!entry) {
      return new Response(JSON.stringify({ error: 'PDF not found or expired.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!original || sentences.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing original latex or sentences.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const lineStarts = buildLineStarts(original);
    const insertedLines = HIGHLIGHT_MACRO_BLOCK.split(/\r?\n/).length + 1;
    const insertLine = getMacroInsertLine(original);
    const sentenceRanges = buildSentenceLineRanges(lineStarts, sentences);
    const foundIds = new Set<number>();
    for (const point of points) {
      const x = Math.round(point.x);
      const y = Math.round(point.y);
      let output = await runSyncTeX(entry.pdfPath, page, x, y).catch(() => '');
      let parsed = parseSyncTeX(output);
      if (!parsed && pageHeight != null) {
        const yInv = Math.round(pageHeight - point.y);
        output = await runSyncTeX(entry.pdfPath, page, x, yInv).catch(() => '');
        parsed = parseSyncTeX(output);
      }
      if (!parsed?.line) continue;
      const adjustedLine =
        parsed.line > insertLine ? parsed.line - insertedLines : parsed.line;
      const ids = pickSentenceIdsByLine(sentenceRanges, adjustedLine);
      ids.forEach((id) => foundIds.add(id));
    }

    return new Response(JSON.stringify({ sentence_ids: Array.from(foundIds) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    let msg = e instanceof Error ? e.message : 'SyncTeX mapping failed';
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'ENOENT') {
      msg = 'synctex binary not found. Install TeX Live or set SYNCTEX_BIN.';
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
