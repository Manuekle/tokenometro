import {
  TOKENIZERS,
  isRepoEngine,
  type Accuracy,
  type EngineId,
  type TokenizerId,
} from "./registry";

/** Per-sample token counts from the engines that are loaded (families and per-model repos). */
export type EngineCounts = Partial<Record<EngineId, number[]>>;

/** Ratios vs. o200k measured with a vendor's own count API. */
export type Calibration = Partial<Record<TokenizerId, number>>;

export type DisplayAccuracy = Accuracy | "calibrated";

export interface FamilyTokens {
  /** Tokens per sample (aligned with the samples), or null until o200k is ready. */
  perSample: number[] | null;
  accuracy: DisplayAccuracy;
}

/**
 * Best available token count for a family, from most to least trustworthy:
 *  1. calibrated against the vendor's count API (ratio x o200k),
 *  2. the family's own engine,
 *  3. an aliased family's engine (Gemini <- Gemma),
 *  4. heuristic ratio x o200k.
 */
export function resolveFamilyTokens(
  family: EngineId,
  engines: EngineCounts,
  calibration: Calibration = {},
): FamilyTokens {
  // A model's own tokenizer: exact, or not loaded yet.
  if (isRepoEngine(family)) {
    const own = engines[family];
    return own ? { perSample: own, accuracy: "exact" } : { perSample: null, accuracy: "estimate" };
  }
  const spec = TOKENIZERS[family];
  const reference = engines.o200k;

  const ratio = calibration[family];
  if (ratio !== undefined && reference) {
    return {
      perSample: reference.map((n) => Math.round(n * ratio)),
      accuracy: "calibrated",
    };
  }

  const own = engines[family];
  if (own) return { perSample: own, accuracy: spec.accuracy };

  const alias = spec.aliasOf ? engines[spec.aliasOf] : undefined;
  if (alias) return { perSample: alias, accuracy: spec.accuracy };

  if (reference) {
    return {
      perSample: reference.map((n) => Math.round(n * spec.ratio)),
      accuracy: "estimate",
    };
  }
  return { perSample: null, accuracy: "estimate" };
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
