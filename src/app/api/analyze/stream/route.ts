import { createLogger } from '@/lib/logging';
import type { DiscourseLabel, SentenceLabelMap } from '@/lib/pipeline/types';
import { mapSentencesToOriginal, preprocessLatexWithMap } from '@/lib/pipeline/preprocess';
import { segmentSentences } from '@/lib/pipeline/segment';
import { buildSlidingWindows } from '@/lib/pipeline/windows';
import { classifyWindow } from '@/lib/pipeline/pass1';
import { runPass2 } from '@/lib/pipeline/pass2';

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

function extractDocumentTitle(latex: string): string | null {
    const titleMatch = latex.match(/\\title(?:\[[^\]]*\])?\{([\s\S]*?)\}/);
    if (!titleMatch) return null;
    let title = titleMatch[1]
        .replace(/\\[a-zA-Z*]+(?:\[[^\]]*\])?/g, '')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!title) return null;
    return title;
}

function extractAbstract(latex: string): string | null {
    const envMatch = latex.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
    const cmdMatch = latex.match(/\\abstract\s*\{([\s\S]*?)\}/);
    const raw = envMatch?.[1] ?? cmdMatch?.[1];
    if (!raw) return null;
    let abstract = raw
        .replace(/\\[a-zA-Z*]+(?:\[[^\]]*\])?/g, '')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!abstract) return null;
    return abstract;
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
                let inFlight = 0;
                let idx = 0;

                const pump = async (): Promise<void> => {
                    while (inFlight < concurrency && idx < windows.length) {
                        const w = windows[idx++];
                        inFlight++;
                        send('pass1_window_start', { start: w.start, end: w.end });
                        (async () => {
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
                                send('log', {
                                    level: 'error',
                                    msg: 'pass1_window:error',
                                    error: e instanceof Error ? e.message : String(e),
                                });
                            } finally {
                                inFlight--;
                            }
                        })();
                    }
                };

                // Main loop: keep pumping until done.
                while (idx < windows.length || inFlight > 0) {
                    await pump();
                    // tiny delay to yield event loop / allow completions to reduce CPU spin
                    await new Promise((r) => setTimeout(r, 25));
                }

                const labels: SentenceLabelMap = {};
                for (const [sid, set] of Object.entries(agg)) {
                    const arr = sortLabels(set);
                    if (arr.length > 0) labels[sid] = arr;
                }
                send('pass1_done', { labeledSentences: Object.keys(labels).length });

                // Phase 2: pass2 (already parallel across the 5 calls internally)
                const { sections, sections_concatenated_text } = await runPass2(sentences, labels, {
                    concurrency: 5,
                    logger,
                    document_title: document_title ?? undefined,
                    abstract: abstract ?? undefined,
                });
                send('sections', { sections, sections_concatenated_text });

                // Final result
                send('done', {
                    document_title,
                    filename: file.name,
                    original_latex: latex,
                    preprocessed_latex,
                    sentences,
                    labels,
                    sections,
                    sections_concatenated_text,
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
