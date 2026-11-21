/** UI-level state: what the person types, in the units they think in. */

export type Period = "day" | "month";

export interface WorkloadState {
  requests: number;
  period: Period;
  /** Visible output tokens per request (used when there is no output sample). */
  outputTokens: number;
  /** Fixed prompt prefix: system prompt, instructions, tool schemas. Cacheable. */
  fixedInputTokens: number;
  /** How many times the input sample appears in one request (e.g. 5 RAG chunks). */
  sampleCopies: number;
  /** % of the sample that repeats across requests and can be cached. */
  sampleReusePct: number;
  /** % of requests that find the cacheable prefix already cached. */
  cacheHitRate: number;
  /** % of traffic sent through the Batch API (where the vendor offers it). */
  batchShare: number;
  /** Extra reasoning tokens per request on models that reason by default. */
  reasoningTokens: number;
  reasoningOnOptional: boolean;
}

export const DAYS_PER_MONTH = 30;

export const DEFAULT_WORKLOAD: WorkloadState = {
  requests: 40_000,
  period: "month",
  outputTokens: 250,
  fixedInputTokens: 1_200,
  sampleCopies: 1,
  sampleReusePct: 0,
  cacheHitRate: 90,
  batchShare: 0,
  reasoningTokens: 0,
  reasoningOnOptional: false,
};

export const requestsPerMonth = (w: WorkloadState): number =>
  w.period === "day" ? w.requests * DAYS_PER_MONTH : w.requests;

export interface FilterState {
  /** Vendor slugs. Empty = all. */
  vendors: string[];
  /** Minimum Artificial Analysis Intelligence Index. 0 = off. */
  minIntelligence: number;
  /** Maximum monthly budget in USD. null = no limit. */
  maxMonthly: number | null;
  /** Minimum context window in tokens. 0 = any. */
  minContext: number;
  vision: boolean;
  tools: boolean;
  openWeightsOnly: boolean;
  includeFree: boolean;
  /** Drop models where the request does not fit context / max output. */
  hideNoFit: boolean;
  pinnedOnly: boolean;
  search: string;
}

export const DEFAULT_FILTERS: FilterState = {
  vendors: [],
  minIntelligence: 0,
  maxMonthly: null,
  minContext: 0,
  vision: false,
  tools: false,
  openWeightsOnly: false,
  includeFree: false,
  hideNoFit: true,
  pinnedOnly: false,
  search: "",
};

export type SampleKind = "input" | "output";
