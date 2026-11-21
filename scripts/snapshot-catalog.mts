/**
 * Refreshes src/lib/catalog/snapshot.json from OpenRouter.
 * The snapshot is the fallback used when the live API is unreachable.
 *
 *   pnpm snapshot
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  fetchOpenRouterRaw,
  normalizeOpenRouter,
} from "../src/lib/catalog/openrouter";
import type { Catalog } from "../src/lib/catalog/types";

const out = fileURLToPath(
  new URL("../src/lib/catalog/snapshot.json", import.meta.url),
);

const raw = await fetchOpenRouterRaw(AbortSignal.timeout(30_000));
const { models, skipped } = normalizeOpenRouter(raw);

if (models.length < 50) {
  throw new Error(`Catálogo sospechosamente chico (${models.length}); no se escribe.`);
}

const catalog: Catalog = {
  models,
  skipped,
  source: "snapshot",
  fetchedAt: new Date().toISOString(),
};
await writeFile(out, JSON.stringify(catalog) + "\n");

const withIndex = models.filter((m) => m.intelligence !== null).length;
const withBatch = models.filter((m) => m.batch).length;
const withTiers = models.filter((m) => m.tiers.length > 0).length;
console.log(
  `snapshot: ${models.length} modelos (${skipped} descartados) · ` +
    `${withIndex} con índice AA · ${withBatch} con batch · ${withTiers} con tramos de contexto largo`,
);
