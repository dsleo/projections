import { genkit, z } from 'genkit';
import openAI from '@genkit-ai/compat-oai';

/**
 * We use @genkit-ai/compat-oai so the provider is swappable later and
 * we can register custom model IDs (e.g. gpt-5-mini) even if not in a
 * predefined list.
 */

const ModelNameSchema = z.string().min(1);

export const DEFAULT_MODEL = (() => {
    const env = process.env.OPENAI_MODEL;
    if (env && ModelNameSchema.safeParse(env).success) return env;
    return 'gpt-5-mini';
})();

type GenkitHolder = {
    ai: ReturnType<typeof genkit>;
};

// Ensure singleton across Next.js dev HMR / module reloads.
declare global {
    var __genkitHolder: GenkitHolder | undefined;
}

function buildGenkit(): GenkitHolder {
    const ai = genkit({
        plugins: [
            openAI({
                name: 'openai',
                apiKey: process.env.OPENAI_API_KEY,
            }),
        ],
        model: `openai/${DEFAULT_MODEL}`,
    });
    return { ai };
}

export const ai = globalThis.__genkitHolder?.ai ?? buildGenkit().ai;

if (!globalThis.__genkitHolder) {
    globalThis.__genkitHolder = { ai };
}

export function resolveModelRef() {
    return `openai/${DEFAULT_MODEL}`;
}
