import { createLogger } from '@/lib/logging';
import type { DiscourseLabel, SentenceLabelMap } from '@/lib/pipeline/types';
import { buildCitationData } from '@/lib/pipeline/citations';
import {
    extractAbstract,
    extractDocumentTitle,
    mapSentencesToOriginal,
    preprocessLatexWithMap,
} from '@/lib/pipeline/preprocess';
import { segmentSentences } from '@/lib/pipeline/segment';
import { buildSlidingWindows } from '@/lib/pipeline/windows';
import { classifyWindow } from '@/lib/pipeline/pass1';
import { runPass3 } from '@/lib/pipeline/pass3';
import { propagateLabelsByEnvironment } from '@/lib/pipeline/env_propagation';

export const runtime = 'nodejs';

type SseEvent = {
    event: string;
    data: unknown;
};

function encodeSse({ event, data }: SseEvent): Uint8Array {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const text = `event: ${event}\ndata: ${payload}\n\n`;
    return new TextEncoder().encode(text);
}

function sortLabels(labels: Set<DiscourseLabel>): DiscourseLabel[] {
    const order: DiscourseLabel[] = [
        'Problem',
        'Landscape',
        'Contribution',
        'TechnicalCore',
        'Consequences',
    ];
    return Array.from(labels).sort((a, b) => order.indexOf(a) - order.indexOf(b));
}


export async function POST(req: Request) {
    const requestId = crypto.randomUUID();
    const logger = createLogger({ requestId, route: '/api/analyze/stream' });

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (event: string, data: unknown) =>
                controller.enqueue(encodeSse({ event, data }));

            try {
                logger.info('stream:request:start');
                send('log', { level: 'info', msg: 'request:start', requestId });

                const form = await req.formData();
                const file = form.get('file');
                const useEnvPropagation =
                    (form.get('use_env_propagation') as string | null) === '1';
                if (!(file instanceof File)) {
                    send('error', { error: 'Missing file' });
                    controller.close();
                    return;
                }
                if (!file.name.endsWith('.tex')) {
                    send('error', { error: 'Only .tex is supported' });
                    controller.close();
                    return;
                }
                const latex = await file.text();
                const document_title = extractDocumentTitle(latex);
                const abstract = extractAbstract(latex);

                // Phase 0: deterministic preprocessing + segmentation
                logger.info('stream:preprocess:start', { chars: latex.length });
                const preprocessed = preprocessLatexWithMap(latex);
                logger.info('stream:preprocess:done', { chars: preprocessed.text.length });
                const preprocessed_latex = preprocessed.text;
                logger.info('stream:segment:start');
                const sentences = mapSentencesToOriginal(
                    segmentSentences(preprocessed_latex, 1),
                    preprocessed.map
                );
                logger.info('stream:segment:done', { sentences: sentences.length });
                const windows = buildSlidingWindows(sentences);
                logger.info('stream:init:send', { windows: windows.length });
                send('init', {
                    requestId,
                    document_title,
                    abstract,
                    filename: file.name,
                    original_latex: latex,
                    preprocessed_latex,
                    sentences,
                    windows: windows.length,
                });
                logger.info('stream:init:sent');

                // Phase 1: streaming pass1
                const agg: Record<string, Set<DiscourseLabel>> = {};
                const concurrency = 6;
                let idx = 0;
                const inFlight = new Set<Promise<void>>();
                const failedWindows: Array<{ start: number; end: number; error: string }> = [];

                const startWindow = (w: (typeof windows)[number]) => {
                    send('pass1_window_start', { start: w.start, end: w.end });
                    const p = (async () => {
                        try {
                            const res = await classifyWindow(w, logger);
                            send('pass1_window', { start: w.start, end: w.end, res });

                            // Compute deltas
                            const delta: SentenceLabelMap = {};
                            for (const [sid, labels] of Object.entries(res)) {
                                const set = (agg[sid] ??= new Set());
                                const beforeSize = set.size;
                                for (const l of labels) set.add(l);
                                if (set.size !== beforeSize) {
                                    delta[sid] = sortLabels(set);
                                }
                            }
                            if (Object.keys(delta).length > 0) {
                                send('labels_delta', { delta });
                            }
                        } catch (e) {
                            const error = e instanceof Error ? e.message : String(e);
                            failedWindows.push({ start: w.start, end: w.end, error });
                            send('pass1_window_error', {
                                start: w.start,
                                end: w.end,
                                error,
                            });
                            send('log', {
                                level: 'error',
                                msg: 'pass1_window:error',
                                error,
                            });
                        }
                    })();

                    // Ensure it removes itself when done (regardless of success/failure).
                    const tracked = p.finally(() => {
                        inFlight.delete(tracked);
                    });
                    inFlight.add(tracked);
                };

                // Prime the pump.
                while (inFlight.size < concurrency && idx < windows.length) {
                    startWindow(windows[idx++]);
                }

                // Keep starting windows as soon as any slot frees up (no artificial delay).
                while (idx < windows.length || inFlight.size > 0) {
                    if (inFlight.size === 0) {
                        // Should be rare, but keep it safe.
                        while (inFlight.size < concurrency && idx < windows.length) {
                            startWindow(windows[idx++]);
                        }
                        continue;
                    }

                    await Promise.race(inFlight);

                    while (inFlight.size < concurrency && idx < windows.length) {
                        startWindow(windows[idx++]);
                    }
                }

                if (failedWindows.length > 0) {
                    throw new Error(
                        `Pass 1 failed for ${failedWindows.length} window${
                            failedWindows.length === 1 ? '' : 's'
                        }. Please retry the analysis.`
                    );
                }

                const labelsRaw: SentenceLabelMap = {};
                for (const [sid, set] of Object.entries(agg)) {
                    const arr = sortLabels(set);
                    if (arr.length > 0) labelsRaw[sid] = arr;
                }
                const labels = useEnvPropagation
                    ? propagateLabelsByEnvironment(latex, sentences, labelsRaw)
                    : labelsRaw;
                send('pass1_done', { labeledSentences: Object.keys(labels).length });

                // Phase 2: pass2 (already parallel across the 5 calls internally)
                send('pass2_start', { message: 'Building canonical sections…' });
                const { runPass2Streaming } = await import('@/lib/pipeline/pass2');
                const { sections, sections_concatenated_text } = await runPass2Streaming(
                    sentences,
                    labels,
                    {
                        concurrency: 5,
                        logger,
                        document_title: document_title ?? undefined,
                        abstract: abstract ?? undefined,
                        onPartial: ({ section, sections, sections_concatenated_text }) => {
                            send('pass2_section', {
                                section,
                                sections,
                                sections_concatenated_text,
                            });
                        },
                    }
                );
                send('pass2_done', { message: 'Canonical sections ready.' });
                const { sentence_citations, citations } = buildCitationData(latex, sentences, labels);
                send('pass3_start', {
                    message: 'Building audience views…',
                });
                const audience_views = await runPass3(sections, {
                    concurrency: 4,
                    logger,
                    document_title: document_title ?? undefined,
                    abstract: abstract ?? undefined,
                    citations,
                    sentence_citations,
                    sentences,
                    original_latex: latex,
                });
                send('sections', {
                    sections,
                    sections_concatenated_text,
                    sentence_citations,
                    citations,
                    audience_views,
                });
                send('pass3_done', { message: 'Audience views ready.' });

                // Final result
                send('done', {
                    document_title,
                    abstract,
                    filename: file.name,
                    original_latex: latex,
                    preprocessed_latex,
                    sentences,
                    labels,
                    sentence_citations,
                    citations,
                    sections,
                    sections_concatenated_text,
                    audience_views,
                });
            } catch (e) {
                send('error', {
                    error: e instanceof Error ? e.message : String(e),
                });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
        },
    });
}
