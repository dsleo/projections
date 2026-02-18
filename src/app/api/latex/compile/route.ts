import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { saveCompilation } from '@/lib/latex/compileStore';
import { isTexEnabled } from '@/lib/features';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

async function compileLatex(source: Buffer) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'latex-'));
  const texPath = path.join(tmpDir, 'main.tex');
  const pdfPath = path.join(tmpDir, 'main.pdf');
  const synctexPath = path.join(tmpDir, 'main.synctex.gz');
  const engine = process.env.TEX_ENGINE ?? 'tectonic';

  try {
    await fs.writeFile(texPath, source);
    // Use a real TeX engine to ensure faithful rendering.
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
  if (!isTexEnabled()) {
    return new Response(JSON.stringify({
      error: 'TeX compilation is disabled in this deployment (enable NEXT_PUBLIC_ENABLE_TEX to override).',
    }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'Missing .tex file.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const compiled = await compileLatex(buffer);
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
    let msg = e instanceof Error ? e.message : 'PDF compile failed';
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'ENOENT') {
      msg = 'TeX engine not found. Install tectonic or set TEX_ENGINE.';
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
