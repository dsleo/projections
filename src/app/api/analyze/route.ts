import { NextResponse } from 'next/server';

import { analyzeLatex } from '@/lib/pipeline/server';
import { createLogger } from '@/lib/logging';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    const requestId = crypto.randomUUID();
    const logger = createLogger({ requestId, route: '/api/analyze' });
    try {
        logger.info('request:start');
        const form = await req.formData();
        const file = form.get('file');
        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'Missing file' }, { status: 400 });
        }
        if (!file.name.endsWith('.tex')) {
            return NextResponse.json({ error: 'Only .tex is supported' }, { status: 400 });
        }

        logger.info('request:file', { name: file.name, size: file.size, type: file.type });

        const latex = await file.text();
        const result = await analyzeLatex(latex, { logger, requestId });
        logger.info('request:done');
        return NextResponse.json(result);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        logger.error('request:error', { error: msg });
        return NextResponse.json(
            {
                error: msg,
            },
            { status: 500 }
        );
    }
}

