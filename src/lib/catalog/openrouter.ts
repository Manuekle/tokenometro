import { resolveTokenizerId } from "@/lib/tokenizers/registry";
import { vendorLabel } from "./vendors";
import type {
  BatchPricing,
  ModelInfo,
  PriceTable,
  PriceTier,
  ReasoningMode,
} from "./types";

/**
 * Public, key-less endpoint. Prices are USD per token (as strings) and match
 * each vendor's list price. It also exposes tokenizer family, capabilities,
 * Hugging Face id (open-weight models) and Artificial Analysis benchmarks.
 */
export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** USD-per-token (string or number) -> USD per 1M tokens. Negative = invalid. */
function perMillion(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0) return undefined;
  // toPrecision strips float noise: 0.000008 * 1e6 -> 8, not 8.000000000000001
  return Number((n * 1e6).toPrecision(12));
}

function readPrice(p: Json, fallback?: PriceTable): PriceTable | null {
  const input = perMillion(p.prompt) ?? fallback?.input;
  const output = perMillion(p.completion) ?? fallback?.output;
  if (input === undefined || output === undefined) return null;

  const price: PriceTable = { input, output };
  const cacheRead = perMillion(p.input_cache_read) ?? fallback?.cacheRead;
  const cacheWrite = perMillion(p.input_cache_write) ?? fallback?.cacheWrite;
  const cacheWrite1h =
    perMillion(p.input_cache_write_1h) ?? fallback?.cacheWrite1h;
  const reasoning = perMillion(p.internal_reasoning);
  if (cacheRead !== undefined) price.cacheRead = cacheRead;
  if (cacheWrite !== undefined) price.cacheWrite = cacheWrite;
  if (cacheWrite1h !== undefined) price.cacheWrite1h = cacheWrite1h;
  if (reasoning !== undefined && reasoning !== output) price.reasoning = reasoning;
  return price;
}

/** `pricing.overrides`: long-context surcharges keyed on prompt size. */
function readTiers(p: Json, base: PriceTable): PriceTier[] {
  if (!Array.isArray(p.overrides)) return [];
  const tiers: PriceTier[] = [];
  for (const o of p.overrides) {
    if (!isObj(o)) continue;
    const min = finite(o.min_prompt_tokens);
    if (min === null || min <= 0) continue;
    const price = readPrice(o, base);
    if (price) tiers.push({ ...price, minPromptTokens: min });
  }
  return tiers.sort((a, b) => a.minPromptTokens - b.minPromptTokens);
}

function readReasoning(m: Json, params: string[]): ReasoningMode {
  if (isObj(m.reasoning)) {
    if (m.reasoning.mandatory === true) return "mandatory";
    if (m.reasoning.default_enabled === true) return "default";
    return "optional";
  }
  return params.includes("reasoning") || params.includes("include_reasoning")
    ? "optional"
    : "none";
}

/** "Anthropic: Claude Fable 5.2" -> "Claude Fable 5.2" (vendor shown separately). */
function cleanName(name: string): string {
  return name.replace(/^[^:]{1,30}:\s+/, "");
}

function toModel(m: Json, batchItem: Json | undefined): ModelInfo | null {
  const id = m.id as string;
  // "~vendor/...-latest" aliases and OpenRouter's own routers have variable pricing.
  if (id.startsWith("~") || id.startsWith("openrouter/")) return null;

  const arch = isObj(m.architecture) ? m.architecture : {};
  const tokenizerLabel = str(arch.tokenizer);
  if (tokenizerLabel === "Router") return null;

  // Text in, text out only. Image/audio/video generators are billed differently.
  const inputModalities = strArray(arch.input_modalities);
  const outputModalities = strArray(arch.output_modalities);
  if (!inputModalities.includes("text")) return null;
  if (outputModalities.length !== 1 || outputModalities[0] !== "text") return null;

  if (!isObj(m.pricing)) return null;
  const price = readPrice(m.pricing); // null on negative ("-1" = variable) prices
  if (!price) return null;

  const contextLength = finite(m.context_length);
  if (contextLength === null || contextLength <= 0) return null;

  let batch: BatchPricing | null = null;
  if (batchItem && isObj(batchItem.pricing)) {
    const batchPrice = readPrice(batchItem.pricing);
    if (batchPrice) {
      batch = { price: batchPrice, tiers: readTiers(batchItem.pricing, batchPrice) };
    }
  }

  const params = strArray(m.supported_parameters);
  const top = isObj(m.top_provider) ? m.top_provider : {};
  const bench = isObj(m.benchmarks) ? m.benchmarks : {};
  const aa = isObj(bench.artificial_analysis) ? bench.artificial_analysis : {};
  const hfId = str(m.hugging_face_id);
  const vendorSlug = id.split("/")[0];

  return {
    id,
    name: cleanName(str(m.name) ?? id),
    vendorSlug,
    vendor: vendorLabel(vendorSlug),
    createdAt: finite(m.created) ?? 0,
    contextLength,
    maxOutputTokens: finite(top.max_completion_tokens),
    tokenizer: resolveTokenizerId(id, tokenizerLabel),
    price,
    tiers: readTiers(m.pricing, price),
    batch,
    reasoning: readReasoning(m, params),
    inputModalities,
    tools: params.includes("tools"),
    structuredOutput:
      params.includes("structured_outputs") || params.includes("response_format"),
    openWeights: hfId !== null,
    hfId,
    intelligence: finite(aa.intelligence_index),
    expiresAt: str(m.expiration_date),
    free: id.endsWith(":free") || (price.input === 0 && price.output === 0),
  };
}

/**
 * OpenRouter payload -> our model list.
 *
 *  - "<id>:batch" entries are folded into their base model as `batch` pricing.
 *  - Routers, aliases, non-text models and variable-price entries are dropped.
 *  - One malformed entry never breaks the rest.
 */
export function normalizeOpenRouter(raw: unknown): {
  models: ModelInfo[];
  skipped: number;
} {
  const list = isObj(raw) && Array.isArray(raw.data) ? raw.data : [];
  const bases: Json[] = [];
  const batches = new Map<string, Json>();
  let skipped = 0;

  for (const item of list) {
    if (!isObj(item) || typeof item.id !== "string") {
      skipped++;
    } else if (item.id.endsWith(":batch")) {
      batches.set(item.id.slice(0, -":batch".length), item);
    } else {
      bases.push(item);
    }
  }

  const baseIds = new Set(bases.map((b) => b.id as string));
  for (const baseId of batches.keys()) if (!baseIds.has(baseId)) skipped++;

  const models: ModelInfo[] = [];
  for (const item of bases) {
    try {
      const model = toModel(item, batches.get(item.id as string));
      if (model) models.push(model);
      else skipped++;
    } catch {
      skipped++;
    }
  }

  models.sort((a, b) => b.createdAt - a.createdAt);
  return { models, skipped };
}

export async function fetchOpenRouterRaw(signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(OPENROUTER_MODELS_URL, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`OpenRouter respondió HTTP ${res.status}`);
  return res.json();
}
