import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk";
import { countLargeText, loadCounter, piecesFromIds } from "./counters";
import { TOKENIZERS, TOKENIZER_IDS, ENGINE_IDS } from "./registry";
import { resolveFamilyTokens } from "./resolve";

/** Deterministic pseudo-random prose so BPE caches cannot flatter the test. */
function prose(chars: number, seed = 7): string {
  const words = [
    "cliente", "factura", "sistema", "integración", "the", "quick", "token",
    "función", "contrato", "revisión", "invoice", "customer", "API", "12345",
    "análisis", "servicio", "mensual", "report", "ñandú", "café",
  ];
  let state = seed;
  const next = () => (state = (state * 1103515245 + 12345) & 0x7fffffff);
  let out = "";
  let line = 0;
  while (out.length < chars) {
    const w = words[next() % words.length];
    out += w;
    line += w.length + 1;
    if (line > 80) {
      out += "\n";
      line = 0;
    } else out += " ";
  }
  return out;
}

describe("chunkText", () => {
  it("handles empty and short text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("hola")).toEqual(["hola"]);
  });

  it("is lossless and respects the size budget", () => {
    const text = prose(500_000);
    const chunks = chunkText(text, 100_000);
    expect(chunks.length).toBeGreaterThan(4);
    expect(chunks.join("")).toBe(text);
    for (const c of chunks) expect(c.length).toBeLessThan(100_000 + 200);
  });

  it("cuts after line breaks when it can", () => {
    const chunks = chunkText(prose(300_000), 100_000);
    for (const c of chunks.slice(0, -1)) expect(c.endsWith("\n")).toBe(true);
  });

  it("never splits a surrogate pair", () => {
    const emoji = "😀".repeat(50_000); // no newlines at all
    const chunks = chunkText(emoji, 1_001);
    expect(chunks.join("")).toBe(emoji);
    for (const c of chunks) {
      const last = c.charCodeAt(c.length - 1);
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
    }
  });
});

describe("OpenAI engines (real tokenizers)", () => {
  it("o200k and cl100k count the classic example", async () => {
    const o200k = await loadCounter("o200k");
    const cl100k = await loadCounter("cl100k");
    expect(o200k.count("hello world")).toBe(2);
    expect(cl100k.count("hello world")).toBe(2);
    expect(o200k.count("")).toBe(0);
  });

  it("treats special-token lookalikes as plain text instead of throwing", async () => {
    const o200k = await loadCounter("o200k");
    expect(() => o200k.count("x <|endoftext|> y")).not.toThrow();
    expect(o200k.count("<|endoftext|>")).toBeGreaterThan(1);
  });

  it("chunked counting equals whole-text counting", async () => {
    const o200k = await loadCounter("o200k");
    const text = prose(450_000);
    expect(countLargeText(o200k, text)).toBe(o200k.count(text));
  });

  it("refuses families without an engine", async () => {
    await expect(loadCounter("claude")).rejects.toThrow(/motor/);
  });
});

describe("token pieces (ribbon)", () => {
  it("cuts text into exactly the counted tokens and loses nothing", async () => {
    const o200k = await loadCounter("o200k");
    const text = "Estimado equipo de soporte: ¿podrían revisar la factura n.º 12345?";
    const pieces = o200k.pieces(text);
    expect(pieces.join("")).toBe(text);
    expect(pieces.length).toBe(o200k.count(text));
    expect(pieces.every((p) => p.length > 0)).toBe(true);
  });

  it("merges multi-byte characters split across tokens into one piece", async () => {
    const o200k = await loadCounter("o200k");
    const text = "ok 😀🚀 fin";
    const pieces = o200k.pieces(text);
    expect(pieces.join("")).toBe(text);
    expect(pieces.some((p) => p.includes("\uFFFD"))).toBe(false);
    expect(pieces.length).toBeLessThanOrEqual(o200k.count(text));
  });

  it("piecesFromIds survives decoders that are not prefix-stable", () => {
    // decode() that drops the first char once the sequence is long: the
    // fallback must decode the single token instead of slicing garbage.
    const weird = (ids: number[]) => (ids.length > 2 ? ids.slice(1).join("") : ids.join(""));
    const pieces = piecesFromIds([1, 2, 3], weird);
    expect(pieces).toHaveLength(3);
    expect(pieces[2]).toBe("3");
  });
});

describe("resolveFamilyTokens", () => {
  it("falls back to ratio x o200k when no engine is loaded", () => {
    const r = resolveFamilyTokens("claude", { o200k: [100, 200] });
    expect(r.accuracy).toBe("estimate");
    expect(r.perSample).toEqual([114, 228]);
  });

  it("returns null until the reference engine is ready", () => {
    expect(resolveFamilyTokens("claude", {}).perSample).toBeNull();
  });

  it("uses the family engine when loaded", () => {
    const r = resolveFamilyTokens("qwen", { o200k: [100], qwen: [94] });
    expect(r).toEqual({ perSample: [94], accuracy: "exact" });
  });

  it("aliases Gemini to Gemma once Gemma is loaded", () => {
    const r = resolveFamilyTokens("gemini", { o200k: [100], gemma: [78] });
    expect(r).toEqual({ perSample: [78], accuracy: "approx" });
    expect(resolveFamilyTokens("gemini", { o200k: [100] }).accuracy).toBe("estimate");
  });

  it("calibration wins over every other source", () => {
    const r = resolveFamilyTokens(
      "gemini",
      { o200k: [100], gemma: [78] },
      { gemini: 1.3 },
    );
    expect(r).toEqual({ perSample: [130], accuracy: "calibrated" });
  });
});

describe("registry", () => {
  it("is internally consistent", () => {
    for (const id of TOKENIZER_IDS) {
      const spec = TOKENIZERS[id];
      expect(spec.id).toBe(id);
      expect(spec.ratio).toBeGreaterThan(0);
      if (spec.engine === "hf") expect(spec.hfRepo).toMatch(/^[\w.-]+\/[\w.-]+$/);
      if (spec.engine === "tiktoken") expect(spec.encoding).toBeDefined();
      if (spec.engine === "alias") {
        expect(spec.aliasOf && TOKENIZERS[spec.aliasOf].engine).toBe("hf");
      }
    }
    expect(ENGINE_IDS).toContain("o200k");
    expect(ENGINE_IDS).not.toContain("claude");
  });
});
