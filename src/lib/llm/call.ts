import type { ZodType } from 'zod';

import { ai, resolveModelRef } from './genkit';
import { extractFirstJson } from './json';
import type { Logger } from '../logging';

export type LlmCallOptions<T> = {
    system: string;
    user: string;
    schema: ZodType<T>;
    temperature?: number;
    maxRetries?: number;
    logger?: Logger;
    name?: string;
};

export async function callJson<T>(opts: LlmCallOptions<T>): Promise<T> {
    const maxRetries = opts.maxRetries ?? 2;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            opts.logger?.info('llm:call', {
                name: opts.name,
                attempt,
                model: resolveModelRef(),
                userChars: opts.user.length,
            });
            const res = await ai.generate({
                model: resolveModelRef(),
                system: opts.system,
                prompt: opts.user,
                config: {
                    temperature: opts.temperature ?? 0,
                },
                output: {
                    format: 'json',
                    // Passing a schema makes Genkit inject stricter formatting instructions and
                    // (for compatible models) request JSON-schema output.
                    schema: opts.schema,
                },
            });

            // Genkit will often parse JSON as res.output.
            const parsed: unknown = res.output ?? extractFirstJson(res.text);
            opts.logger?.info('llm:validate', {
                name: opts.name,
                attempt,
            });
            return opts.schema.parse(parsed);
        } catch (e) {
            lastErr = e;
            opts.logger?.warn('llm:retry', {
                name: opts.name,
                attempt,
                error: e instanceof Error ? e.message : String(e),
            });
        }
    }
    throw lastErr;
}
