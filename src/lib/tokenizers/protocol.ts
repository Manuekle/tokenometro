import type { EngineId } from "./registry";

export type EngineState = "idle" | "loading" | "ready" | "error";

export interface EngineStatus {
  state: EngineState;
  /** 0..1 while loading. */
  progress: number;
  error?: string;
}

export type WorkerRequest =
  | { type: "load"; reqId: number; id: EngineId }
  | {
      type: "count";
      reqId: number;
      id: EngineId;
      items: { key: string; text: string }[];
    }
  | { type: "segment"; reqId: number; id: EngineId; text: string };

export type WorkerResponse =
  | { type: "status"; id: EngineId; status: EngineStatus }
  | { type: "loaded"; reqId: number; id: EngineId }
  | { type: "counts"; reqId: number; id: EngineId; counts: Record<string, number> }
  | { type: "pieces"; reqId: number; id: EngineId; pieces: string[] }
  | { type: "failed"; reqId: number; id: EngineId; message: string };
