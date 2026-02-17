'use client';

import { useEffect, useState } from 'react';

import type { AnalysisResult } from '@/lib/pipeline/client';

export type AnalyzeStatus =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'analyzing'; message?: string }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

const LS_KEY = 'discourse_pipeline_last_result_v1';

type Params = {
  file: File | null;
  useEnvPropagation: boolean;
};

export function useAnalyzeStream({ file, useEnvPropagation }: Params) {
  const [status, setStatus] = useState<AnalyzeStatus>({ kind: 'idle' });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [processingWindows, setProcessingWindows] = useState<
    Array<{ start: number; end: number }>
  >([]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(LS_KEY);
      if (!cached) return;
      const parsed = JSON.parse(cached) as AnalysisResult;
      setResult({
        ...parsed,
        sentence_citations: parsed.sentence_citations ?? {},
        citations: parsed.citations ?? {},
      });
      setStatus({ kind: 'done' });
    } catch {
      // ignore cache errors
    }
  }, []);

  useEffect(() => {
    if (!result) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(result));
    } catch {
      // ignore storage quota errors
    }
  }, [result]);

  const onAnalyze = async () => {
    if (!file) return;
    setStatus({ kind: 'uploading' });

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('use_env_propagation', useEnvPropagation ? '1' : '0');
      setStatus({ kind: 'analyzing', message: 'Starting…' });

      const res = await fetch('/api/analyze/stream', {
        method: 'POST',
        body: form,
        headers: {
          Accept: 'text/event-stream',
        },
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `Request failed with status ${res.status}`);
      }

      // Reset result while streaming to avoid stale UI.
      setResult(null);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const currentEvent: string | null = null;

      // partial state
      let original_latex = '';
      let preprocessed_latex = '';
      let sentences: AnalysisResult['sentences'] = [];
      let labels: AnalysisResult['labels'] = {};
      let sections: AnalysisResult['sections'] | null = null;
      let sections_concatenated_text = '';
      let sentence_citations: AnalysisResult['sentence_citations'] = {};
      let citations: AnalysisResult['citations'] = {};
      let audience_views: AnalysisResult['audience_views'] = undefined;
      let abstract: AnalysisResult['abstract'] = undefined;
      let document_title = '';
      let filename = '';

      const applyPartialResult = () => {
        if (sentences.length === 0) return;
        if (!sections) return;
        setResult({
          document_title,
          abstract,
          filename,
          original_latex,
          preprocessed_latex,
          sentences,
          labels,
          sentence_citations,
          citations,
          sections,
          sections_concatenated_text,
          audience_views,
        });
      };

      const handleEvent = (event: string, dataStr: string) => {
        let data: unknown;
        try {
          data = JSON.parse(dataStr) as unknown;
        } catch {
          data = dataStr;
        }

        const dataObj =
          typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null;

        if (event === 'init') {
          document_title = (dataObj?.document_title as string | undefined) ?? '';
          filename = (dataObj?.filename as string | undefined) ?? '';
          original_latex = (dataObj?.original_latex as string | undefined) ?? '';
          preprocessed_latex = (dataObj?.preprocessed_latex as string | undefined) ?? '';
          sentences = (dataObj?.sentences as AnalysisResult['sentences'] | undefined) ?? [];
          labels = {};
          sections = null;
          sections_concatenated_text = '';
          sentence_citations = {};
          citations = {};
          audience_views = undefined;
          abstract = (dataObj?.abstract as string | undefined) ?? '';
          setProcessingWindows([]);
          setStatus({ kind: 'analyzing', message: `Segmented ${sentences.length} sentences…` });
          setResult({
            document_title,
            abstract,
            filename,
            original_latex,
            preprocessed_latex,
            sentences,
            labels,
            sentence_citations,
            citations,
            sections: {
              problem_and_motivation: { central_problems: [], origins: [], nontriviality: [] },
              landscape: { known_results: [], limitations: [], competing_approaches: [] },
              contributions: { contributions: [] },
              technical_core: { key_ideas: [], technical_obstacles: [], reusable_constructions: [] },
              consequences: { open_questions: [], speculative_extensions: [] },
            },
            sections_concatenated_text: '',
            audience_views: undefined,
          });
        }

        if (event === 'pass1_window_start') {
          const start = (dataObj?.start as number | undefined) ?? 0;
          const end = (dataObj?.end as number | undefined) ?? 0;
          setProcessingWindows((prev) => {
            if (prev.some((w) => w.start === start && w.end === end)) return prev;
            return [...prev, { start, end }];
          });
        }

        if (event === 'pass1_window') {
          const start = (dataObj?.start as number | undefined) ?? 0;
          const end = (dataObj?.end as number | undefined) ?? 0;
          setProcessingWindows((prev) =>
            prev.filter((w) => !(w.start === start && w.end === end))
          );
        }

        if (event === 'labels_delta') {
          const delta = (dataObj?.delta as AnalysisResult['labels'] | undefined) ?? {};
          labels = { ...labels, ...delta };
          setResult((prev) => {
            if (!prev) return prev;
            return { ...prev, labels };
          });
          setStatus({ kind: 'analyzing', message: `Classifying… (${Object.keys(labels).length} labeled)` });
        }

        if (event === 'pass1_done') {
          setProcessingWindows([]);
          setStatus({ kind: 'analyzing', message: `Pass 1 done. Building canonical sections…` });
        }

        if (event === 'pass2_start') {
          const message = (dataObj?.message as string | undefined) ?? 'Building canonical sections…';
          setStatus({ kind: 'analyzing', message });
        }

        if (event === 'pass2_section') {
          const sections = dataObj?.sections as AnalysisResult['sections'] | undefined;
          const sections_concatenated_text =
            (dataObj?.sections_concatenated_text as string | undefined) ?? '';
          if (sections) {
            setResult((prev) => {
              if (!prev) return prev;
              return { ...prev, sections, sections_concatenated_text };
            });
          }
        }

        if (event === 'pass2_done') {
          const message = (dataObj?.message as string | undefined) ?? 'Canonical sections ready.';
          setStatus({ kind: 'analyzing', message });
        }

        if (event === 'pass3_start') {
          const message = (dataObj?.message as string | undefined) ?? 'Building audience views…';
          setStatus({ kind: 'analyzing', message });
        }

        if (event === 'pass3_done') {
          const message = (dataObj?.message as string | undefined) ?? 'Audience views ready.';
          setStatus({ kind: 'analyzing', message });
        }

        if (event === 'sections') {
          sections = dataObj?.sections as AnalysisResult['sections'];
          sections_concatenated_text = (dataObj?.sections_concatenated_text as string | undefined) ?? '';
          sentence_citations =
            (dataObj?.sentence_citations as AnalysisResult['sentence_citations'] | undefined) ?? {};
          citations = (dataObj?.citations as AnalysisResult['citations'] | undefined) ?? {};
          audience_views =
            (dataObj?.audience_views as AnalysisResult['audience_views'] | undefined) ?? undefined;
          applyPartialResult();
        }

        if (event === 'done') {
          setProcessingWindows([]);
          setResult(data as AnalysisResult);
          setStatus({ kind: 'done' });
        }

        if (event === 'error') {
          const err = (dataObj?.error as string | undefined) ?? 'Unknown error';
          throw new Error(err);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE frames separated by blank line.
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const lines = frame.split('\n');

          let eventName: string | null = currentEvent;
          const dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.slice('event:'.length).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice('data:'.length).trim());
            }
          }

          if (eventName && dataLines.length > 0) {
            handleEvent(eventName, dataLines.join('\n'));
          }
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setStatus({ kind: 'error', message: msg });
    }
  };

  return {
    status,
    setStatus,
    result,
    setResult,
    processingWindows,
    setProcessingWindows,
    onAnalyze,
  };
}
