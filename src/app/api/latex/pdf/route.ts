import { promises as fs } from 'node:fs';

import { getCompilation } from '@/lib/latex/compileStore';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing token.' }), {
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

  const pdf = await fs.readFile(entry.pdfPath);
  return new Response(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="document.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}
