import path from 'node:path';

import type { Sentence } from '@/lib/pipeline/client';
import { compileLatexToPdf, formatLatexCompileError } from '@/lib/latex/compile';
import { highlightLatex } from '@/lib/latex/highlight';
import { saveCompilation } from '@/lib/latex/compileStore';
import { isTexEnabled } from '@/lib/features';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let source = '';
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
      original_latex?: string;
      sentences?: Sentence[];
      sentence_ids?: number[];
      envs?: string[];
    };
    const original = payload.original_latex ?? '';
    const sentences = payload.sentences ?? [];
    const sentenceIds = payload.sentence_ids ?? [];
    const envs = payload.envs ?? [];
    if (!original.trim()) {
      return new Response(JSON.stringify({ error: 'Missing LaTeX.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (sentences.length === 0 || sentenceIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing sentences to highlight.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    source = highlightLatex(original, sentences, sentenceIds, envs);
    const compiled = await compileLatexToPdf(source, 'latex-highlight-');
    const token = await saveCompilation({
      dir: compiled.tmpDir,
      pdfPath: compiled.pdfPath,
      synctexPath: compiled.synctexPath,
      inputName: path.basename(compiled.texPath),
      inputPath: compiled.texPath,
    });
    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = formatLatexCompileError(e, 'Highlighted PDF compile failed');
    const debug: { line?: number; excerpt?: string } = {};
    if (typeof msg === 'string') {
      const match = msg.match(/main\.tex:(\d+)/);
      if (match) {
        const lineNo = Number.parseInt(match[1], 10);
        if (!Number.isNaN(lineNo)) {
          debug.line = lineNo;
          if (source) {
            const lines = source.split(/\r?\n/);
            const idx = Math.max(0, Math.min(lines.length - 1, lineNo - 1));
            const from = Math.max(0, idx - 2);
            const to = Math.min(lines.length, idx + 3);
            debug.excerpt = lines.slice(from, to).join('\n');
          }
        }
      }
    }
    return new Response(JSON.stringify({ error: msg, debug }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
