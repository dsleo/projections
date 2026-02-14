'use client';

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'analyzing'; message?: string }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

type Props = {
  file: File | null;
  status: Status;
  processingWindows: Array<{ start: number; end: number }>;
  onFileChange: (file: File | null) => void;
  onAnalyze: () => void;
};

export function UploadCard({ file, status, processingWindows, onFileChange, onAnalyze }: Props) {
  return (
    <section className="col-span-12 rounded-lg border bg-white p-5">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 className="text-sm font-semibold">Upload a LaTeX paper</h2>
          <p className="text-xs text-zinc-500">We analyze .tex sources only.</p>
        </div>

        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          <label className="flex min-w-[220px] max-w-[360px] cursor-pointer items-center gap-2 rounded-md border border-dashed bg-zinc-50 px-3 py-2 text-xs text-zinc-600 hover:bg-white">
            <input
              type="file"
              accept=".tex"
              className="hidden"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
            <span className="truncate">{file ? file.name : 'Choose .tex file'}</span>
          </label>
          <button
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={!file || status.kind === 'uploading' || status.kind === 'analyzing'}
            onClick={onAnalyze}
          >
            Run analysis
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
        <span className="rounded-full border px-2 py-1">
          {status.kind === 'idle' && 'Idle'}
          {status.kind === 'uploading' && 'Uploading'}
          {status.kind === 'analyzing' && 'Processing'}
          {status.kind === 'done' && 'Complete'}
          {status.kind === 'error' && 'Error'}
        </span>
        <span>
          {status.kind === 'idle' && 'Ready to analyze.'}
          {status.kind === 'uploading' && 'Uploading the file…'}
          {status.kind === 'analyzing' && (status.message ?? 'Running Pass 1 + Pass 2…')}
          {status.kind === 'done' && file && `Done.`}
          {status.kind === 'error' && <span className="text-red-700">Error: {status.message}</span>}
        </span>
        {status.kind === 'analyzing' && processingWindows.length > 0 && (
          <span className="text-zinc-500">{processingWindows.length} windows in flight</span>
        )}
      </div>
    </section>
  );
}
