"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TokenizerClient } from "./client";
import type { EngineStatus } from "./protocol";
import {
  ENGINE_IDS,
  HF_IDS,
  TOKENIZERS,
  isValidRepo,
  repoEngineId,
  type EngineId,
  type TokenizerId,
} from "./registry";
import type { EngineCounts } from "./resolve";

export interface Sample {
  id: string;
  name: string;
  text: string;
  /** Bumped on every edit so stale counts can be told apart. */
  rev: number;
}

const IDLE: EngineStatus = { state: "idle", progress: 0 };
const CACHE_NAME = "tokenizers-v1";

/** Per-model tokenizers that can be active at once (they are big). */
export const MAX_REPOS = 12;

type StatusMap = Partial<Record<EngineId, EngineStatus>>;
type CountMap = Record<string, { rev: number; n: number }>;

const countKey = (engine: EngineId, sampleId: string) => `${engine}|${sampleId}`;

/** Is this repo's tokenizer.json already in Cache Storage (no download needed)? */
async function isRepoCached(repo: string): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(`https://huggingface.co/${repo}/resolve/main/tokenizer.json`);
    return hit !== undefined;
  } catch {
    return false;
  }
}

/**
 * Counts tokens of every sample with every loaded engine, off the main thread.
 * OpenAI encodings load on mount. Hugging Face tokenizers (one per family, or
 * one per model via `refine`) are opt-in because they are big downloads, except
 * when already cached in the browser.
 */
export function useTokenCounts(samples: Sample[]) {
  const clientRef = useRef<TokenizerClient | null>(null);
  const samplesRef = useRef(samples);
  const inflight = useRef(new Set<string>());
  const [status, setStatus] = useState<StatusMap>({});
  const [counts, setCounts] = useState<CountMap>({});
  const [busy, setBusy] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Repos whose own tokenizer was requested for some model. */
  const [repos, setRepos] = useState<string[]>([]);

  useEffect(() => {
    samplesRef.current = samples;
  }, [samples]);

  useEffect(() => {
    const client = new TokenizerClient();
    clientRef.current = client;
    const off = client.onStatus((id, next) =>
      setStatus((prev) => ({ ...prev, [id]: next })),
    );
    const quiet = () => undefined;
    client.load("o200k").catch(quiet);
    client.load("cl100k").catch(quiet);
    // Returning visitors: restore exact tokenizers that are already on disk.
    for (const id of HF_IDS) {
      const repo = TOKENIZERS[id].hfRepo;
      if (!repo) continue;
      void isRepoCached(repo).then((cached) => {
        if (cached) client.load(id).catch(quiet);
      });
    }
    const pendingKeys = inflight.current;
    return () => {
      off();
      client.terminate();
      clientRef.current = null;
      pendingKeys.clear();
    };
  }, []);

  /** Every engine whose counts we may need: families plus the per-model repos. */
  const engineIds = useMemo<EngineId[]>(
    () => [...ENGINE_IDS, ...repos.map(repoEngineId)],
    [repos],
  );

  // Count whatever is missing or stale for each ready engine.
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;
    for (const id of engineIds) {
      if (status[id]?.state !== "ready") continue;
      const todo = samples.filter((s) => {
        const known = counts[countKey(id, s.id)];
        return (
          (!known || known.rev !== s.rev) &&
          !inflight.current.has(`${countKey(id, s.id)}|${s.rev}`)
        );
      });
      if (todo.length === 0) continue;

      const flightKeys = todo.map((s) => `${countKey(id, s.id)}|${s.rev}`);
      for (const k of flightKeys) inflight.current.add(k);
      setBusy((n) => n + 1);

      client
        .count(
          id,
          todo.map((s) => ({ key: `${s.id}:${s.rev}`, text: s.text })),
        )
        .then((result) => {
          const alive = new Set(samplesRef.current.map((s) => s.id));
          setCounts((prev) => {
            const next = { ...prev };
            for (const [key, n] of Object.entries(result)) {
              const cut = key.lastIndexOf(":");
              const sampleId = key.slice(0, cut);
              const rev = Number(key.slice(cut + 1));
              if (!alive.has(sampleId)) continue;
              const current = next[countKey(id, sampleId)];
              if (!current || current.rev <= rev) next[countKey(id, sampleId)] = { rev, n };
            }
            return next;
          });
        })
        .catch((error: unknown) =>
          setLoadError(error instanceof Error ? error.message : String(error)),
        )
        .finally(() => {
          for (const k of flightKeys) inflight.current.delete(k);
          setBusy((n) => n - 1);
        });
    }
  }, [engineIds, samples, status, counts]);

  const engineCounts = useMemo<EngineCounts>(() => {
    const out: EngineCounts = {};
    if (samples.length === 0) return out;
    for (const id of engineIds) {
      if (status[id]?.state !== "ready") continue;
      const perSample: number[] = [];
      for (const s of samples) {
        const known = counts[countKey(id, s.id)];
        if (!known) break;
        perSample.push(known.n);
      }
      if (perSample.length === samples.length) out[id] = perSample;
    }
    return out;
  }, [engineIds, samples, status, counts]);

  const segment = useCallback((id: TokenizerId, text: string) => {
    const client = clientRef.current;
    return client
      ? client.segment(id, text)
      : Promise.reject(new Error("Tokenizador no disponible"));
  }, []);

  /** Count one text with one engine (waits for the engine to load). */
  const countText = useCallback(async (id: TokenizerId, text: string) => {
    const client = clientRef.current;
    if (!client) throw new Error("Tokenizador no disponible");
    const result = await client.count(id, [{ key: "probe", text }]);
    return result.probe;
  }, []);

  const readyIds = useMemo(
    () => ENGINE_IDS.filter((id) => status[id]?.state === "ready"),
    [status],
  );

  const loadEngine = useCallback((id: TokenizerId) => {
    clientRef.current?.load(id).catch(() => undefined);
  }, []);

  const loadAllHf = useCallback(() => {
    for (const id of HF_IDS) {
      if ((status[id]?.state ?? "idle") === "idle" || status[id]?.state === "error") {
        clientRef.current?.load(id).catch(() => undefined);
      }
    }
  }, [status]);

  const addRepo = useCallback((repo: string) => {
    setRepos((prev) => (prev.includes(repo) || prev.length >= MAX_REPOS ? prev : [...prev, repo]));
    clientRef.current?.load(repoEngineId(repo)).catch(() => undefined);
  }, []);

  /** Use this model's own tokenizer (downloads it unless cached). False when refused. */
  const refine = useCallback(
    (repo: string): boolean => {
      if (!isValidRepo(repo)) return false;
      if (!repos.includes(repo) && repos.length >= MAX_REPOS) return false;
      addRepo(repo);
      return true;
    },
    [repos, addRepo],
  );

  /** Stop using a model's own tokenizer; its models go back to the family count. */
  const unrefine = useCallback((repo: string) => {
    setRepos((prev) => prev.filter((r) => r !== repo));
  }, []);

  /** Bring back, without downloading anything, tokenizers saved in an earlier visit. */
  const restoreRepos = useCallback(
    (saved: string[]) => {
      for (const repo of saved.filter(isValidRepo).slice(0, MAX_REPOS)) {
        void isRepoCached(repo).then((cached) => {
          if (cached) addRepo(repo);
        });
      }
    },
    [addRepo],
  );

  const readyRepos = useMemo(
    () => repos.filter((r) => status[repoEngineId(r)]?.state === "ready"),
    [repos, status],
  );

  return {
    status: (id: EngineId): EngineStatus => status[id] ?? IDLE,
    engineCounts,
    readyIds,
    segment,
    countText,
    busy: busy > 0,
    loadError,
    loadEngine,
    loadAllHf,
    refinedRepos: repos,
    readyRepos,
    refine,
    unrefine,
    restoreRepos,
  };
}
