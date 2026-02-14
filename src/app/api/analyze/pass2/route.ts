import { runPass2 } from '@/lib/pipeline/pass2';
import { createLogger } from '@/lib/logging';
import { extractAbstract, extractDocumentTitle } from '@/lib/pipeline/preprocess';
import type { Sentence, SentenceLabelMap } from '@/lib/pipeline/types';

export const runtime = 'nodejs';

type Pass2Request = {
    original_latex: string;
    sentences: Sentence[];
    labels: SentenceLabelMap;
    document_title?: string;
    abstract?: string;
};

export async function POST(req: Request) {
    const requestId = crypto.randomUUID();
    const logger = createLogger({ requestId, route: '/api/analyze/pass2' });

    try {
        const payload = (await req.json()) as Pass2Request;
        const original_latex = payload.original_latex ?? '';
        const sentences = payload.sentences ?? [];
        const labels = payload.labels ?? {};
        const document_title =
            payload.document_title ?? extractDocumentTitle(original_latex) ?? undefined;
        const abstract = payload.abstract ?? extractAbstract(original_latex) ?? undefined;

        const { sections, sections_concatenated_text } = await runPass2(sentences, labels, {
            concurrency: 5,
            logger,
            document_title,
            abstract,
        });
        return Response.json({
            sections,
            sections_concatenated_text,
            abstract,
        });
    } catch (e) {
        return Response.json(
            { error: e instanceof Error ? e.message : String(e) },
            { status: 500 }
        );
    }
}
