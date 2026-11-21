/**
 * Efficient frontier: the models for which no other model is both cheaper
 * (or equal) AND better (or equal) in quality. Rows without a quality score
 * cannot be placed and are left out.
 */
export function paretoFrontier<T>(
  rows: T[],
  cost: (row: T) => number,
  quality: (row: T) => number | null,
): Set<T> {
  const scored = rows
    .map((row) => ({ row, cost: cost(row), quality: quality(row) }))
    .filter((r): r is { row: T; cost: number; quality: number } => r.quality !== null);

  // Cheapest first; among equal prices, best quality first.
  scored.sort((a, b) => a.cost - b.cost || b.quality - a.quality);

  const frontier = new Set<T>();
  let best = -Infinity;
  for (const r of scored) {
    if (r.quality > best) {
      frontier.add(r.row);
      best = r.quality;
    }
  }
  return frontier;
}
