/**
 * Exact token counts for the two vendors that do not publish a tokenizer,
 * through their own free counting endpoints. Called straight from the browser
 * with the person's key: it never touches our server and is never stored.
 */

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

type FetchLike = typeof fetch;

/** "anthropic/claude-fable-5.2" -> "claude-fable-5-2" (Anthropic API ids use dashes). */
export function anthropicModelId(openRouterId: string): string {
  return openRouterId.replace(/^anthropic\//, "").replace(/\./g, "-");
}

/** "google/gemini-4-neon" -> "gemini-4-neon". */
export function geminiModelId(openRouterId: string): string {
  return openRouterId.replace(/^google\//, "");
}

function errorMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const error = (body as { error?: unknown }).error;
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return null;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function explain(status: number, provider: string, detail: string | null): string {
  if (status === 401 || status === 403) return `${provider} rechazó la clave. Revísala y vuelve a intentar.`;
  if (status === 404) return `${provider} no encontró ese modelo${detail ? `: ${detail}` : ""}.`;
  if (status === 429) return `${provider} limitó las solicitudes. Espera un momento y reintenta.`;
  return detail ?? `${provider} respondió HTTP ${status}.`;
}

export async function countAnthropic(
  { apiKey, model, text }: { apiKey: string; model: string; text: string },
  fetchImpl: FetchLike = fetch,
): Promise<number> {
  const res = await fetchImpl("https://api.anthropic.com/v1/messages/count_tokens", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // Anthropic requires this opt-in for calls made from a browser.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model, messages: [{ role: "user", content: text }] }),
  });
  const body = await readJson(res);
  if (!res.ok) throw new ProviderError(explain(res.status, "Anthropic", errorMessage(body)), res.status);
  const tokens = (body as { input_tokens?: unknown } | null)?.input_tokens;
  if (typeof tokens !== "number") throw new ProviderError("Anthropic devolvió una respuesta inesperada.");
  return tokens;
}

export async function countGemini(
  { apiKey, model, text }: { apiKey: string; model: string; text: string },
  fetchImpl: FetchLike = fetch,
): Promise<number> {
  const res = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:countTokens`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text }] }] }),
    },
  );
  const body = await readJson(res);
  if (!res.ok) throw new ProviderError(explain(res.status, "Google", errorMessage(body)), res.status);
  const tokens = (body as { totalTokens?: unknown } | null)?.totalTokens;
  if (typeof tokens !== "number") throw new ProviderError("Google devolvió una respuesta inesperada.");
  return tokens;
}

/**
 * Ratio of the vendor's token count to o200k on the same texts.
 *
 * Vendor endpoints count a whole request, so a few tokens of message framing
 * come along. A one-character probe measures that overhead and it is removed.
 */
export async function measureRatio({
  texts,
  vendorCount,
  localCount,
}: {
  texts: string[];
  vendorCount: (text: string) => Promise<number>;
  localCount: (text: string) => Promise<number>;
}): Promise<number> {
  const usable = texts.filter((t) => t.trim().length > 0);
  if (usable.length === 0) throw new ProviderError("Agrega un texto de entrada para calibrar.");

  const overhead = Math.max(0, (await vendorCount("a")) - (await localCount("a")));
  let vendor = 0;
  let local = 0;
  for (const text of usable) {
    vendor += Math.max(0, (await vendorCount(text)) - overhead);
    local += await localCount(text);
  }
  if (local <= 0 || vendor <= 0) throw new ProviderError("No se pudo medir: el conteo salió en cero.");
  return vendor / local;
}
