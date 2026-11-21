import type { ModelInfo, PriceTable, PriceTier } from "@/lib/catalog/types";

const PER_MILLION = 1_000_000;

export interface Workload {
  requestsPerMonth: number;
  /** Tokens added to every prompt regardless of the sample (tool schemas, framing). */
  fixedInputTokens: number;
  /** Share (0..1) of the prompt that is a stable, cacheable prefix. */
  cacheablePct: number;
  /** Share (0..1) of requests that find that prefix already cached. */
  cacheHitRate: number;
  /** Share (0..1) of requests sent through the Batch API (where offered). */
  batchShare: number;
  /** Extra reasoning ("thinking") tokens per request, billed as output. */
  reasoningTokens: number;
  /** Also apply reasoning tokens to models where reasoning is optional. */
  reasoningOnOptional: boolean;
}

/** Tokens per request as counted by ONE model's tokenizer. */
export interface TokenProfile {
  inputTokens: number;
  outputTokens: number;
}

/** USD per request, split by what you pay for. */
export interface CostParts {
  input: number;
  cachedInput: number;
  output: number;
  reasoning: number;
}

export type Fit = "ok" | "context" | "output";

export interface ModelEstimate {
  model: ModelInfo;
  promptTokens: number;
  /** Part of the prompt eligible for caching, and the rest. */
  cachedTokens: number;
  freshTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  /** Long-context surcharge tier in effect on the standard path, if any. */
  tier: PriceTier | null;
  fit: Fit;
  /** Part of the traffic is priced with the Batch API. */
  usesBatch: boolean;
  /** Blended USD per request. */
  parts: CostParts;
  perRequest: number;
  monthly: number;
  yearly: number;
}

/** Highest surcharge tier whose threshold the prompt reaches (tiers sorted asc). */
export function pickPrice(
  base: PriceTable,
  tiers: PriceTier[],
  promptTokens: number,
): { price: PriceTable; tier: PriceTier | null } {
  let tier: PriceTier | null = null;
  for (const t of tiers) if (promptTokens >= t.minPromptTokens) tier = t;
  return { price: tier ?? base, tier };
}

interface RequestShape {
  promptTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheablePct: number;
  cacheHitRate: number;
}

/**
 * Cost of one request with a given price table.
 *
 * The cacheable prefix is billed at the cache-read price on a hit and at the
 * cache-write price (or the normal input price when the vendor has no write
 * fee) on a miss. Models without a cache-read price get no caching at all.
 */
export function requestCost(price: PriceTable, r: RequestShape): CostParts {
  const cachedTokens = r.promptTokens * r.cacheablePct;
  const freshTokens = r.promptTokens - cachedTokens;

  // A miss pays at least the normal input price: a "write" price below it is a
  // storage fee, not a replacement for the input charge.
  const caches = price.cacheRead !== undefined;
  const missRate = Math.max(price.input, price.cacheWrite ?? price.input);
  const cachedRate = caches
    ? r.cacheHitRate * (price.cacheRead as number) + (1 - r.cacheHitRate) * missRate
    : price.input;

  return {
    input: (freshTokens * price.input) / PER_MILLION,
    cachedInput: (cachedTokens * cachedRate) / PER_MILLION,
    output: (r.outputTokens * price.output) / PER_MILLION,
    reasoning: (r.reasoningTokens * (price.reasoning ?? price.output)) / PER_MILLION,
  };
}

const sum = (p: CostParts) => p.input + p.cachedInput + p.output + p.reasoning;

function blend(a: CostParts, b: CostParts, shareOfB: number): CostParts {
  const mix = (x: number, y: number) => x * (1 - shareOfB) + y * shareOfB;
  return {
    input: mix(a.input, b.input),
    cachedInput: mix(a.cachedInput, b.cachedInput),
    output: mix(a.output, b.output),
    reasoning: mix(a.reasoning, b.reasoning),
  };
}

function appliesReasoning(model: ModelInfo, w: Workload): boolean {
  if (model.reasoning === "mandatory" || model.reasoning === "default") return true;
  return model.reasoning === "optional" && w.reasoningOnOptional;
}

/** Monthly/yearly cost of running `workload` on `model`. */
export function estimateModel(
  model: ModelInfo,
  tokens: TokenProfile,
  workload: Workload,
): ModelEstimate {
  const promptTokens = tokens.inputTokens + workload.fixedInputTokens;
  const outputTokens = tokens.outputTokens;
  const reasoningTokens = appliesReasoning(model, workload) ? workload.reasoningTokens : 0;

  const shape: RequestShape = {
    promptTokens,
    outputTokens,
    reasoningTokens,
    cacheablePct: workload.cacheablePct,
    cacheHitRate: workload.cacheHitRate,
  };

  const standard = pickPrice(model.price, model.tiers, promptTokens);
  const standardParts = requestCost(standard.price, shape);

  let parts = standardParts;
  let usesBatch = false;
  if (model.batch && workload.batchShare > 0) {
    const batch = pickPrice(model.batch.price, model.batch.tiers, promptTokens);
    parts = blend(standardParts, requestCost(batch.price, shape), workload.batchShare);
    usesBatch = true;
  }

  const perRequest = sum(parts);
  const monthly = perRequest * workload.requestsPerMonth;

  let fit: Fit = "ok";
  if (promptTokens + outputTokens + reasoningTokens > model.contextLength) fit = "context";
  else if (model.maxOutputTokens !== null && outputTokens + reasoningTokens > model.maxOutputTokens)
    fit = "output";

  const cachedTokens = promptTokens * workload.cacheablePct;
  return {
    model,
    promptTokens,
    cachedTokens,
    freshTokens: promptTokens - cachedTokens,
    outputTokens,
    reasoningTokens,
    tier: standard.tier,
    fit,
    usesBatch,
    parts,
    perRequest,
    monthly,
    yearly: monthly * 12,
  };
}
