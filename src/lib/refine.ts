import type { ModelInfo } from "@/lib/catalog/types";
import type { Row } from "@/lib/compute-rows";
import { formatMB } from "@/lib/format";
import type { EngineStatus } from "@/lib/tokenizers/protocol";
import { isRepoEngine, isValidRepo } from "@/lib/tokenizers/registry";

/** What the interface needs to offer "count with this model's own tokenizer". */
export interface RefineApi {
  /** Repos whose own tokenizer was requested (loading, ready or failed). */
  refined: ReadonlySet<string>;
  status: (repo: string) => EngineStatus;
  /** Request these repos' tokenizers. Returns how many were accepted. */
  refine: (repos: string[]) => number;
  remove: (repo: string) => void;
  /** How many more tokenizers fit before the cap. */
  room: number;
}

/**
 * How big a set of tokenizer downloads is, for the sentence that offers them:
 * "≈36 MB", "≈27 MB o más" when some sizes are unknown (0), null when none is known.
 */
export function downloadSize(bytes: number[]): string | null {
  const known = bytes.filter((n) => n > 0);
  if (known.length === 0) return null;
  const total = known.reduce((sum, n) => sum + n, 0);
  return `≈${formatMB(total)}${known.length < bytes.length ? " o más" : ""}`;
}

/** The Hugging Face repo of a model's own tokenizer, if it publishes one. */
export const ownRepo = (model: ModelInfo): string | null =>
  isValidRepo(model.hfId) ? model.hfId : null;

export interface RefineTarget {
  repo: string;
  /** Names of the models that would improve (several models can share a repo). */
  models: string[];
}

/**
 * Rows still counted with a family estimate that could use their own
 * tokenizer, grouped by repo so shared ones are downloaded once.
 */
export function refineTargets(rows: Row[], refined: ReadonlySet<string>): RefineTarget[] {
  const byRepo = new Map<string, string[]>();
  for (const row of rows) {
    const repo = ownRepo(row.model);
    if (!repo || refined.has(repo) || isRepoEngine(row.engine) || row.accuracy === "exact") continue;
    const names = byRepo.get(repo) ?? [];
    names.push(row.model.name);
    byRepo.set(repo, names);
  }
  return [...byRepo].map(([repo, models]) => ({ repo, models }));
}
