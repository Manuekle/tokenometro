import { describe, expect, it } from "vitest";
import type { ModelInfo } from "@/lib/catalog/types";
import { paretoFrontier } from "./analysis";
import { estimateModel, pickPrice, type TokenProfile, type Workload } from "./calc";

function model(over: Partial<ModelInfo> = {}): ModelInfo {
  return {
    id: "acme/m",
    name: "M",
    vendorSlug: "acme",
    vendor: "Acme",
    createdAt: 0,
    contextLength: 1_000_000,
    maxOutputTokens: null,
    tokenizer: "o200k",
    price: { input: 2, output: 10 },
    tiers: [],
    batch: null,
    reasoning: "none",
    inputModalities: ["text"],
    tools: true,
    structuredOutput: true,
    openWeights: false,
    hfId: null,
    intelligence: null,
    expiresAt: null,
    free: false,
    ...over,
  };
}

const WORKLOAD: Workload = {
  requestsPerMonth: 10_000,
  fixedInputTokens: 0,
  cacheablePct: 0,
  cacheHitRate: 0,
  batchShare: 0,
  reasoningTokens: 0,
  reasoningOnOptional: false,
};
const TOKENS: TokenProfile = { inputTokens: 1_000, outputTokens: 500 };

const est = (m: ModelInfo, t = TOKENS, w: Partial<Workload> = {}) =>
  estimateModel(m, t, { ...WORKLOAD, ...w });

describe("estimateModel — basics", () => {
  it("prices input and output per million tokens", () => {
    const e = est(model());
    // (1000 * 2 + 500 * 10) / 1e6 = 0.007 per request
    expect(e.perRequest).toBeCloseTo(0.007, 10);
    expect(e.monthly).toBeCloseTo(70, 8);
    expect(e.yearly).toBeCloseTo(840, 8);
  });

  it("adds fixed input tokens to the prompt", () => {
    const e = est(model(), TOKENS, { fixedInputTokens: 1_000 });
    expect(e.promptTokens).toBe(2_000);
    expect(e.perRequest).toBeCloseTo((2000 * 2 + 500 * 10) / 1e6, 10);
  });

  it("is zero with zero traffic and for free models", () => {
    expect(est(model(), TOKENS, { requestsPerMonth: 0 }).monthly).toBe(0);
    expect(est(model({ price: { input: 0, output: 0 }, free: true })).monthly).toBe(0);
  });
});

describe("estimateModel — prompt caching", () => {
  const cached = model({
    price: { input: 10, output: 0, cacheRead: 1, cacheWrite: 12.5 },
  });
  const t: TokenProfile = { inputTokens: 10_000, outputTokens: 0 };

  it("bills the cacheable prefix at read price on hits and write price on misses", () => {
    const e = est(cached, t, { cacheablePct: 0.8, cacheHitRate: 0.9 });
    // fresh 2000 * 10 + cached 8000 * (0.9 * 1 + 0.1 * 12.5) = 20000 + 17200
    expect(e.perRequest).toBeCloseTo(37_200 / 1e6, 10);
    expect(e.parts.input).toBeCloseTo(20_000 / 1e6, 10);
    expect(e.parts.cachedInput).toBeCloseTo(17_200 / 1e6, 10);
  });

  it("falls back to the input price on a miss when the vendor has no write fee", () => {
    const openai = model({ price: { input: 10, output: 0, cacheRead: 1 } });
    const e = est(openai, t, { cacheablePct: 1, cacheHitRate: 0.5 });
    // 10000 * (0.5 * 1 + 0.5 * 10) = 55000
    expect(e.perRequest).toBeCloseTo(55_000 / 1e6, 10);
  });

  it("never prices a cache miss below the normal input price", () => {
    // Some vendors list a "write" price that is a storage fee (cheaper than input).
    const storageFee = model({ price: { input: 10, output: 0, cacheRead: 1, cacheWrite: 0.2 } });
    const e = est(storageFee, t, { cacheablePct: 1, cacheHitRate: 0 });
    expect(e.perRequest).toBeCloseTo(100_000 / 1e6, 10);
  });

  it("gives no discount to models without prompt caching", () => {
    const plain = model({ price: { input: 10, output: 0 } });
    const e = est(plain, t, { cacheablePct: 1, cacheHitRate: 1 });
    expect(e.perRequest).toBeCloseTo(100_000 / 1e6, 10);
  });
});

describe("estimateModel — long-context tiers", () => {
  const tiered = model({
    price: { input: 8, output: 40 },
    tiers: [{ minPromptTokens: 272_000, input: 16, output: 60 }],
  });

  it("switches to the surcharge tier once the prompt reaches the threshold", () => {
    const small = est(tiered, { inputTokens: 100_000, outputTokens: 1_000 });
    const big = est(tiered, { inputTokens: 300_000, outputTokens: 1_000 });
    expect(small.tier).toBeNull();
    expect(small.perRequest).toBeCloseTo((100_000 * 8 + 1_000 * 40) / 1e6, 10);
    expect(big.tier?.minPromptTokens).toBe(272_000);
    expect(big.perRequest).toBeCloseTo((300_000 * 16 + 1_000 * 60) / 1e6, 10);
  });

  it("pickPrice uses the highest tier reached", () => {
    const base = { input: 1, output: 1 };
    const tiers = [
      { minPromptTokens: 100, input: 2, output: 2 },
      { minPromptTokens: 200, input: 3, output: 3 },
    ];
    expect(pickPrice(base, tiers, 99).price.input).toBe(1);
    expect(pickPrice(base, tiers, 100).price.input).toBe(2);
    expect(pickPrice(base, tiers, 999).price.input).toBe(3);
  });
});

describe("estimateModel — batch", () => {
  const withBatch = model({
    price: { input: 4, output: 20 },
    batch: { price: { input: 2, output: 10 }, tiers: [] },
  });

  it("blends standard and batch pricing by share of traffic", () => {
    const e = est(withBatch, TOKENS, { batchShare: 0.5 });
    const standard = (1000 * 4 + 500 * 20) / 1e6;
    expect(e.usesBatch).toBe(true);
    expect(e.perRequest).toBeCloseTo(standard * 0.75, 10);
  });

  it("does nothing for models without a batch offering", () => {
    const e = est(model(), TOKENS, { batchShare: 1 });
    expect(e.usesBatch).toBe(false);
    expect(e.perRequest).toBeCloseTo(0.007, 10);
  });
});

describe("estimateModel — reasoning", () => {
  const t: TokenProfile = { inputTokens: 0, outputTokens: 0 };
  const w = { reasoningTokens: 1_000 };

  it("bills reasoning tokens for always/default-on models only, unless opted in", () => {
    const output = (mode: ModelInfo["reasoning"], extra: Partial<Workload> = {}) =>
      est(model({ reasoning: mode, price: { input: 1, output: 10 } }), t, { ...w, ...extra })
        .perRequest;
    expect(output("mandatory")).toBeCloseTo(0.01, 10);
    expect(output("default")).toBeCloseTo(0.01, 10);
    expect(output("optional")).toBe(0);
    expect(output("optional", { reasoningOnOptional: true })).toBeCloseTo(0.01, 10);
    expect(output("none", { reasoningOnOptional: true })).toBe(0);
  });

  it("uses the dedicated reasoning price when the vendor sets one", () => {
    const m = model({ reasoning: "mandatory", price: { input: 1, output: 10, reasoning: 4 } });
    expect(est(m, t, w).perRequest).toBeCloseTo(0.004, 10);
  });
});

describe("estimateModel — fit", () => {
  it("flags requests that exceed the context window or the max output", () => {
    const small = model({ contextLength: 4_000, maxOutputTokens: 400 });
    expect(est(small, { inputTokens: 1_000, outputTokens: 300 }).fit).toBe("ok");
    expect(est(small, { inputTokens: 3_900, outputTokens: 300 }).fit).toBe("context");
    expect(est(small, { inputTokens: 500, outputTokens: 500 }).fit).toBe("output");
  });
});

describe("paretoFrontier", () => {
  const rows = [
    { id: "cheap-bad", cost: 1, q: 10 },
    { id: "cheap-good", cost: 1, q: 30 },
    { id: "mid-worse", cost: 5, q: 25 }, // dominated by cheap-good
    { id: "mid-better", cost: 5, q: 40 },
    { id: "pricey-best", cost: 50, q: 60 },
    { id: "pricey-meh", cost: 60, q: 50 }, // dominated
    { id: "unscored", cost: 0.1, q: null as number | null },
  ];

  it("keeps only non-dominated, scored rows", () => {
    const f = paretoFrontier(rows, (r) => r.cost, (r) => r.q);
    expect([...f].map((r) => r.id)).toEqual(["cheap-good", "mid-better", "pricey-best"]);
  });

  it("handles empty input", () => {
    expect(paretoFrontier([], () => 0, () => 0).size).toBe(0);
  });
});
