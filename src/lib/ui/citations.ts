import type { AnalysisResult } from '@/lib/pipeline/client';

export function getCitationEntries(
  result: AnalysisResult | null,
  keys: string[]
): Array<AnalysisResult['citations'][string]> {
  if (!result?.citations) return [];
  return keys.map((k) => result.citations?.[k]).filter(Boolean);
}

export function formatCitationLabel(entry: AnalysisResult['citations'][string]) {
  if (entry.label?.trim()) return entry.label.trim();
  if (entry.text) {
    const year = entry.text.match(/\b(19|20)\d{2}\b/)?.[0];
    const author = entry.text.split(',')[0]?.trim();
    if (author && year) return `${author} ${year}`;
    if (author) return author;
  }
  return entry.key;
}

export function getCitationKeysForSentenceIds(
  result: AnalysisResult | null,
  ids: number[]
): string[] {
  if (!result?.sentence_citations) return [];
  const keySet = new Set<string>();
  for (const id of ids) {
    const keys = result.sentence_citations?.[String(id)] ?? [];
    for (const key of keys) keySet.add(key);
  }
  return Array.from(keySet);
}
