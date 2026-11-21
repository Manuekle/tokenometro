/**
 * Splits text into pieces of roughly `maxChars`, cutting at line breaks so
 * the summed token count stays (almost) identical to counting the whole text:
 * BPE pre-tokenizers never merge across newlines, and we never cut inside a
 * run of consecutive newlines nor inside a surrogate pair.
 */
export function chunkText(text: string, maxChars = 120_000): string[] {
  if (text.length === 0) return [];
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const nl = text.lastIndexOf("\n", end - 1);
      if (nl > start + maxChars * 0.5) {
        end = nl + 1;
        while (end < text.length && text[end] === "\n") end++;
      } else {
        const last = text.charCodeAt(end - 1);
        if (last >= 0xd800 && last <= 0xdbff) end -= 1; // high surrogate
      }
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}
