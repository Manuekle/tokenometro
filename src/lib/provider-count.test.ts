import { describe, expect, it, vi } from "vitest";
import {
  ProviderError,
  anthropicModelId,
  countAnthropic,
  countGemini,
  geminiModelId,
  measureRatio,
} from "./provider-count";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("model ids", () => {
  it("maps OpenRouter ids to each vendor's API id", () => {
    expect(anthropicModelId("anthropic/claude-fable-5.2")).toBe("claude-fable-5-2");
    expect(anthropicModelId("anthropic/claude-haiku-5.5")).toBe("claude-haiku-5-5");
    expect(geminiModelId("google/gemini-4-neon")).toBe("gemini-4-neon");
  });
});

describe("countAnthropic", () => {
  it("calls the count_tokens endpoint straight from the browser with the key header", async () => {
    const fetchMock = vi.fn(async () => json({ input_tokens: 42 }));
    const n = await countAnthropic(
      { apiKey: "sk-test", model: "claude-sonnet-5-5", text: "hola" },
      fetchMock as unknown as typeof fetch,
    );
    expect(n).toBe(42);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages/count_tokens");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "x-api-key": "sk-test",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      model: "claude-sonnet-5-5",
      messages: [{ role: "user", content: "hola" }],
    });
  });

  it("turns HTTP errors into messages a person can act on", async () => {
    const call = (status: number, body: unknown) =>
      countAnthropic(
        { apiKey: "k", model: "m", text: "t" },
        (async () => json(body, status)) as unknown as typeof fetch,
      );
    await expect(call(401, { error: { message: "invalid x-api-key" } })).rejects.toThrow(/rechazó la clave/);
    await expect(call(404, { error: { message: "model: nope" } })).rejects.toThrow(/no encontró ese modelo: model: nope/);
    await expect(call(429, {})).rejects.toThrow(/limitó las solicitudes/);
    await expect(call(500, { error: { message: "boom" } })).rejects.toThrow("boom");
    await expect(call(200, { nope: 1 })).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("countGemini", () => {
  it("sends the key in a header and the text as contents", async () => {
    const fetchMock = vi.fn(async () => json({ totalTokens: 7 }));
    const n = await countGemini(
      { apiKey: "g-test", model: "gemini-4-neon", text: "hola" },
      fetchMock as unknown as typeof fetch,
    );
    expect(n).toBe(7);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-4-neon:countTokens");
    expect(init.headers).toMatchObject({ "x-goog-api-key": "g-test" });
    expect(JSON.parse(init.body as string)).toEqual({ contents: [{ parts: [{ text: "hola" }] }] });
    expect(url).not.toContain("g-test"); // the key never goes in the URL
  });

  it("explains a rejected key", async () => {
    await expect(
      countGemini(
        { apiKey: "bad", model: "m", text: "t" },
        (async () => json({ error: { code: 400, message: "API key not valid" } }, 400)) as unknown as typeof fetch,
      ),
    ).rejects.toThrow("API key not valid");
  });
});

describe("measureRatio", () => {
  it("removes the per-request framing overhead before comparing with o200k", async () => {
    // vendor adds 7 tokens of framing per call and counts 1.2x the local tokens
    const local = async (t: string) => t.length; // 1 token per char, easy to reason about
    const vendor = async (t: string) => Math.round(t.length * 1.2) + 7;
    const ratio = await measureRatio({
      texts: ["x".repeat(500), "y".repeat(1500)],
      vendorCount: vendor,
      localCount: local,
    });
    // probe "a": vendor = round(1.2)+7 = 8, local = 1 -> overhead 7
    // vendor net = (600+7-7) + (1800+7-7) = 2400; local = 2000
    expect(ratio).toBeCloseTo(1.2, 5);
  });

  it("ignores blank texts and rejects when nothing is left", async () => {
    await expect(
      measureRatio({ texts: ["", "   "], vendorCount: async () => 1, localCount: async () => 1 }),
    ).rejects.toThrow(/Agrega un texto/);
  });
});
