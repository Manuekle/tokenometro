/// <reference lib="webworker" />
import { LruMap } from "@/lib/lru";
import { countLargeText, loadCounter, type Counter } from "./counters";
import type { WorkerRequest, WorkerResponse } from "./protocol";
import { isRepoEngine, type EngineId, type RepoEngineId, type TokenizerId } from "./registry";

/**
 * Tokenization worker. Engines load lazily and once; loading (network +
 * parsing) of one engine never blocks requests to another.
 *
 * Family engines stay for the session. Per-model repo engines are big and
 * numerous, so only the most recently used few stay in memory; an evicted one
 * reloads from Cache Storage the next time it is asked for.
 */
const MAX_REPO_ENGINES = 12;

const scope = self as unknown as DedicatedWorkerGlobalScope;
const families = new Map<TokenizerId, Promise<Counter>>();
const repos = new LruMap<RepoEngineId, Promise<Counter>>(MAX_REPO_ENGINES);

const post = (message: WorkerResponse) => scope.postMessage(message);

const lookup = (id: EngineId) =>
  isRepoEngine(id) ? repos.get(id) : families.get(id as TokenizerId);
const remember = (id: EngineId, engine: Promise<Counter>) =>
  isRepoEngine(id) ? repos.set(id, engine) : families.set(id as TokenizerId, engine);
const forget = (id: EngineId) =>
  isRepoEngine(id) ? repos.delete(id) : families.delete(id as TokenizerId);

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function getEngine(id: EngineId): Promise<Counter> {
  let engine = lookup(id);
  if (!engine) {
    post({ type: "status", id, status: { state: "loading", progress: 0 } });
    engine = loadCounter(id, (progress) =>
      post({ type: "status", id, status: { state: "loading", progress } }),
    ).then(
      (counter) => {
        post({ type: "status", id, status: { state: "ready", progress: 1 } });
        return counter;
      },
      (error: unknown) => {
        forget(id); // allow retry
        post({ type: "status", id, status: { state: "error", progress: 0, error: messageOf(error) } });
        throw error;
      },
    );
    remember(id, engine);
  }
  return engine;
}

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    const counter = await getEngine(msg.id);
    if (msg.type === "load") {
      post({ type: "loaded", reqId: msg.reqId, id: msg.id });
      return;
    }
    if (msg.type === "segment") {
      post({ type: "pieces", reqId: msg.reqId, id: msg.id, pieces: counter.pieces(msg.text) });
      return;
    }
    const counts: Record<string, number> = {};
    for (const item of msg.items) counts[item.key] = countLargeText(counter, item.text);
    post({ type: "counts", reqId: msg.reqId, id: msg.id, counts });
  } catch (error) {
    // A tokenizer that loaded but cannot encode (unsupported component) must not
    // stay "ready": mark it failed so the UI falls back to the family estimate.
    if (isRepoEngine(msg.id) && lookup(msg.id)) {
      forget(msg.id);
      post({
        type: "status",
        id: msg.id,
        status: { state: "error", progress: 0, error: `No se pudo contar con este tokenizador: ${messageOf(error)}` },
      });
    }
    post({ type: "failed", reqId: msg.reqId, id: msg.id, message: messageOf(error) });
  }
};
