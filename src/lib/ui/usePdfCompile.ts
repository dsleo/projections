'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type PdfStatus =
  | { kind: 'idle' }
  | { kind: 'compiling' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

type Params = {
  file: File | null;
  mode: 'original' | 'supporting';
  originalLatex?: string | null;
  supportingText?: string | null;
};

export function usePdfCompile({ file, mode, originalLatex, supportingText }: Params) {
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

  const compilePdf = useCallback(async () => {
    if (mode === 'original' && !file) return;
    if (mode === 'supporting' && (!originalLatex || !supportingText)) return;
    setStatus({ kind: 'compiling' });
    try {
      let res: Response;
      if (mode === 'supporting') {
        res = await fetch('/api/latex/supporting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            original_latex: originalLatex,
            supporting_text: supportingText,
          }),
        });
      } else {
        const form = new FormData();
        form.append('file', file as File);
        res = await fetch('/api/latex/compile', {
          method: 'POST',
          body: form,
        });
      }
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `PDF compile failed with status ${res.status}`);
      }
      const data = (await res.json()) as { token: string };
      const url = `/api/latex/pdf?token=${data.token}`;
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = null;
      setToken(data.token);
      setPdfUrl(url);
      setStatus({ kind: 'ready' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setStatus({ kind: 'error', message: msg });
    }
  }, [file, mode, originalLatex, supportingText]);

  return { pdfUrl, status, compilePdf, token };
}
