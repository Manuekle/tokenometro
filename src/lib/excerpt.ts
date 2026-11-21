/**
 * One-line preview of a sample for the token ribbon: whitespace collapsed,
 * cut at a word boundary. Only affects what is drawn, never what is counted.
 */
export function makeExcerpt(text: string, max = 110): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
}
