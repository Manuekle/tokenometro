import { describe, expect, it } from "vitest";
import type { ModelInfo } from "@/lib/catalog/types";
import { DEFAULT_WORKLOAD } from "@/lib/app-state";
import { computeRows, type Row } from "@/lib/compute-rows";
import {
  METRICS,
  compareContext,
  groupMetrics,
  summarize,
  toMarkdown,
  visibleMetrics,
  winners,
} from "./compare";

function model(id: string, over: Partial<ModelInfo> = {}): ModelInfo {
  return {
    id,
    name: id.split("/")[1],
    vendorSlug: id.split("/")[0],
    vendor: id.split("/")[0],
    createdAt: 0,
    contextLength: 128_000,
    maxOutputTokens: 8_000,
    tokenizer: "o200k",
    price: { input: 1, output: 4 },
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

const W = { ...DEFAULT_WORKLOAD, requests: 1_000, period: "month" as const, outputTokens: 100, fixedInputTokens: 0, cacheHitRate: 0 };

function rowsOf(models: ModelInfo[], engines = { o200k: [1_000] as number[] } as Record<string, number[]>): Row[] {
  return computeRows(models, { kinds: ["input"], engines, calibration: {} }, W);
}

const metric = (key: string) => METRICS.find((m) => m.key === key)!;

describe("winners", () => {
  const rows = rowsOf([
    model("a/cheap", { price: { input: 1, output: 1 }, intelligence: 30, contextLength: 100_000 }),
    model("a/mid", { price: { input: 3, output: 3 }, intelligence: 50, contextLength: 100_000 }),
    model("a/pro", { price: { input: 9, output: 9 }, intelligence: 50, contextLength: 1_000_000 }),
  ]);

  it("picks the lowest cost and the highest quality, ties included", () => {
    expect([...winners(rows, metric("monthly"))]).toEqual(["a/cheap"]);
    expect([...winners(rows, metric("index"))].sort()).toEqual(["a/mid", "a/pro"]);
    expect([...winners(rows, metric("context"))]).toEqual(["a/pro"]);
  });

  it("names no winner when every value is the same or fewer than two are comparable", () => {
    expect(winners(rows, metric("tools")).size).toBe(0); // all true
    expect(winners(rows, metric("prompt")).size).toBe(0); // same tokenizer, same tokens
    const lone = rowsOf([model("a/x", { intelligence: 10 }), model("a/y", { intelligence: null })]);
    expect(winners(lone, metric("index")).size).toBe(0);
  });

  it("skips metrics without a ranking (words, multiples)", () => {
    expect(winners(rows, metric("counting")).size).toBe(0);
    expect(winners(rows, metric("multiple")).size).toBe(0);
  });

  it("ranks 'No ofrece' as not comparable instead of as zero", () => {
    const set = rowsOf([
      model("a/with", { price: { input: 1, output: 1, cacheRead: 0.1 } }),
      model("a/without", { price: { input: 1, output: 1 } }),
      model("a/also", { price: { input: 1, output: 1, cacheRead: 0.5 } }),
    ]);
    expect([...winners(set, metric("pCache"))]).toEqual(["a/with"]);
  });
});

describe("metrics layout", () => {
  it("hides rows that say nothing and keeps the declared group order", () => {
    const rows = rowsOf([model("a/x"), model("a/y")]);
    const keys = visibleMetrics(rows).map((m) => m.key);
    expect(keys).not.toContain("reasoningTokens");
    expect(keys).not.toContain("expires");
    const groups = groupMetrics(visibleMetrics(rows)).map((g) => g.title);
    expect(groups).toEqual(["Costo", "Tokens por solicitud", "Tarifas · USD por millón", "Calidad y límites"]);
  });

  it("shows reasoning and retirement rows when some model has them", () => {
    const rows = computeRows(
      [model("a/x", { reasoning: "mandatory", expiresAt: "2027-01-31" }), model("a/y")],
      { kinds: ["input"], engines: { o200k: [1_000] }, calibration: {} },
      { ...W, reasoningTokens: 500 },
    );
    const keys = visibleMetrics(rows).map((m) => m.key);
    expect(keys).toContain("reasoningTokens");
    expect(keys).toContain("expires");
  });

  it("describes how each count was made", () => {
    const rows = rowsOf(
      [
        model("a/own", { tokenizer: "other", hfId: "owner/own" }),
        model("a/guess", { tokenizer: "claude" }),
        model("a/exact"),
      ],
      { o200k: [1_000], "hf:owner/own": [900] },
    );
    const text = Object.fromEntries(rows.map((r) => [r.model.id, metric("counting").text(r, compareContext(rows))]));
    expect(text).toEqual({
      "a/own": "Exacto · tokenizador propio",
      "a/guess": "Estimado",
      "a/exact": "Exacto",
    });
  });
});

describe("summarize", () => {
  it("states cost, quality and the cost of the quality gain", () => {
    const rows = rowsOf([
      model("a/cheap", { price: { input: 1, output: 1 }, intelligence: 30 }),
      model("a/best", { price: { input: 10, output: 10 }, intelligence: 60 }),
    ]);
    const lines = summarize(rows);
    expect(lines[0]).toMatch(/^cheap es el más barato \(\$/);
    expect(lines[0]).toMatch(/best cuesta 10× más/);
    expect(lines[1]).toBe("best tiene el mayor índice de inteligencia (60.0).");
    expect(lines[2]).toMatch(/^Pasar de cheap a best suma 30 puntos de índice por \$/);
  });

  it("points out when tokenizers disagree about the same request", () => {
    const rows = rowsOf(
      [model("a/gpt"), model("b/qwen", { tokenizer: "qwen" })],
      { o200k: [1_000], qwen: [1_230] },
    );
    expect(summarize(rows).join(" ")).toMatch(/pesa de 1,000 a 1,230 tokens .* \(23% de diferencia\)/);
  });

  it("says so when prices are essentially the same, and needs two models", () => {
    const same = rowsOf([model("a/x"), model("a/y")]);
    expect(summarize(same)[0]).toMatch(/^Cuestan casi lo mismo/);
    expect(summarize(rowsOf([model("a/x")]))).toEqual([]);
  });
});

describe("toMarkdown", () => {
  it("renders a pasteable table, cheapest first, escaping pipes", () => {
    const rows = rowsOf([
      model("a/pro", { name: "Pro | Max", price: { input: 9, output: 9 } }),
      model("a/cheap", { price: { input: 1, output: 1 } }),
    ]);
    const md = toMarkdown(rows, "6,000 solicitudes al mes");
    const lines = md.split("\n");
    expect(lines[0]).toBe("**6,000 solicitudes al mes**");
    expect(lines[2]).toBe("| | cheap | Pro \\| Max |");
    expect(lines[3]).toBe("|---|---|---|");
    expect(md).toMatch(/\| \*\*Costo\*\* \|/);
    expect(md).toMatch(/\| Por mes \| \$[\d.]+ \| \$[\d.]+ \|/);
    // every table line has the same number of columns
    const columns = (l: string) => l.replace(/\\\|/g, "").split("|").length;
    const table = lines.slice(2);
    expect(new Set(table.map(columns)).size).toBe(1);
  });
});
