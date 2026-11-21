import { describe, expect, it } from "vitest";
import type { ModelInfo } from "@/lib/catalog/types";
import {
  DEFAULT_FILTERS,
  DEFAULT_WORKLOAD,
  type WorkloadState,
} from "@/lib/app-state";
import { analyze, applyFilters, computeRows, kneePoint, type Row } from "./compute-rows";

function model(id: string, over: Partial<ModelInfo> = {}): ModelInfo {
  return {
    id,
    name: id,
    vendorSlug: id.split("/")[0],
    vendor: id.split("/")[0],
    createdAt: 0,
    contextLength: 200_000,
    maxOutputTokens: null,
    tokenizer: "o200k",
    price: { input: 1, output: 1 },
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

const W: WorkloadState = {
  ...DEFAULT_WORKLOAD,
  requests: 1_000,
  period: "month",
  outputTokens: 100,
  fixedInputTokens: 0,
  cacheHitRate: 0,
};

const tokens = (o200k: number[], extra = {}) => ({
  kinds: o200k.map(() => "input" as const),
  engines: { o200k, ...extra },
  calibration: {},
});

describe("computeRows", () => {
  it("prices every model with its own tokenizer's count", () => {
    const rows = computeRows(
      [
        model("a/gpt", { tokenizer: "o200k" }),
        model("b/qwen", { tokenizer: "qwen" }),
      ],
      tokens([1_000], { qwen: [800] }),
      W,
    );
    const byId = Object.fromEntries(rows.map((r) => [r.model.id, r]));
    expect(byId["a/gpt"].promptTokens).toBe(1_000);
    expect(byId["b/qwen"].promptTokens).toBe(800);
    expect(byId["a/gpt"].accuracy).toBe("exact");
    expect(byId["b/qwen"].accuracy).toBe("exact");
  });

  it("marks families without an engine as estimates", () => {
    const [row] = computeRows([model("anthropic/c", { tokenizer: "claude" })], tokens([1_000]), W);
    expect(row.accuracy).toBe("estimate");
    expect(row.promptTokens).toBe(1_140);
  });

  it("averages input samples, scales by copies and uses the output sample when present", () => {
    const rows = computeRows(
      [model("a/m")],
      {
        kinds: ["input", "input", "output"],
        engines: { o200k: [100, 300, 50] },
        calibration: {},
      },
      { ...W, sampleCopies: 5 },
    );
    expect(rows[0].promptTokens).toBe(1_000); // mean(100, 300) * 5
    expect(rows[0].outputTokens).toBe(50);
  });

  it("ignores empty samples instead of averaging them in as 0 tokens", () => {
    const rows = computeRows(
      [model("a/m")],
      { kinds: ["input", null, "output", null], engines: { o200k: [400, 0, 90, 0] }, calibration: {} },
      W,
    );
    expect(rows[0].promptTokens).toBe(400);
    expect(rows[0].outputTokens).toBe(90);
  });

  it("falls back to the manual output tokens without an output sample", () => {
    const [row] = computeRows([model("a/m")], tokens([100]), W);
    expect(row.outputTokens).toBe(100);
  });

  it("derives the cacheable share from the fixed prefix and the reused part of the sample", () => {
    const m = model("a/m", { price: { input: 10, output: 0, cacheRead: 1 } });
    const [row] = computeRows(
      [m],
      tokens([1_000]),
      { ...W, outputTokens: 0, fixedInputTokens: 1_000, sampleReusePct: 0, cacheHitRate: 100 },
    );
    // prompt 2000: 1000 fresh @10 + 1000 cached @1 = 11000 per M
    expect(row.perRequest).toBeCloseTo(11_000 / 1e6, 10);
  });

  it("returns nothing while the reference tokenizer is not ready, but works with no samples", () => {
    const notReady = { kinds: ["input" as const], engines: {}, calibration: {} };
    expect(computeRows([model("a/m")], notReady, W)).toEqual([]);
    const empty = { kinds: [], engines: {}, calibration: {} };
    expect(computeRows([model("a/m")], empty, W)).toHaveLength(1);
  });

  it("supports per-day volume (30 days)", () => {
    const [row] = computeRows([model("a/m")], tokens([0]), { ...W, requests: 100, period: "day" });
    expect(row.monthly).toBeCloseTo(row.perRequest * 3_000, 10);
  });
});

describe("computeRows — a model's own tokenizer", () => {
  const glm = (id: string, hfId: string | null) =>
    model(id, { tokenizer: "other", hfId, openWeights: hfId !== null });

  it("prefers the counts of the model's own repo over its family estimate", () => {
    const rows = computeRows(
      [glm("z-ai/glm-5", "zai-org/GLM-5.3"), glm("z-ai/glm-5-air", "zai-org/GLM-5.3-Air")],
      tokens([1_000], { "hf:zai-org/GLM-5.3": [820] }),
      W,
    );
    const byId = Object.fromEntries(rows.map((r) => [r.model.id, r]));
    expect(byId["z-ai/glm-5"]).toMatchObject({ promptTokens: 820, accuracy: "exact", engine: "hf:zai-org/GLM-5.3" });
    // the sibling has no loaded tokenizer yet: still the family estimate
    expect(byId["z-ai/glm-5-air"]).toMatchObject({ promptTokens: 1_000, accuracy: "estimate", engine: "other" });
  });

  it("gives every model of the same repo the same exact count", () => {
    const rows = computeRows(
      [glm("a/one", "owner/shared"), glm("a/two", "owner/shared")],
      tokens([1_000], { "hf:owner/shared": [700] }),
      W,
    );
    expect(rows.map((r) => r.promptTokens)).toEqual([700, 700]);
  });

  it("ignores repos that are not loaded, models without a repo, and malformed repo ids", () => {
    const rows = computeRows(
      [glm("a/no-repo", null), glm("a/bad-repo", "../etc/passwd"), glm("a/cold", "owner/cold")],
      tokens([1_000]),
      W,
    );
    expect(rows.map((r) => r.engine)).toEqual(["other", "other", "other"]);
    expect(rows.every((r) => r.accuracy === "estimate")).toBe(true);
  });

  it("also upgrades a family that is already exact when the model's repo is loaded", () => {
    const [row] = computeRows(
      [model("qwen/q", { tokenizer: "qwen", hfId: "Qwen/Qwen3.7-Flash" })],
      tokens([1_000], { qwen: [900], "hf:Qwen/Qwen3.7-Flash": [905] }),
      W,
    );
    expect(row.promptTokens).toBe(905);
    expect(row.engine).toBe("hf:Qwen/Qwen3.7-Flash");
  });
});

describe("applyFilters", () => {
  const rows = computeRows(
    [
      model("openai/big", { intelligence: 60, price: { input: 10, output: 10 }, tools: true }),
      model("openai/free", { free: true, price: { input: 0, output: 0 } }),
      model("meta/open", { openWeights: true, intelligence: 30, tools: false }),
      model("google/vis", { inputModalities: ["text", "image"], contextLength: 1_000_000 }),
      model("acme/tiny", { contextLength: 1_000 }),
    ],
    tokens([5_000]),
    W,
  );
  const ids = (f: Partial<typeof DEFAULT_FILTERS>, pinned: string[] = []) =>
    applyFilters(rows, { ...DEFAULT_FILTERS, ...f }, new Set(pinned))
      .map((r) => r.model.id)
      .sort();

  it("hides free models and requests that do not fit by default", () => {
    expect(ids({})).toEqual(["google/vis", "meta/open", "openai/big"]);
    expect(ids({ includeFree: true })).toContain("openai/free");
    expect(ids({ hideNoFit: false })).toContain("acme/tiny");
  });

  it("filters by vendor, quality, budget, context, capabilities and search", () => {
    expect(ids({ vendors: ["meta"] })).toEqual(["meta/open"]);
    expect(ids({ minIntelligence: 50 })).toEqual(["openai/big"]);
    // $5.10/month for the $1/$1 models, $51 for openai/big ($10/$10)
    expect(ids({ maxMonthly: 10 })).toEqual(["google/vis", "meta/open"]);
    expect(ids({ minContext: 500_000 })).toEqual(["google/vis"]);
    expect(ids({ vision: true })).toEqual(["google/vis"]);
    expect(ids({ tools: true })).toEqual(["google/vis", "openai/big"]);
    expect(ids({ openWeightsOnly: true })).toEqual(["meta/open"]);
    expect(ids({ search: "VIS" })).toEqual(["google/vis"]);
    expect(ids({ pinnedOnly: true }, ["meta/open"])).toEqual(["meta/open"]);
  });
});

describe("analyze", () => {
  const mk = (id: string, monthly: number, q: number | null): Row =>
    ({
      model: model(id, { intelligence: q }),
      monthly,
      perRequest: monthly / 1_000,
    }) as Row;

  it("finds cheapest, best quality and the frontier", () => {
    const rows = [mk("a", 10, 20), mk("b", 50, 40), mk("c", 55, 35), mk("d", 400, 60), mk("e", 5, null)];
    const a = analyze(rows);
    expect(a.cheapest?.model.id).toBe("e");
    expect(a.bestQuality?.model.id).toBe("d");
    expect(a.frontier.map((r) => r.model.id)).toEqual(["a", "b", "d"]);
    expect(a.multiple(rows[0])).toBe(2);
  });

  it("breaks quality ties in favor of the cheaper model", () => {
    const a = analyze([mk("x", 100, 50), mk("y", 10, 50)]);
    expect(a.bestQuality?.model.id).toBe("y");
  });

  it("handles an empty list", () => {
    const a = analyze([]);
    expect(a.cheapest).toBeNull();
    expect(a.bestQuality).toBeNull();
    expect(a.balanced).toBeNull();
    expect(a.frontier).toEqual([]);
  });

  it("picks the knee: where more spend stops buying much quality", () => {
    // quality jumps early (10 -> 55 for 10x cost), then crawls (55 -> 60 for 100x).
    const frontier = [mk("cheap", 10, 10), mk("knee", 100, 55), mk("luxury", 10_000, 60)];
    expect(kneePoint(frontier)?.model.id).toBe("knee");
    expect(kneePoint(frontier.slice(0, 2))).toBeNull();
  });
});
