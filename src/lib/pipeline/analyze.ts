import type { AnalysisResult } from './types';

import { buildCitationData } from './citations';
import { mapSentencesToOriginal, preprocessLatexWithMap } from './preprocess';
import { segmentSentences } from './segment';
import { buildSlidingWindows } from './windows';
import { runPass1 } from './pass1';
import { runPass2 } from './pass2';
import { runPass3 } from './pass3';
import { propagateLabelsByEnvironment } from './env_propagation';
import { extractDocumentTitle, extractAbstract } from './preprocess';
import { createLogger, time, type Logger } from '../logging';

export type AnalyzeOptions = {
    pass1Concurrency?: number;
    pass2Concurrency?: number;
    logger?: Logger;
    requestId?: string;
    useEnvPropagation?: boolean;
};

export async function analyzeLatex(
    latex: string,
    opts: AnalyzeOptions = {}
): Promise<AnalysisResult> {
    const logger =
        opts.logger ?? createLogger({ requestId: opts.requestId ?? 'unknown' });

    logger.info('analyze:start', { inputChars: latex.length });

    const { result: preprocessed } = await time(logger, 'preprocess', async () =>
        Promise.resolve(preprocessLatexWithMap(latex))
    );
    const { text: preprocessed_latex, map: preprocess_map } = preprocessed;

    const { result: sentences } = await time(logger, 'segment', async () =>
        Promise.resolve(mapSentencesToOriginal(segmentSentences(preprocessed_latex, 1), preprocess_map))
    );
    logger.info('segment:stats', { sentences: sentences.length });

    const { result: windows } = await time(logger, 'windows', async () =>
        Promise.resolve(buildSlidingWindows(sentences))
    );
    logger.info('windows:stats', { windows: windows.length });

    const { result: labelsRaw } = await time(logger, 'pass1', async () =>
        runPass1(windows, sentences, {
            concurrency: opts.pass1Concurrency ?? 6,
            logger,
        })
    );
    const labels = opts.useEnvPropagation
        ? propagateLabelsByEnvironment(latex, sentences, labelsRaw)
        : labelsRaw;
    logger.info('pass1:stats', { labeledSentences: Object.keys(labels).length });

    const { result: pass2 } = await time(logger, 'pass2', async () =>
        runPass2(sentences, labels, {
            concurrency: opts.pass2Concurrency ?? 5,
            logger,
        })
    );
    const { sections, sections_concatenated_text } = pass2;

    const { sentence_citations, citations } = buildCitationData(latex, sentences, labels);
    const document_title = extractDocumentTitle(latex);
    const abstract = extractAbstract(latex);
    const { result: audience_views } = await time(logger, 'pass3', async () =>
        runPass3(sections, {
            concurrency: 4,
            logger,
            document_title: document_title ?? undefined,
            abstract: abstract ?? undefined,
            citations,
            sentence_citations,
            sentences,
            original_latex: latex,
        })
    );

    logger.info('analyze:done', {
        sentences: sentences.length,
        labeledSentences: Object.keys(labels).length,
        concatenatedChars: sections_concatenated_text.length,
    });

    return {
        document_title: document_title ?? undefined,
        abstract: abstract ?? undefined,
        filename: undefined,
        original_latex: latex,
        preprocessed_latex,
        sentences,
        labels,
        sentence_citations,
        citations,
        sections,
        sections_concatenated_text,
        audience_views,
    };
}
