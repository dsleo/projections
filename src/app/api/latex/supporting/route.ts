import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { saveCompilation } from '@/lib/latex/compileStore';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

function buildSupportingLatex(original: string, supportingText: string) {
  const beginDoc = original.indexOf('\\begin{document}');
  const preamble =
    beginDoc !== -1
      ? original.slice(0, beginDoc).trim()
      : '\\documentclass{article}\\usepackage{amsmath,amssymb}';
  const cleaned = supportingText
    .replace(/\\begin\{document\}/g, '')
    .replace(/\\end\{document\}/g, '')
    .trim();
  return `${preamble}\n\\begin{document}\n${cleaned}\n\\end{document}\n`;
}

async function compileLatex(source: string) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'latex-supporting-'));
  const texPath = path.join(tmpDir, 'supporting.tex');
  const pdfPath = path.join(tmpDir, 'supporting.pdf');
  const synctexPath = path.join(tmpDir, 'supporting.synctex.gz');
  const engine = process.env.TEX_ENGINE ?? 'tectonic';

  try {
    await fs.writeFile(texPath, source);
    await execFileAsync(
      engine,
      ['-X', 'compile', '--synctex', '--outdir', tmpDir, texPath],
      { timeout: 120_000 }
    );
    await fs.access(pdfPath);
    await fs.access(synctexPath);
    return { tmpDir, pdfPath, synctexPath, texPath };
  } catch (err) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => null);
    throw err;
  }
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as {
      original_latex?: string;
      supporting_text?: string;
    };
    const original = payload.original_latex ?? '';
    const supportingText = payload.supporting_text ?? '';
    if (!original.trim()) {
      return new Response(JSON.stringify({ error: 'Missing LaTeX.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!supportingText.trim()) {
      return new Response(JSON.stringify({ error: 'Missing supporting text.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const source = buildSupportingLatex(original, supportingText);
    const compiled = await compileLatex(source);
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
    let msg = e instanceof Error ? e.message : 'Supporting PDF compile failed';
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'ENOENT') {
      msg = 'TeX engine not found. Install tectonic or set TEX_ENGINE.';
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
