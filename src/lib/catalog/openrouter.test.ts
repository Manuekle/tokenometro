import { describe, expect, it } from "vitest";
import { TOKENIZERS, resolveTokenizerId } from "@/lib/tokenizers/registry";
import { normalizeOpenRouter } from "./openrouter";
import snapshot from "./snapshot.json";
import type { Catalog } from "./types";

function entry(over: Record<string, unknown> = {}) {
  return {
    id: "acme/model-a",
    name: "Acme: Model A",
    created: 1_700_000_000,
    context_length: 128_000,
    architecture: {
      input_modalities: ["text"],
      output_modalities: ["text"],
      tokenizer: "Other",
    },
    pricing: { prompt: "0.000002", completion: "0.00001" },
    top_provider: { max_completion_tokens: 8192 },
    supported_parameters: ["tools", "temperature"],
    ...over,
  };
}

const run = (...items: unknown[]) => normalizeOpenRouter({ data: items });

describe("normalizeOpenRouter", () => {
  it("converts USD/token strings to USD per 1M tokens without float noise", () => {
    const { models } = run(
      entry({
        pricing: {
          prompt: "0.000008",
          completion: "0.00004",
          input_cache_read: "0.0000002",
          input_cache_write: "0.00001",
        },
      }),
    );
    expect(models[0].price).toEqual({
      input: 8,
      output: 40,
      cacheRead: 0.2,
      cacheWrite: 10,
    });
  });

  it("folds :batch variants into the base model and hides them from the list", () => {
    const { models, skipped } = run(
      entry({ pricing: { prompt: "0.000004", completion: "0.00002" } }),
      entry({
        id: "acme/model-a:batch",
        pricing: { prompt: "0.000002", completion: "0.00001" },
      }),
    );
    expect(models).toHaveLength(1);
    expect(models[0].batch?.price).toEqual({ input: 2, output: 10 });
    expect(skipped).toBe(0);
  });

  it("counts a :batch entry without a base model as skipped", () => {
    const { models, skipped } = run(entry({ id: "acme/ghost:batch" }));
    expect(models).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("drops routers, aliases, variable-price and non-text models", () => {
    const { models, skipped } = run(
      entry({ id: "openrouter/auto", pricing: { prompt: "-1", completion: "-1" } }),
      entry({ id: "~acme/model-latest" }),
      entry({
        id: "acme/priced-by-use",
        pricing: { prompt: "-1", completion: "-1" },
      }),
      entry({
        id: "acme/painter",
        architecture: {
          input_modalities: ["text"],
          output_modalities: ["image", "text"],
          tokenizer: "Other",
        },
      }),
      entry({
        id: "acme/vision-only",
        architecture: {
          input_modalities: ["image"],
          output_modalities: ["text"],
          tokenizer: "Other",
        },
      }),
      entry({ id: "acme/ok" }),
    );
    expect(models.map((m) => m.id)).toEqual(["acme/ok"]);
    expect(skipped).toBe(5);
  });

  it("survives malformed entries without throwing", () => {
    const { models, skipped } = run(
      null,
      "nope",
      { name: "no id" },
      entry({ id: "acme/no-pricing", pricing: undefined }),
      entry({ id: "acme/bad-context", context_length: "big" }),
      entry({ id: "acme/ok" }),
    );
    expect(models.map((m) => m.id)).toEqual(["acme/ok"]);
    expect(skipped).toBe(5);
    expect(normalizeOpenRouter(undefined).models).toEqual([]);
    expect(normalizeOpenRouter({ data: "x" }).models).toEqual([]);
  });

  it("reads long-context price tiers (pricing.overrides), sorted, inheriting cache fields", () => {
    const { models } = run(
      entry({
        pricing: {
          prompt: "0.000008",
          completion: "0.00004",
          input_cache_read: "0.0000004",
          overrides: [
            { min_prompt_tokens: 272000, prompt: "0.000016", completion: "0.00006" },
            { min_prompt_tokens: 128000, prompt: "0.000012", completion: "0.00005" },
            { min_prompt_tokens: 0, prompt: "1", completion: "1" },
          ],
        },
      }),
    );
    const { tiers } = models[0];
    expect(tiers.map((t) => t.minPromptTokens)).toEqual([128000, 272000]);
    expect(tiers[1]).toMatchObject({ input: 16, output: 60, cacheRead: 0.4 });
  });

  it("derives reasoning mode, open weights, intelligence index and expiry", () => {
    const { models } = run(
      entry({
        id: "acme/thinker",
        reasoning: { mandatory: false, default_enabled: true },
        hugging_face_id: "acme/Thinker",
        benchmarks: { artificial_analysis: { intelligence_index: 48.5 } },
        expiration_date: "2027-01-31",
      }),
      entry({ id: "acme/always", reasoning: { mandatory: true } }),
      entry({ id: "acme/toggle", reasoning: { mandatory: false, default_enabled: false } }),
      entry({ id: "acme/plain" }),
      entry({
        id: "acme/legacy-flag",
        supported_parameters: ["include_reasoning"],
        benchmarks: { artificial_analysis: { intelligence_index: null } },
      }),
    );
    const byId = Object.fromEntries(models.map((m) => [m.id, m]));
    expect(byId["acme/thinker"]).toMatchObject({
      reasoning: "default",
      openWeights: true,
      hfId: "acme/Thinker",
      intelligence: 48.5,
      expiresAt: "2027-01-31",
    });
    expect(byId["acme/always"].reasoning).toBe("mandatory");
    expect(byId["acme/toggle"].reasoning).toBe("optional");
    expect(byId["acme/plain"].reasoning).toBe("none");
    expect(byId["acme/legacy-flag"].reasoning).toBe("optional");
    expect(byId["acme/legacy-flag"].intelligence).toBeNull();
    expect(byId["acme/plain"].intelligence).toBeNull();
  });

  it("flags free models and strips the vendor prefix from the name", () => {
    const { models } = run(
      entry({
        id: "acme/model-a:free",
        name: "Acme: Model A (free)",
        pricing: { prompt: "0", completion: "0" },
      }),
    );
    expect(models[0].free).toBe(true);
    expect(models[0].name).toBe("Model A (free)");
    expect(models[0].vendor).toBe("Acme");
  });

  it("keeps a separate reasoning price only when it differs from output", () => {
    const { models } = run(
      entry({
        id: "acme/same",
        pricing: { prompt: "0.000001", completion: "0.000004", internal_reasoning: "0.000004" },
      }),
      entry({
        id: "acme/diff",
        pricing: { prompt: "0.000001", completion: "0.000004", internal_reasoning: "0.000002" },
      }),
    );
    const byId = Object.fromEntries(models.map((m) => [m.id, m]));
    expect(byId["acme/same"].price.reasoning).toBeUndefined();
    expect(byId["acme/diff"].price.reasoning).toBe(2);
  });
});

describe("resolveTokenizerId", () => {
  it("separates cl100k (GPT-4, GPT-3.5) from o200k (4o, 4.1, 5+, o-series)", () => {
    const r = (id: string) => resolveTokenizerId(id, "GPT");
    expect(r("openai/gpt-4")).toBe("cl100k");
    expect(r("openai/gpt-4-turbo")).toBe("cl100k");
    expect(r("openai/gpt-3.5-turbo-16k")).toBe("cl100k");
    expect(r("openai/gpt-4o")).toBe("o200k");
    expect(r("openai/gpt-4.1-mini")).toBe("o200k");
    expect(r("openai/gpt-5.2")).toBe("o200k");
    expect(r("openai/o3")).toBe("o200k");
    expect(r("openai/gpt-oss-120b")).toBe("o200k");
  });

  it("maps OpenRouter tokenizer labels and defaults to 'other'", () => {
    expect(resolveTokenizerId("anthropic/x", "Claude")).toBe("claude");
    expect(resolveTokenizerId("google/x", "Gemini")).toBe("gemini");
    expect(resolveTokenizerId("qwen/x", "Qwen3")).toBe("qwen");
    expect(resolveTokenizerId("meta-llama/x", "Llama3")).toBe("llama3");
    expect(resolveTokenizerId("z-ai/glm", "Other")).toBe("other");
    expect(resolveTokenizerId("x/y", null)).toBe("other");
  });
});

describe("committed snapshot", () => {
  const catalog = snapshot as unknown as Catalog;

  it("has a sane size and metadata", () => {
    expect(catalog.models.length).toBeGreaterThan(100);
    expect(catalog.source).toBe("snapshot");
    expect(Number.isNaN(Date.parse(catalog.fetchedAt))).toBe(false);
  });

  it("only contains valid, priced, text-only models", () => {
    const ids = new Set<string>();
    for (const m of catalog.models) {
      expect(ids.has(m.id), `duplicate ${m.id}`).toBe(false);
      ids.add(m.id);
      expect(m.id.endsWith(":batch")).toBe(false);
      expect(m.price.input).toBeGreaterThanOrEqual(0);
      expect(m.price.output).toBeGreaterThanOrEqual(0);
      expect(m.contextLength).toBeGreaterThan(0);
      expect(TOKENIZERS[m.tokenizer], `unknown tokenizer ${m.tokenizer}`).toBeDefined();
      const mins = m.tiers.map((t) => t.minPromptTokens);
      expect(mins).toEqual([...mins].sort((a, b) => a - b));
    }
  });
});
