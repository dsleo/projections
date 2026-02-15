'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type PdfStatus =
  | { kind: 'idle' }
  | { kind: 'compiling' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

type Params = {
  file: File | null;
  mode: 'original' | 'highlighted';
  originalLatex?: string | null;
  sentences?: Array<{
    id: number;
    original_start?: number;
    original_end?: number;
    start?: number;
    end?: number;
  }>;
  highlightIds?: number[] | null;
};

export function usePdfCompile({
  file,
  mode,
  originalLatex,
  sentences,
  highlightIds,
}: Params) {
  const [status, setStatus] = useState<PdfStatus>({ kind: 'idle' });
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!file) {
      setStatus({ kind: 'idle' });
      setToken(null);
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = null;
      }
      setPdfUrl(null);
    }
  }, [file]);

  useEffect(() => {
    setStatus({ kind: 'idle' });
    setToken(null);
    if (lastUrlRef.current) {
      URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = null;
    }
    setPdfUrl(null);
  }, [mode]);

  const compilePdf = useCallback(async () => {
    if (mode === 'original' && !file && !originalLatex) return;
    if (mode === 'highlighted' && (!originalLatex || !sentences || !highlightIds?.length)) return;
    setStatus({ kind: 'compiling' });
    try {
      let res: Response;
      if (mode === 'highlighted') {
        res = await fetch('/api/latex/highlight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            original_latex: originalLatex,
            sentences,
            sentence_ids: highlightIds,
            envs: [
              'theorem',
              'lemma',
              'proposition',
              'corollary',
              'claim',
              'conjecture',
              'definition',
              'example',
            ],
          }),
        });
      } else if (file) {
        const form = new FormData();
        form.append('file', file);
        res = await fetch('/api/latex/compile', {
          method: 'POST',
          body: form,
        });
      } else {
        res = await fetch('/api/latex/compile-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latex: originalLatex }),
        });
      }
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        const base = j?.error ?? `PDF compile failed with status ${res.status}`;
        const excerpt =
          typeof j?.debug?.excerpt === 'string' && j.debug.excerpt.trim().length > 0
            ? `\n\n${j.debug.excerpt}`
            : '';
        const line =
          typeof j?.debug?.line === 'number' ? `\n(line ${j.debug.line})` : '';
        throw new Error(`${base}${line}${excerpt}`);
      }
      const data = (await res.json()) as { token: string };
      const url = `/api/latex/pdf?token=${data.token}`;
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = null;
      }
      setToken(data.token);
      setPdfUrl(url);
      setStatus({ kind: 'ready' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setStatus({ kind: 'error', message: msg });
    }
  }, [file, mode, originalLatex, sentences, highlightIds]);

  return { pdfUrl, status, compilePdf, token };
}
