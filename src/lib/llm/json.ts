/**
 * Extract a strict JSON object/array from an LLM response.
 * Genkit often already parses json into response.output, but we keep this
 * as a robust fallback.
 */

export function extractFirstJson(text: string): unknown {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Empty response');

    // Fast path
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return JSON.parse(trimmed);
    }

    // Heuristic: find first { or [ and attempt to parse progressively.
    const start = Math.min(
        ...['{', '[']
            .map((c) => trimmed.indexOf(c))
            .filter((i) => i >= 0)
    );
    if (!Number.isFinite(start)) {
        throw new Error('No JSON start found');
    }
    const candidate = trimmed.slice(start);

    // Try parsing with shrinking tail.
    for (let end = candidate.length; end > 1; end--) {
        const slice = candidate.slice(0, end);
        try {
            return JSON.parse(slice);
        } catch {
            // continue
        }
    }
    throw new Error('Unable to parse JSON from response');
}
