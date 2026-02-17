'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Download, RefreshCw, Sparkles, Undo2 } from 'lucide-react';

import { IconButton } from '@/components/IconButton';
import { classNames } from '@/lib/ui/classNames';

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
  supportingTitle?: string;
  supportingContent?: ReactNode;
  defaultView?: 'pdf' | 'supporting';
  showToggle?: boolean;
  focusSentenceIndex?: number | null;
  totalSentences?: number;
  variant?: 'default' | 'full';
  collapsible?: boolean;
  defaultOpen?: boolean;
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
      className="relative mb-4 mx-auto"
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
  supportingTitle = 'Supporting text',
  supportingContent,
  defaultView = 'pdf',
  showToggle = true,
  focusSentenceIndex,
  totalSentences,
  variant = 'default',
  collapsible = false,
  defaultOpen = true,
}: Props) {
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const downloadName =
    selectedTab === 'original' ? 'paper-original.pdf' : `paper-supporting-${selectedTab}.pdf`;
  const showOriginal = selectedTab === 'original';
  const toggleLabel = showOriginal ? 'Show audience PDF' : 'Show original PDF';
  const ToggleIcon = showOriginal ? Sparkles : Undo2;
  const [activeView, setActiveView] = useState<'pdf' | 'supporting'>(defaultView);
  const showSupporting = Boolean(supportingContent);

  useEffect(() => {
    if (!showSupporting && activeView !== 'pdf') {
      setActiveView('pdf');
    }
  }, [showSupporting, activeView]);

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
    if (collapsible && !isOpen) return;
    const ratio = (focusSentenceIndex + 1) / totalSentences;
    const targetPage = Math.min(pageCount, Math.max(1, Math.round(ratio * pageCount)));
    const target = pageRefs.current[targetPage - 1];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusSentenceIndex, pageCount, totalSentences, pdfUrl, collapsible, isOpen]);
  const containerClass =
    variant === 'full'
      ? 'rounded-lg border bg-white p-5 flex flex-col min-h-[60vh] w-full text-base'
      : 'rounded-lg border bg-white p-4 flex flex-col min-h-[60vh] w-full lg:w-[560px]';
  return (
    <section className={containerClass}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 font-semibold">
        <div className="flex flex-wrap items-center gap-3">
          <span>Document viewer</span>
          {showSupporting && (
            <div className="inline-flex rounded-full border bg-white p-1 text-sm text-zinc-600">
              <button
                type="button"
                className={classNames(
                  'rounded-full px-3 py-1.5',
                  activeView === 'pdf'
                    ? 'bg-zinc-900 text-white'
                    : 'hover:bg-zinc-50'
                )}
                onClick={() => setActiveView('pdf')}
              >
                PDF
              </button>
              <button
                type="button"
                className={classNames(
                  'rounded-full px-3 py-1.5',
                  activeView === 'supporting'
                    ? 'bg-zinc-900 text-white'
                    : 'hover:bg-zinc-50'
                )}
                onClick={() => setActiveView('supporting')}
              >
                {supportingTitle}
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {collapsible && (
            <button
              className="rounded-full border px-2 py-1 font-normal text-zinc-500 hover:bg-zinc-100"
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              aria-label={isOpen ? 'Hide PDF' : 'Show PDF'}
              title={isOpen ? 'Hide PDF' : 'Show PDF'}
            >
              {isOpen ? 'Hide' : 'Show'}
            </button>
          )}
          {showToggle && (
            <IconButton
              icon={ToggleIcon}
              label={toggleLabel}
              onClick={() => onTabChange(showOriginal ? 'audience' : 'original')}
            />
          )}
          <IconButton
            icon={RefreshCw}
            label="Compile PDF"
            onClick={onCompile}
            disabled={!canCompile || status.kind === 'compiling'}
          />
          {pdfUrl ? (
            <IconButton
              icon={Download}
              label="Download PDF"
              href={pdfUrl}
              download={downloadName}
            />
          ) : (
            <IconButton icon={Download} label="Download PDF" disabled />
          )}
        </div>
      </div>
      {activeView === 'pdf' && (
        <>
          <div className="mt-2 text-base text-zinc-500">
            {status.kind === 'idle' && 'No PDF rendered yet.'}
            {status.kind === 'compiling' && 'Compiling with TeX engine…'}
            {status.kind === 'error' && (
              <span className="text-red-700">Error: {status.message}</span>
            )}
          </div>
          {(!collapsible || isOpen) && (
            <div className="mt-3 flex-1 rounded-md border bg-zinc-50 overflow-auto max-h-[75vh]">
              {!pdfUrl && (
                <div className="flex h-full items-center justify-center text-base text-zinc-400">
                  No PDF rendered yet.
                </div>
              )}
              {pdfUrl && doc && (
                <div className="p-3 flex flex-col items-center">
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
          )}
        </>
      )}

      {activeView === 'supporting' && (
        <div className="mt-3 flex-1 rounded-md border bg-zinc-50 overflow-auto max-h-[75vh]">
          <div className="p-4">{supportingContent}</div>
        </div>
      )}
    </section>
  );
}
