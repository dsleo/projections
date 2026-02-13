import { buildCitationData } from '@/lib/pipeline/citations';
import { runPass3 } from '@/lib/pipeline/pass3';
import { createLogger } from '@/lib/logging';
import { extractAbstract, extractDocumentTitle } from '@/lib/pipeline/preprocess';
import type { CanonicalSections, Sentence, SentenceLabelMap } from '@/lib/pipeline/types';

export const runtime = 'nodejs';

type Pass3Request = {
    original_latex: string;
    sentences: Sentence[];
    labels: SentenceLabelMap;
    sections: CanonicalSections;
    document_title?: string;
    abstract?: string;
};

export async function POST(req: Request) {
    const requestId = crypto.randomUUID();
    const logger = createLogger({ requestId, route: '/api/analyze/pass3' });

    try {
        const payload = (await req.json()) as Pass3Request;
        const original_latex = payload.original_latex ?? '';
        const sentences = payload.sentences ?? [];
        const labels = payload.labels ?? {};
        const sections = payload.sections;
        if (!sections) {
            return Response.json({ error: 'Missing sections' }, { status: 400 });
        }
        const document_title =
            payload.document_title ?? extractDocumentTitle(original_latex) ?? undefined;
        const abstract = payload.abstract ?? extractAbstract(original_latex) ?? undefined;

        const { sentence_citations, citations } = buildCitationData(
            original_latex,
            sentences,
            labels
        );
        const audience_views = await runPass3(sections, {
            concurrency: 4,
            logger,
            document_title,
            abstract,
            citations,
            sentence_citations,
            sentences,
            original_latex,
        });

        return Response.json({
            audience_views,
            sentence_citations,
            citations,
        });
    } catch (e) {
        return Response.json(
            { error: e instanceof Error ? e.message : String(e) },
            { status: 500 }
        );
    }
}
