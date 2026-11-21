import { fetchOpenRouterRaw, normalizeOpenRouter } from "./openrouter";
import snapshot from "./snapshot.json";
import type { Catalog } from "./types";

/** A response with fewer models than this is treated as a broken upstream. */
const MIN_MODELS = 50;

async function loadLive(): Promise<Catalog> {
  const raw = await fetchOpenRouterRaw(AbortSignal.timeout(15_000));
  const { models, skipped } = normalizeOpenRouter(raw);
  if (models.length < MIN_MODELS) {
    throw new Error(`OpenRouter devolvió solo ${models.length} modelos válidos`);
  }
  return { models, skipped, source: "live", fetchedAt: new Date().toISOString() };
}

/** Load the current catalog, falling back to the committed snapshot. */
export async function getCatalog(): Promise<Catalog> {
  try {
    return await loadLive();
  } catch (error) {
    console.error("[catalog] usando snapshot:", error);
    return { ...(snapshot as unknown as Catalog), source: "snapshot" };
  }
}
