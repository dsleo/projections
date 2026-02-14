export function formatIdRanges(ids: number[]): string {
  if (!ids || ids.length === 0) return '[]';
  const sorted = Array.from(new Set(ids)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = cur;
    prev = cur;
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return `[${ranges.join(', ')}]`;
}
