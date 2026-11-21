import type { EngineStatus, WorkerRequest, WorkerResponse } from "./protocol";
import type { EngineId } from "./registry";

interface Pending {
  resolve: (value: never) => void;
  reject: (error: Error) => void;
}

/** Main-thread handle to the tokenization worker. Browser only. */
export class TokenizerClient {
  private worker: Worker;
  private seq = 0;
  private pending = new Map<number, Pending>();
  private listeners = new Set<(id: EngineId, status: EngineStatus) => void>();

  constructor() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) =>
      this.handle(event.data);
    this.worker.onerror = (event) =>
      this.rejectAll(new Error(event.message || "Falló el worker de tokenización"));
  }

  private handle(msg: WorkerResponse) {
    if (msg.type === "status") {
      for (const listener of this.listeners) listener(msg.id, msg.status);
      return;
    }
    const pending = this.pending.get(msg.reqId);
    if (!pending) return;
    this.pending.delete(msg.reqId);
    if (msg.type === "failed") pending.reject(new Error(msg.message));
    else if (msg.type === "counts") pending.resolve(msg.counts as never);
    else if (msg.type === "pieces") pending.resolve(msg.pieces as never);
    else pending.resolve(undefined as never);
  }

  private rejectAll(error: Error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  private request<T>(build: (reqId: number) => WorkerRequest): Promise<T> {
    const reqId = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(reqId, { resolve: resolve as (v: never) => void, reject });
      this.worker.postMessage(build(reqId));
    });
  }

  /** Resolves when the engine is ready (downloads it the first time). */
  load(id: EngineId): Promise<void> {
    return this.request((reqId) => ({ type: "load", reqId, id }));
  }

  /** Counts tokens of each item with the engine of `id`. */
  count(
    id: EngineId,
    items: { key: string; text: string }[],
  ): Promise<Record<string, number>> {
    return this.request((reqId) => ({ type: "count", reqId, id, items }));
  }

  /** Text of each token of `text` under the engine of `id`. */
  segment(id: EngineId, text: string): Promise<string[]> {
    return this.request((reqId) => ({ type: "segment", reqId, id, text }));
  }

  onStatus(listener: (id: EngineId, status: EngineStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  terminate() {
    this.worker.terminate();
    this.rejectAll(new Error("Worker terminado"));
    this.listeners.clear();
  }
}
