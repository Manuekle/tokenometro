import type { TokenizerId } from "@/lib/tokenizers/registry";

/** USD per 1,000,000 tokens. */
export interface PriceTable {
  input: number;
  output: number;
  /** Price of tokens read from the prompt cache. */
  cacheRead?: number;
  /** Price of tokens written to the prompt cache (5 min / default TTL). */
  cacheWrite?: number;
  /** Price of tokens written to the 1-hour prompt cache. */
  cacheWrite1h?: number;
  /** Price of reasoning ("thinking") tokens when different from output. */
  reasoning?: number;
}

/** Long-context surcharge: applies when the prompt has at least this many tokens. */
export interface PriceTier extends PriceTable {
  minPromptTokens: number;
}

export interface BatchPricing {
  price: PriceTable;
  tiers: PriceTier[];
}

/**
 * How the model treats reasoning tokens (billed as output):
 *  - none      : no reasoning support
 *  - optional  : supported, off unless requested
 *  - default   : on unless disabled
 *  - mandatory : always on
 */
export type ReasoningMode = "none" | "optional" | "default" | "mandatory";

export interface ModelInfo {
  /** OpenRouter id, e.g. "anthropic/claude-fable-5.2". */
  id: string;
  name: string;
  vendorSlug: string;
  vendor: string;
  /** Unix seconds. */
  createdAt: number;
  contextLength: number;
  maxOutputTokens: number | null;
  tokenizer: TokenizerId;
  price: PriceTable;
  /** Sorted ascending by minPromptTokens. */
  tiers: PriceTier[];
  /** Batch API pricing, when the vendor offers it for this model. */
  batch: BatchPricing | null;
  reasoning: ReasoningMode;
  inputModalities: string[];
  tools: boolean;
  structuredOutput: boolean;
  openWeights: boolean;
  hfId: string | null;
  /** Artificial Analysis Intelligence Index (higher is better). */
  intelligence: number | null;
  /** ISO date when the vendor retires the model. */
  expiresAt: string | null;
  free: boolean;
}

export interface Catalog {
  models: ModelInfo[];
  source: "live" | "snapshot";
  /** ISO timestamp of when the list was fetched from the source. */
  fetchedAt: string;
  /** Raw entries that were dropped (routers, non-text, malformed...). */
  skipped: number;
}
