/**
 * Real tokenizer engines. No DOM access: runs in a Web Worker, in the main
 * thread or in Node (tests).
 */
import {
  TOKENIZERS,
  isRepoEngine,
  isValidRepo,
  repoOfEngine,
  type EngineId,
} from "./registry";
import { HttpError, describeHttp } from "./errors";
import { chunkText } from "./chunk";

export interface Counter {
  /** Number of tokens in `text`, without BOS/EOS or chat framing. */
  count(text: string): number;
  /** The text of each token, in order (for visualization; small inputs only). */
  pieces(text: string): string[];
}

/**
 * Splits `ids` into the text each token contributes. Decodes cumulatively so
 * multi-byte characters split across tokens (emoji, accents in rare merges)
 * end up merged into the piece where they complete.
 */
export function piecesFromIds(
  ids: number[],
  decode: (ids: number[]) => string,
): string[] {
  const pieces: string[] = [];
  let prev = "";
  let incomplete = false;
  for (let i = 0; i < ids.length; i++) {
    const full = decode(ids.slice(0, i + 1));
    if (full.endsWith("\uFFFD")) {
      incomplete = true; // partial UTF-8 sequence: wait for the next token
      continue;
    }
    pieces.push(full.startsWith(prev) ? full.slice(prev.length) : decode([ids[i]]));
    prev = full;
    incomplete = false;
  }
  if (incomplete && ids.length > 0) {
    const full = decode(ids);
    pieces.push(full.startsWith(prev) ? full.slice(prev.length) : "\uFFFD");
  }
  return pieces;
}

export type ProgressFn = (fraction: number) => void;

/** Treat "<|endoftext|>"-like strings in user documents as plain text. */
const AS_PLAIN_TEXT = { disallowedSpecial: new Set<string>() };

const CACHE_NAME = "tokenizers-v1";

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === "undefined" ? null : await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

/** Downloads JSON once; later loads come from Cache Storage. */
async function fetchJsonCached(
  url: string,
  onBytes?: (loaded: number, total: number) => void,
): Promise<unknown> {
  const cache = await openCache();
  const hit = await cache?.match(url);
  if (hit) return hit.json();

  const res = await fetch(url);
  if (!res.ok || !res.body) throw new HttpError(res.status, describeHttp(res.status));
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value as Uint8Array<ArrayBuffer>);
    loaded += value.byteLength;
    onBytes?.(loaded, total);
  }
  const blob = new Blob(parts, { type: "application/json" });
  await cache
    ?.put(url, new Response(blob, { headers: { "content-type": "application/json" } }))
    .catch(() => undefined);
  return JSON.parse(await blob.text());
}

async function loadTiktoken(
  encoding: "o200k_base" | "cl100k_base",
): Promise<Counter> {
  const mod =
    encoding === "o200k_base"
      ? await import("gpt-tokenizer/encoding/o200k_base")
      : await import("gpt-tokenizer/encoding/cl100k_base");
  return {
    count: (text) => mod.countTokens(text, AS_PLAIN_TEXT),
    pieces: (text) =>
      piecesFromIds(mod.encode(text, AS_PLAIN_TEXT), (ids) => mod.decode(ids)),
  };
}

async function loadHf(repo: string, onProgress?: ProgressFn): Promise<Counter> {
  const { Tokenizer } = await import("@huggingface/tokenizers");
  const base = `https://huggingface.co/${repo}/resolve/main`;
  const [tokenizerJson, tokenizerConfig] = await Promise.all([
    fetchJsonCached(`${base}/tokenizer.json`, (loaded, total) =>
      // content-length can be the compressed size; never report 100% early.
      onProgress?.(total > 0 ? Math.min(loaded / total, 0.98) : 0.5),
    ),
    // Many repos have no tokenizer_config.json: it only carries metadata we do not need.
    fetchJsonCached(`${base}/tokenizer_config.json`).catch((error: unknown) => {
      if (error instanceof HttpError && error.status === 404) return {};
      throw error;
    }),
  ]);

  let tokenizer: InstanceType<typeof Tokenizer>;
  try {
    tokenizer = new Tokenizer(tokenizerJson as object, tokenizerConfig as object);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Este tokenizador no es compatible con el motor del navegador: ${reason}`);
  }
  const encode = (text: string) =>
    tokenizer.encode(text, { add_special_tokens: false }).ids;
  return {
    count: (text) => encode(text).length,
    pieces: (text) => piecesFromIds(encode(text), (ids) => tokenizer.decode(ids)),
  };
}

/**
 * Loads the real engine of a family, or one model's own tokenizer from its
 * Hugging Face repo ("hf:owner/name"). Throws for families without an engine.
 */
export async function loadCounter(
  id: EngineId,
  onProgress?: ProgressFn,
): Promise<Counter> {
  if (isRepoEngine(id)) {
    const repo = repoOfEngine(id);
    if (!isValidRepo(repo)) throw new Error("Repositorio de Hugging Face inválido.");
    return loadHf(repo, onProgress);
  }
  const spec = TOKENIZERS[id];
  if (spec.engine === "tiktoken" && spec.encoding) return loadTiktoken(spec.encoding);
  if (spec.engine === "hf" && spec.hfRepo) return loadHf(spec.hfRepo, onProgress);
  throw new Error(`"${id}" no tiene motor de tokenización propio`);
}

/** Counts a possibly huge text by chunks (bounded memory). */
export function countLargeText(counter: Counter, text: string): number {
  let total = 0;
  for (const chunk of chunkText(text)) total += counter.count(chunk);
  return total;
}
