import { describe, expect, it } from "vitest";
import type { ModelInfo } from "@/lib/catalog/types";
import { DEFAULT_WORKLOAD } from "@/lib/app-state";
import { computeRows } from "@/lib/compute-rows";
import { downloadSize, ownRepo, refineTargets } from "./refine";

function model(id: string, over: Partial<ModelInfo> = {}): ModelInfo {
  return {
    id,
    name: id.split("/")[1],
    vendorSlug: id.split("/")[0],
    vendor: id.split("/")[0],
    createdAt: 0,
    contextLength: 128_000,
    maxOutputTokens: null,
    tokenizer: "other",
    price: { input: 1, output: 1 },
    tiers: [],
    batch: null,
    reasoning: "none",
    inputModalities: ["text"],
    tools: true,
    structuredOutput: true,
    openWeights: true,
    hfId: null,
    intelligence: null,
    expiresAt: null,
    free: false,
    ...over,
  };
}

const W = { ...DEFAULT_WORKLOAD, requests: 1_000, period: "month" as const };
const rowsOf = (models: ModelInfo[], engines: Record<string, number[]> = { o200k: [1_000] }) =>
  computeRows(models, { kinds: ["input"], engines, calibration: {} }, W);

describe("downloadSize", () => {
  it("adds up the sizes it knows", () => {
    expect(downloadSize([27_000_000, 9_000_000])).toBe("≈36 MB");
    expect(downloadSize([2_100_000])).toBe("≈2.1 MB");
  });

  it("says 'o más' when some sizes are unknown, instead of passing a partial sum as the total", () => {
    expect(downloadSize([27_000_000, 0])).toBe("≈27 MB o más");
  });

  it("gives nothing when no size is known, so the sentence never reads '≈?'", () => {
    expect(downloadSize([0, 0])).toBeNull();
    expect(downloadSize([])).toBeNull();
  });
});

describe("ownRepo", () => {
  it("returns the repo only when it is a safe owner/name id", () => {
    expect(ownRepo(model("a/x", { hfId: "zai-org/GLM-5.3" }))).toBe("zai-org/GLM-5.3");
    expect(ownRepo(model("a/x", { hfId: null }))).toBeNull();
    expect(ownRepo(model("a/x", { hfId: "../../secrets" }))).toBeNull();
    expect(ownRepo(model("a/x", { hfId: "https://evil.example/a" }))).toBeNull();
  });
});

describe("refineTargets", () => {
  it("lists estimated models that publish a repo, grouped so a shared repo downloads once", () => {
    const rows = rowsOf([
      model("a/one", { hfId: "owner/shared" }),
      model("a/two", { hfId: "owner/shared" }),
      model("a/solo", { hfId: "owner/solo" }),
    ]);
    const targets = refineTargets(rows, new Set());
    expect(targets).toEqual([
      { repo: "owner/shared", models: ["one", "two"] },
      { repo: "owner/solo", models: ["solo"] },
    ]);
  });

  it("skips models that cannot improve: no repo, a bad repo, or already requested", () => {
    const rows = rowsOf([
      model("a/closed", { hfId: null, openWeights: false }),
      model("a/bad", { hfId: "../x" }),
      model("a/asked", { hfId: "owner/asked" }),
      model("a/fresh", { hfId: "owner/fresh" }),
    ]);
    expect(refineTargets(rows, new Set(["owner/asked"])).map((t) => t.repo)).toEqual(["owner/fresh"]);
  });

  it("skips models already counted exactly, by their own repo or by an exact family engine", () => {
    const rows = rowsOf(
      [
        model("a/own", { hfId: "owner/own" }),
        model("q/qwen", { tokenizer: "qwen", hfId: "Qwen/Qwen3.7" }),
        model("a/todo", { hfId: "owner/todo" }),
      ],
      { o200k: [1_000], "hf:owner/own": [900], qwen: [950] },
    );
    expect(refineTargets(rows, new Set()).map((t) => t.repo)).toEqual(["owner/todo"]);
  });

  it("returns nothing for an empty list", () => {
    expect(refineTargets([], new Set())).toEqual([]);
  });
});
