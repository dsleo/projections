import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type LatexCompilation = {
  tmpDir: string;
  pdfPath: string;
  synctexPath: string;
  texPath: string;
};

export async function compileLatexToPdf(
  source: string | Buffer,
  tmpPrefix = 'latex-'
): Promise<LatexCompilation> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), tmpPrefix));
  const texPath = path.join(tmpDir, 'main.tex');
  const pdfPath = path.join(tmpDir, 'main.pdf');
  const synctexPath = path.join(tmpDir, 'main.synctex.gz');
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

export function formatLatexCompileError(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  ) {
    return 'TeX engine not found. Install tectonic or set TEX_ENGINE.';
  }
  return error instanceof Error ? error.message : fallback;
}
