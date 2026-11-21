import { afterEach, describe, expect, it, vi } from "vitest";
import { LruMap } from "@/lib/lru";
import { describeHttp } from "./errors";
import { probeRepo, resetProbes, type ProbeOptions } from "./probe";
import { isRepoEngine, isValidRepo, repoEngineId, repoOfEngine } from "./registry";

describe("repo ids", () => {
  it("accepts owner/name and nothing else", () => {
    for (const ok of [
      "zai-org/GLM-5.3",
      "nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-BF16",
      "a/b",
      "LiquidAI/LFM3-1.7B",
      "Qwen/Qwen2.5-7B-Instruct",
    ]) {
      expect(isValidRepo(ok), ok).toBe(true);
    }
    for (const bad of [
      "",
      "x",
      "a/b/c",
      "../a/b",
      "a/..",
      "a/b/../c",
      "a b/c",
      "https://x/y",
      "-a/b",
      "a/b?x=1",
      "a/b#h",
      "a\\b/c",
      " a/b",
      null,
      undefined,
    ]) {
      expect(isValidRepo(bad as string), String(bad)).toBe(false);
    }
  });

  it("round-trips engine ids and tells them apart from families", () => {
    const id = repoEngineId("owner/name");
    expect(id).toBe("hf:owner/name");
    expect(isRepoEngine(id)).toBe(true);
    expect(repoOfEngine(id)).toBe("owner/name");
    expect(isRepoEngine("o200k")).toBe(false);
    expect(isRepoEngine("claude")).toBe(false);
  });
});

describe("LruMap", () => {
  it("drops the least recently used key past capacity and reports it", () => {
    const evicted: string[] = [];
    const lru = new LruMap<string, number>(2, (k) => evicted.push(k));
    lru.set("a", 1);
    lru.set("b", 2);
    lru.get("a"); // a is now the newest
    lru.set("c", 3);
    expect(evicted).toEqual(["b"]);
    expect(lru.keys()).toEqual(["a", "c"]);
    expect(lru.has("b")).toBe(false);
  });

  it("refreshes recency when a key is set again and supports delete", () => {
    const lru = new LruMap<string, number>(2);
    lru.set("a", 1);
    lru.set("b", 2);
    lru.set("a", 10);
    lru.set("c", 3);
    expect(lru.keys()).toEqual(["a", "c"]);
    expect(lru.get("a")).toBe(10);
    expect(lru.delete("a")).toBe(true);
    expect(lru.size).toBe(1);
    expect(lru.get("missing")).toBeUndefined();
  });

  it("rejects a capacity below 1", () => {
    expect(() => new LruMap(0)).toThrow(RangeError);
  });
});

describe("describeHttp", () => {
  it("explains the statuses a person will actually hit", () => {
    expect(describeHttp(401)).toMatch(/exige acceso/);
    expect(describeHttp(403)).toMatch(/exige acceso/);
    expect(describeHttp(404)).toMatch(/no publica un tokenizer\.json/);
    expect(describeHttp(429)).toMatch(/limitó las descargas/);
    expect(describeHttp(500)).toBe("Hugging Face respondió HTTP 500.");
  });
});

describe("probeRepo", () => {
  afterEach(() => resetProbes());

  // Tests never touch a real localStorage unless they pass their own storage.
  const check = (repo: string, f: typeof fetch, opts: ProbeOptions = {}) =>
    probeRepo(repo, f, { storage: null, ...opts });

  const head = (status: number, headers: Record<string, string> = {}) =>
    vi.fn(async () => new Response(null, { status, headers }));
  const asFetch = (f: ReturnType<typeof head>) => f as unknown as typeof fetch;

  it("reports size with a HEAD request and no download", async () => {
    const f = head(200, { "content-length": "27000000" });
    const probe = await check("zai-org/GLM-5.3", asFetch(f));
    expect(probe).toEqual({ state: "ok", bytes: 27_000_000 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://huggingface.co/zai-org/GLM-5.3/resolve/main/tokenizer.json");
    expect(init.method).toBe("HEAD");
    expect(f).toHaveBeenCalledTimes(1); // the size was in the HEAD: nothing else to ask
  });

  describe("when HEAD does not say how big the file is", () => {
    const sequence = (...responses: (Response | Error)[]) => {
      const f = vi.fn();
      for (const r of responses) {
        if (r instanceof Error) f.mockRejectedValueOnce(r);
        else f.mockResolvedValueOnce(r);
      }
      return f;
    };
    const noLength = () => new Response(null, { status: 200 });

    it("reads the total from a one-byte ranged GET", async () => {
      const f = sequence(
        noLength(),
        new Response(null, { status: 206, headers: { "content-range": "bytes 0-0/9359191", "content-length": "1" } }),
      );
      const probe = await check("tencent/Hy4-flash", f as unknown as typeof fetch);
      expect(probe).toEqual({ state: "ok", bytes: 9_359_191 });
      const [url, init] = f.mock.calls[1] as [string, RequestInit];
      expect(url).toBe("https://huggingface.co/tencent/Hy4-flash/resolve/main/tokenizer.json");
      expect(init.method).toBeUndefined(); // a GET
      expect(new Headers(init.headers).get("range")).toBe("bytes=0-0");
    });

    it("takes the length of a server that ignores Range, without reading its body", async () => {
      const ignoring = sequence(noLength(), new Response(null, { status: 200, headers: { "content-length": "5000" } }));
      expect(await check("a/ignores", ignoring as unknown as typeof fetch)).toEqual({ state: "ok", bytes: 5000 });
    });

    it("still reports the tokenizer as available, with size 0, when the size cannot be found", async () => {
      const failing = sequence(noLength(), new TypeError("Failed to fetch"));
      expect(await check("a/failing", failing as unknown as typeof fetch)).toEqual({ state: "ok", bytes: 0 });

      resetProbes();
      const odd = sequence(noLength(), new Response(null, { status: 206, headers: { "content-length": "1" } }));
      expect(await check("a/odd", odd as unknown as typeof fetch)).toEqual({ state: "ok", bytes: 0 });
    });

    it("aborts the ranged request so a stray full body is never downloaded", async () => {
      let signal: AbortSignal | undefined;
      const f = vi
        .fn()
        .mockResolvedValueOnce(noLength())
        .mockImplementationOnce(async (_url: string, init: RequestInit) => {
          signal = init.signal ?? undefined;
          return new Response(null, { status: 206, headers: { "content-range": "bytes 0-0/12" } });
        });
      await check("a/abort", f as unknown as typeof fetch);
      expect(signal?.aborted).toBe(true);
    });
  });

  it("maps gated, missing and other failures", async () => {
    expect((await check("a/gated", asFetch(head(401)))).state).toBe("gated");
    expect((await check("a/private", asFetch(head(403)))).state).toBe("gated");
    expect((await check("a/nofile", asFetch(head(404)))).state).toBe("missing");
    const down = await check("a/down", asFetch(head(503)));
    expect(down).toMatchObject({ state: "error", message: "Hugging Face respondió HTTP 503." });
  });

  it("memoizes good answers but retries after an error", async () => {
    const ok = head(200, { "content-length": "10" });
    await check("a/ok", asFetch(ok));
    await check("a/ok", asFetch(ok));
    expect(ok).toHaveBeenCalledTimes(1);

    const flaky = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-length": "5" } }));
    expect((await check("a/flaky", flaky as unknown as typeof fetch)).state).toBe("error");
    expect((await check("a/flaky", flaky as unknown as typeof fetch)).state).toBe("ok");
    expect(flaky).toHaveBeenCalledTimes(2);
  });

  it("never builds a URL from an invalid repo id", async () => {
    const f = head(200);
    const probe = await check("../../etc/passwd", asFetch(f));
    expect(probe.state).toBe("error");
    expect(f).not.toHaveBeenCalled();
  });

  describe("remembering unavailable repos", () => {
    function fakeStorage() {
      const data = new Map<string, string>();
      return {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
      };
    }
    const DAY = 24 * 60 * 60 * 1000;

    it("does not ask again for a gated or missing repo on the next visit", async () => {
      const storage = fakeStorage();
      const gated = head(401);
      expect((await check("a/gated", asFetch(gated), { storage, now: () => 1_000 })).state).toBe("gated");
      expect(gated).toHaveBeenCalledTimes(1);

      resetProbes(); // a new page load: memory is empty, storage is not
      const again = head(200);
      const probe = await check("a/gated", asFetch(again), { storage, now: () => 2_000 });
      expect(probe).toMatchObject({ state: "gated", message: expect.stringContaining("exige acceso") });
      expect(again).not.toHaveBeenCalled();

      const missing = head(404);
      await check("a/nofile", asFetch(missing), { storage, now: () => 1_000 });
      resetProbes();
      expect((await check("a/nofile", asFetch(head(200)), { storage, now: () => 3_000 })).state).toBe("missing");
    });

    it("asks again after a week, and never stores good answers or errors", async () => {
      const storage = fakeStorage();
      await check("a/gated", asFetch(head(401)), { storage, now: () => 0 });
      resetProbes();
      const later = head(200, { "content-length": "9" });
      const probe = await check("a/gated", asFetch(later), { storage, now: () => 8 * DAY });
      expect(probe).toEqual({ state: "ok", bytes: 9 });
      expect(later).toHaveBeenCalledTimes(1);

      resetProbes();
      await check("a/fine", asFetch(head(200, { "content-length": "5" })), { storage, now: () => 9 * DAY });
      await check("a/broken", asFetch(head(500)), { storage, now: () => 9 * DAY });
      resetProbes();
      const stored = JSON.parse(storage.getItem("tokenometro:probe-misses:v1") ?? "{}");
      expect(Object.keys(stored)).not.toContain("a/fine");
      expect(Object.keys(stored)).not.toContain("a/broken");
    });

    it("works without storage or with a storage that throws", async () => {
      expect((await check("a/x", asFetch(head(401)), { storage: null })).state).toBe("gated");
      resetProbes();
      const broken = {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      };
      expect((await check("a/y", asFetch(head(404)), { storage: broken })).state).toBe("missing");
    });
  });

  it("keeps at most 5 requests in flight", async () => {
    let active = 0;
    let peak = 0;
    const slow = vi.fn(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return new Response(null, { status: 200, headers: { "content-length": "1" } });
    });
    const probes = await Promise.all(
      Array.from({ length: 14 }, (_, i) => check(`owner/repo-${i}`, slow as unknown as typeof fetch)),
    );
    expect(probes.every((p) => p.state === "ok")).toBe(true);
    expect(slow).toHaveBeenCalledTimes(14);
    expect(peak).toBeLessThanOrEqual(5);
  });
});
