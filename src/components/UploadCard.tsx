'use client';

import { useRef } from 'react';

import type { AnalyzeStatus } from '@/lib/ui/useAnalyzeStream';

type Props = {
  file: File | null;
  status: AnalyzeStatus;
  processingWindows: Array<{ start: number; end: number }>;
  onFileChange: (file: File | null) => void;
  hideDone?: boolean;
};

export function UploadCard({
  file,
  status,
  processingWindows,
  onFileChange,
  hideDone,
}: Props) {
  const showStatus = !(hideDone && status.kind === 'done');
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <section className="w-full">
      <div className="flex w-full flex-col items-center gap-3">
        <div className="flex w-full flex-wrap items-center justify-center gap-3">
          <label
            className="flex min-w-[240px] max-w-[420px] cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed bg-white px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50"
            tabIndex={0}
            role="button"
            aria-label="Choose a .tex file to upload"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            <input
              type="file"
              accept=".tex"
              className="hidden"
              ref={inputRef}
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
            <span className="truncate">{file ? file.name : 'Choose a .tex file'}</span>
          </label>
        </div>
        {showStatus && status.kind !== 'idle' && (
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-600">
            <span className="rounded-full border px-2 py-1">
              {status.kind === 'uploading' && 'Uploading'}
              {status.kind === 'analyzing' && 'Processing'}
              {status.kind === 'done' && 'Complete'}
              {status.kind === 'error' && 'Error'}
            </span>
            <span>
              {status.kind === 'uploading' && 'Uploading the file…'}
              {status.kind === 'analyzing' && (status.message ?? 'Running Pass 1 + Pass 2…')}
              {status.kind === 'done' && file && `Done.`}
              {status.kind === 'error' && (
                <span className="text-red-700">Error: {status.message}</span>
              )}
            </span>
            {status.kind === 'analyzing' && processingWindows.length > 0 && (
              <span className="text-zinc-500">{processingWindows.length} windows in flight</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
