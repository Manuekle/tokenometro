import { describeHttp } from "./errors";
import { isValidRepo } from "./registry";

/**
 * Is a model's own tokenizer available, and how big is it? One cheap HEAD
 * request, no download. Lets the UI show "≈27 MB" or "no disponible" up front.
 */
export type RepoProbe =
  /** `bytes` is 0 when the server did not say how big the file is. */
  | { state: "ok"; bytes: number }
  | { state: "gated"; message: string }
  | { state: "missing"; message: string }
  | { state: "error"; message: string };

type FetchLike = typeof fetch;
type StorageLike = Pick<Storage, "getItem" | "setItem">;

export interface ProbeOptions {
  /** Where "gated / no tokenizer.json" answers are remembered. Defaults to localStorage. */
  storage?: StorageLike | null;
  now?: () => number;
}

const results = new Map<string, Promise<RepoProbe>>();

/**
 * Gated and missing repos stay that way for a long time. Remembering them
 * saves a request (and the browser's red 401 line in the console) on every
 * visit. Good answers are not stored: their size is cheap to re-check.
 */
const MISSES_KEY = "tokenometro:probe-misses:v1";
const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Miss = { state: "gated" | "missing"; message: string; at: number };

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // storage blocked
  }
}

function readMisses(storage: StorageLike | null): Record<string, Miss> {
  try {
    const raw = storage?.getItem(MISSES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, Miss>) : {};
  } catch {
    return {};
  }
}

function rememberMiss(storage: StorageLike | null, repo: string, miss: Miss, now: number) {
  if (!storage) return;
  try {
    const misses = readMisses(storage);
    for (const [key, value] of Object.entries(misses)) {
      if (now - value.at > MISS_TTL_MS) delete misses[key]; // drop stale entries
    }
    misses[repo] = miss;
    storage.setItem(MISSES_KEY, JSON.stringify(misses));
  } catch {
    /* storage full or blocked: just probe again next time */
  }
}

/** At most this many probes in flight: a table page can ask for a dozen repos. */
const MAX_IN_FLIGHT = 5;
let inFlight = 0;
const waiting: (() => void)[] = [];

async function slot<T>(task: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_IN_FLIGHT) await new Promise<void>((resolve) => waiting.push(resolve));
  inFlight++;
  try {
    return await task();
  } finally {
    inFlight--;
    waiting.shift()?.();
  }
}

/**
 * HEAD sometimes answers without Content-Length (the server compresses the file,
 * so the length is not known up front). A one-byte ranged GET answers with
 * `Content-Range: bytes 0-0/<total>` instead. Returns 0 when the size stays unknown.
 */
async function rangedSize(url: string, fetchImpl: FetchLike): Promise<number> {
  const controller = new AbortController();
  try {
    const res = await slot(() =>
      fetchImpl(url, { headers: { Range: "bytes=0-0" }, signal: controller.signal }),
    );
    const total = /\/(\d+)\s*$/.exec(res.headers.get("content-range") ?? "")?.[1];
    if (total) return Number(total);
    // A server that ignores Range sends the whole file with a 200: take its length, never its body.
    return res.status === 200 ? Number(res.headers.get("content-length")) || 0 : 0;
  } catch {
    return 0;
  } finally {
    controller.abort();
  }
}

async function run(repo: string, fetchImpl: FetchLike, opts: ProbeOptions): Promise<RepoProbe> {
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  const now = (opts.now ?? Date.now)();

  const known = readMisses(storage)[repo];
  if (known && now - known.at <= MISS_TTL_MS && (known.state === "gated" || known.state === "missing")) {
    return { state: known.state, message: known.message };
  }

  const url = `https://huggingface.co/${repo}/resolve/main/tokenizer.json`;
  try {
    const res = await slot(() => fetchImpl(url, { method: "HEAD" }));
    if (res.ok) {
      const bytes = Number(res.headers.get("content-length")) || (await rangedSize(url, fetchImpl));
      return { state: "ok", bytes };
    }
    if (res.status === 401 || res.status === 403) {
      const message = describeHttp(res.status);
      rememberMiss(storage, repo, { state: "gated", message, at: now }, now);
      return { state: "gated", message };
    }
    if (res.status === 404) {
      const message = describeHttp(404);
      rememberMiss(storage, repo, { state: "missing", message, at: now }, now);
      return { state: "missing", message };
    }
    return { state: "error", message: describeHttp(res.status) };
  } catch {
    return { state: "error", message: "No se pudo consultar Hugging Face. Revisa tu conexión." };
  }
}

/** Memoized per repo; failures are forgotten so a retry really retries. */
export function probeRepo(
  repo: string,
  fetchImpl: FetchLike = fetch,
  opts: ProbeOptions = {},
): Promise<RepoProbe> {
  if (!isValidRepo(repo)) {
    return Promise.resolve({ state: "error", message: "Repositorio de Hugging Face inválido." });
  }
  let probe = results.get(repo);
  if (!probe) {
    probe = run(repo, fetchImpl, opts).then((result) => {
      if (result.state === "error") results.delete(repo);
      return result;
    });
    results.set(repo, probe);
  }
  return probe;
}

/** Test hook. */
export function resetProbes(): void {
  results.clear();
}
