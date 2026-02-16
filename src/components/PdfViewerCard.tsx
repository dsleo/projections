'use client';

import { useEffect, useRef, useState } from 'react';

type Status =
  | { kind: 'idle' }
  | { kind: 'compiling' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

type Props = {
  canCompile: boolean;
  status: Status;
  pdfUrl: string | null;
  onCompile: () => void;
  selectedTab: string;
  onTabChange: (id: string) => void;
  showToggle?: boolean;
  focusSentenceIndex?: number | null;
  totalSentences?: number;
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getViewport: (opts: { scale: number }) => {
      width: number;
      height: number;
      convertToViewportRectangle: (rect: [number, number, number, number]) => [
        number,
        number,
        number,
        number,
      ];
    };
    render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
  }>;
};

function PdfPage({
  doc,
  pageNumber,
  scale,
  containerRef,
}: {
  doc: PdfDocument;
  pageNumber: number;
  scale: number;
  containerRef?: (instance: HTMLDivElement | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [viewportRef, setViewportRef] = useState<{
    width: number;
    height: number;
    convertToViewportRectangle: (rect: [number, number, number, number]) => [
      number,
      number,
      number,
      number,
    ];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    doc.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      setDims({ width: viewport.width, height: viewport.height });
      setViewportRef(viewport);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const deviceScale = window.devicePixelRatio || 1;
      canvas.width = viewport.width * deviceScale;
      canvas.height = viewport.height * deviceScale;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
      page.render({ canvasContext: ctx, viewport }).promise.catch(() => null);
    });
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber, scale]);

  return (
    <div
      ref={containerRef}
      className="relative mb-4"
      style={{ width: dims?.width, height: dims?.height }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}

export function PdfViewerCard({
  canCompile,
  status,
  pdfUrl,
  onCompile,
  selectedTab,
  onTabChange,
  showToggle = true,
  focusSentenceIndex,
  totalSentences,
}: Props) {
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const downloadName =
    selectedTab === 'original' ? 'paper-original.pdf' : `paper-supporting-${selectedTab}.pdf`;
  const showOriginal = selectedTab === 'original';
  const toggleLabel = showOriginal ? 'Show audience PDF' : 'Show original PDF';
  const toggleIcon = showOriginal ? '✦' : '↩︎';

  useEffect(() => {
    let cancelled = false;
    if (!pdfUrl) {
      setDoc(null);
      setPageCount(0);
      return;
    }
    (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      const loadingTask = pdfjs.getDocument(pdfUrl);
      const pdfDoc = await loadingTask.promise;
      if (cancelled) return;
      setDoc(pdfDoc as PdfDocument);
      setPageCount(pdfDoc.numPages);
    })().catch(() => {
      setDoc(null);
      setPageCount(0);
    });
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  useEffect(() => {
    pageRefs.current = [];
  }, [pdfUrl, pageCount]);

  useEffect(() => {
    if (focusSentenceIndex == null) return;
    if (!pageCount || !totalSentences) return;
    const ratio = (focusSentenceIndex + 1) / totalSentences;
    const targetPage = Math.min(pageCount, Math.max(1, Math.round(ratio * pageCount)));
    const target = pageRefs.current[targetPage - 1];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusSentenceIndex, pageCount, totalSentences, pdfUrl]);
  return (
    <section className="rounded-lg border bg-white p-4 flex flex-col min-h-[60vh] w-full lg:w-[560px]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm font-semibold">
        <span>PDF preview</span>
        <div className="flex items-center gap-2">
          {showToggle && (
            <button
              className="rounded-full border px-2 py-0.5 text-[11px] font-normal text-zinc-500 hover:bg-zinc-100"
              type="button"
              onClick={() => onTabChange(showOriginal ? 'audience' : 'original')}
              aria-label={toggleLabel}
              title={toggleLabel}
            >
              {toggleIcon}
            </button>
          )}
          <button
            className="rounded-full border px-2 py-0.5 text-[11px] font-normal text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
            type="button"
            onClick={onCompile}
            disabled={!canCompile || status.kind === 'compiling'}
            aria-label="Compile PDF"
            title="Compile PDF"
          >
            ⟳
          </button>
          {pdfUrl ? (
            <a
              className="rounded-full border px-2 py-0.5 text-[11px] font-normal text-zinc-500 hover:bg-zinc-100"
              href={pdfUrl}
              download={downloadName}
              aria-label="Download PDF"
              title="Download PDF"
            >
              ⤓
            </a>
          ) : (
            <button
              className="rounded-full border px-2 py-0.5 text-[11px] font-normal text-zinc-300"
              type="button"
              disabled
              aria-label="Download PDF"
              title="Download PDF"
            >
              ⤓
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 text-xs text-zinc-500">
        {status.kind === 'idle' && 'No PDF rendered yet.'}
        {status.kind === 'compiling' && 'Compiling with TeX engine…'}
        {status.kind === 'error' && <span className="text-red-700">Error: {status.message}</span>}
      </div>
      <div className="mt-3 flex-1 rounded-md border bg-zinc-50 overflow-auto max-h-[75vh]">
        {!pdfUrl && (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            No PDF rendered yet.
          </div>
        )}
        {pdfUrl && doc && (
          <div className="p-3">
            {Array.from({ length: pageCount }, (_, idx) => idx + 1).map((pageNumber) => (
              <PdfPage
                key={`pdf-page-${pageNumber}`}
                doc={doc}
                pageNumber={pageNumber}
                scale={1.2}
                containerRef={(el) => {
                  pageRefs.current[pageNumber - 1] = el;
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
