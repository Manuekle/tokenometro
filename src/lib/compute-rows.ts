import type { ModelInfo } from "@/lib/catalog/types";
import { estimateModel, type ModelEstimate, type Workload } from "@/lib/cost/calc";
import { paretoFrontier } from "@/lib/cost/analysis";
import {
  requestsPerMonth,
  type FilterState,
  type SampleKind,
  type WorkloadState,
} from "@/lib/app-state";
import {
  isValidRepo,
  repoEngineId,
  type EngineId,
} from "@/lib/tokenizers/registry";
import {
  mean,
  resolveFamilyTokens,
  type Calibration,
  type DisplayAccuracy,
  type EngineCounts,
} from "@/lib/tokenizers/resolve";

export interface Row extends ModelEstimate {
  accuracy: DisplayAccuracy;
  /** Which tokenizer produced the counts: a family, or this model's own repo ("hf:..."). */
  engine: EngineId;
}

export interface TokenInputs {
  /**
   * One entry per sample, aligned with the counts in `engines`.
   * `null` marks an empty sample: it is ignored instead of averaging in as 0 tokens.
   */
  kinds: (SampleKind | null)[];
  engines: EngineCounts;
  calibration: Calibration;
}

/** Average tokens per request for one tokenizer family. */
export interface FamilyProfile {
  inputTokens: number;
  outputTokens: number;
  accuracy: DisplayAccuracy;
  /** False while the reference tokenizer is still loading. */
  ready: boolean;
}

export function familyProfile(
  family: EngineId,
  tokens: TokenInputs,
  w: WorkloadState,
): FamilyProfile {
  const resolved = resolveFamilyTokens(family, tokens.engines, tokens.calibration);
  const per = resolved.perSample;

  const pick = (kind: SampleKind) =>
    per ? per.filter((_, i) => tokens.kinds[i] === kind) : [];
  const inputs = pick("input");
  const outputs = pick("output");

  const ready = per !== null || tokens.kinds.length === 0;
  return {
    inputTokens: mean(inputs) * w.sampleCopies,
    outputTokens: outputs.length > 0 ? mean(outputs) : w.outputTokens,
    accuracy: resolved.accuracy,
    ready,
  };
}

export function toWorkload(
  w: WorkloadState,
  profile: FamilyProfile,
): Workload {
  const sample = profile.inputTokens;
  const prompt = sample + w.fixedInputTokens;
  const cacheable = w.fixedInputTokens + sample * (w.sampleReusePct / 100);
  return {
    requestsPerMonth: requestsPerMonth(w),
    fixedInputTokens: w.fixedInputTokens,
    cacheablePct: prompt > 0 ? cacheable / prompt : 0,
    cacheHitRate: w.cacheHitRate / 100,
    batchShare: w.batchShare / 100,
    reasoningTokens: w.reasoningTokens,
    reasoningOnOptional: w.reasoningOnOptional,
  };
}

/** Cost of the workload on every model, using each model's own tokenizer. */
export function computeRows(
  models: ModelInfo[],
  tokens: TokenInputs,
  w: WorkloadState,
): Row[] {
  const profiles = new Map<EngineId, FamilyProfile>();
  const rows: Row[] = [];
  for (const model of models) {
    // The model's own tokenizer beats its family's whenever it has been loaded.
    const own = isValidRepo(model.hfId) ? repoEngineId(model.hfId) : null;
    const engine: EngineId = own !== null && tokens.engines[own] ? own : model.tokenizer;
    let profile = profiles.get(engine);
    if (!profile) {
      profile = familyProfile(engine, tokens, w);
      profiles.set(engine, profile);
    }
    if (!profile.ready) continue;
    const estimate = estimateModel(
      model,
      { inputTokens: profile.inputTokens, outputTokens: profile.outputTokens },
      toWorkload(w, profile),
    );
    rows.push({ ...estimate, accuracy: profile.accuracy, engine });
  }
  return rows;
}

export function applyFilters(
  rows: Row[],
  f: FilterState,
  pinned: ReadonlySet<string>,
): Row[] {
  const needle = f.search.trim().toLowerCase();
  const vendors = new Set(f.vendors);
  return rows.filter(({ model: m, monthly, fit }) => {
    if (!f.includeFree && m.free) return false;
    if (vendors.size > 0 && !vendors.has(m.vendorSlug)) return false;
    if (f.minIntelligence > 0 && (m.intelligence ?? -1) < f.minIntelligence) return false;
    if (f.maxMonthly !== null && monthly > f.maxMonthly) return false;
    if (f.minContext > 0 && m.contextLength < f.minContext) return false;
    if (f.vision && !m.inputModalities.includes("image")) return false;
    if (f.tools && !m.tools) return false;
    if (f.openWeightsOnly && !m.openWeights) return false;
    if (f.hideNoFit && fit !== "ok") return false;
    if (f.pinnedOnly && !pinned.has(m.id)) return false;
    if (needle && !`${m.name} ${m.vendor} ${m.id}`.toLowerCase().includes(needle)) return false;
    return true;
  });
}

export interface Analysis {
  cheapest: Row | null;
  bestQuality: Row | null;
  /** Best trade-off on the efficient frontier (null with fewer than 3 points). */
  balanced: Row | null;
  /** Efficient frontier, cheapest first. */
  frontier: Row[];
  /** Cost of each row relative to the cheapest one. */
  multiple: (row: Row) => number;
}

/**
 * Knee of the cost/quality curve: the frontier point farthest from the straight
 * line between the cheapest and the best model, in log-cost space. Past it,
 * each extra point of quality gets disproportionately more expensive.
 */
export function kneePoint(frontier: Row[]): Row | null {
  if (frontier.length < 3) return null;
  const x = (r: Row) => Math.log10(Math.max(r.monthly, 1e-9));
  const y = (r: Row) => r.model.intelligence ?? 0;
  const first = frontier[0];
  const last = frontier[frontier.length - 1];
  const dx = x(last) - x(first);
  const dy = y(last) - y(first);
  if (dx <= 0 || dy <= 0) return null;

  let best: Row | null = null;
  let bestDistance = 0;
  for (const r of frontier.slice(1, -1)) {
    // Normalised coordinates: x and y both in [0, 1] across the frontier.
    const nx = (x(r) - x(first)) / dx;
    const ny = (y(r) - y(first)) / dy;
    const distance = ny - nx; // above the chord = diminishing returns ahead
    if (distance > bestDistance) {
      bestDistance = distance;
      best = r;
    }
  }
  return best;
}

export function analyze(rows: Row[]): Analysis {
  const byCost = [...rows].sort((a, b) => a.monthly - b.monthly);
  const cheapest = byCost[0] ?? null;

  let bestQuality: Row | null = null;
  for (const r of rows) {
    const q = r.model.intelligence;
    if (q === null) continue;
    const bq = bestQuality?.model.intelligence ?? -Infinity;
    if (q > bq || (q === bq && bestQuality && r.monthly < bestQuality.monthly)) bestQuality = r;
  }

  const frontier = [...paretoFrontier(rows, (r) => r.monthly, (r) => r.model.intelligence)].sort(
    (a, b) => a.monthly - b.monthly,
  );

  const base = cheapest?.monthly ?? 0;
  return {
    cheapest,
    bestQuality,
    balanced: kneePoint(frontier),
    frontier,
    multiple: (row) => (base > 0 ? row.monthly / base : row.monthly > 0 ? Infinity : 1),
  };
}
