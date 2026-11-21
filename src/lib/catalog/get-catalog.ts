import { cacheLife } from "next/cache";
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

/**
 * Model catalog with prices. Live from OpenRouter, cached for an hour;
 * falls back to the committed snapshot (and retries soon) if the API fails.
 */
export async function getCatalog(): Promise<Catalog> {
  "use cache";

  try {
    const live = await loadLive();
    cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
    return live;
  } catch (error) {
    console.error("[catalog] usando snapshot:", error);
    cacheLife({ stale: 60, revalidate: 120, expire: 600 });
    return { ...(snapshot as unknown as Catalog), source: "snapshot" };
  }
}
