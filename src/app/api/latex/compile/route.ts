import path from 'node:path';

import { compileLatexToPdf, formatLatexCompileError } from '@/lib/latex/compile';
import { saveCompilation } from '@/lib/latex/compileStore';
import { isTexEnabled } from '@/lib/features';

export const runtime = 'nodejs';

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
    const compiled = await compileLatexToPdf(buffer, 'latex-');
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
    const msg = formatLatexCompileError(e, 'PDF compile failed');
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
