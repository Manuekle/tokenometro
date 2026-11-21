import type { Row } from "@/lib/compute-rows";
import {
  formatContext,
  formatIndex,
  formatMultiple,
  formatPerM,
  formatTokens,
  formatUSD,
} from "@/lib/format";
import { isRepoEngine } from "@/lib/tokenizers/registry";

/** Models shown side by side at most: beyond this the columns stop being readable. */
export const MAX_COMPARE = 6;

export interface CompareContext {
  /** Smallest monthly cost in the set, for "× the cheapest". */
  cheapest: number;
}

export type Better = "low" | "high";

export type MetricGroup =
  | "Costo"
  | "Tokens por solicitud"
  | "Tarifas · USD por millón"
  | "Calidad y límites";

export interface Metric {
  key: string;
  group: MetricGroup;
  label: string;
  /** Plain text of the cell; also what ends up in the copied table. */
  text: (row: Row, ctx: CompareContext) => string;
  /** Number the winner is picked from. null means "not comparable". */
  rank?: (row: Row) => number | null;
  better?: Better;
  /** Row only appears when it says something for at least one model. */
  onlyIf?: (rows: Row[]) => boolean;
}

const yesNo = (v: boolean) => (v ? "Sí" : "No");

const REASONING_TEXT = {
  none: "No razona",
  optional: "Opcional",
  default: "Por defecto",
  mandatory: "Siempre",
} as const;

function countingText(row: Row): string {
  if (isRepoEngine(row.engine)) return "Exacto · tokenizador propio";
  switch (row.accuracy) {
    case "exact":
      return "Exacto";
    case "approx":
      return "Aproximado";
    case "calibrated":
      return "Calibrado con la API";
    case "estimate":
      return "Estimado";
  }
}

export const METRICS: Metric[] = [
  { key: "monthly", group: "Costo", label: "Por mes", text: (r) => formatUSD(r.monthly), rank: (r) => r.monthly, better: "low" },
  { key: "yearly", group: "Costo", label: "Por año", text: (r) => formatUSD(r.yearly), rank: (r) => r.yearly, better: "low" },
  { key: "perRequest", group: "Costo", label: "Por solicitud", text: (r) => formatUSD(r.perRequest), rank: (r) => r.perRequest, better: "low" },
  {
    key: "multiple",
    group: "Costo",
    label: "Frente al más barato",
    text: (r, ctx) => (ctx.cheapest > 0 ? formatMultiple(r.monthly / ctx.cheapest) : "—"),
  },

  { key: "prompt", group: "Tokens por solicitud", label: "Entrada", text: (r) => formatTokens(r.promptTokens), rank: (r) => r.promptTokens, better: "low" },
  { key: "counting", group: "Tokens por solicitud", label: "Precisión del conteo", text: countingText },
  { key: "output", group: "Tokens por solicitud", label: "Salida", text: (r) => formatTokens(r.outputTokens), rank: (r) => r.outputTokens, better: "low" },
  {
    key: "reasoningTokens",
    group: "Tokens por solicitud",
    label: "Razonamiento",
    text: (r) => (r.reasoningTokens > 0 ? formatTokens(r.reasoningTokens) : "—"),
    rank: (r) => (r.reasoningTokens > 0 ? r.reasoningTokens : null),
    better: "low",
    onlyIf: (rows) => rows.some((r) => r.reasoningTokens > 0),
  },

  { key: "pIn", group: "Tarifas · USD por millón", label: "Entrada", text: (r) => formatPerM(r.model.price.input), rank: (r) => r.model.price.input, better: "low" },
  { key: "pOut", group: "Tarifas · USD por millón", label: "Salida", text: (r) => formatPerM(r.model.price.output), rank: (r) => r.model.price.output, better: "low" },
  {
    key: "pCache",
    group: "Tarifas · USD por millón",
    label: "Lectura de caché",
    text: (r) => (r.model.price.cacheRead !== undefined ? formatPerM(r.model.price.cacheRead) : "No ofrece"),
    rank: (r) => r.model.price.cacheRead ?? null,
    better: "low",
  },
  {
    key: "pBatch",
    group: "Tarifas · USD por millón",
    label: "Batch · entrada / salida",
    text: (r) =>
      r.model.batch
        ? `${formatPerM(r.model.batch.price.input)} / ${formatPerM(r.model.batch.price.output)}`
        : "No ofrece",
    rank: (r) => r.model.batch?.price.input ?? null,
    better: "low",
  },

  {
    key: "index",
    group: "Calidad y límites",
    label: "Índice de inteligencia",
    text: (r) => formatIndex(r.model.intelligence),
    rank: (r) => r.model.intelligence,
    better: "high",
  },
  { key: "context", group: "Calidad y límites", label: "Ventana de contexto", text: (r) => formatContext(r.model.contextLength), rank: (r) => r.model.contextLength, better: "high" },
  {
    key: "maxOut",
    group: "Calidad y límites",
    label: "Salida máxima",
    text: (r) => (r.model.maxOutputTokens !== null ? formatContext(r.model.maxOutputTokens) : "—"),
    rank: (r) => r.model.maxOutputTokens,
    better: "high",
  },
  { key: "reasoning", group: "Calidad y límites", label: "Razonamiento", text: (r) => REASONING_TEXT[r.model.reasoning] },
  { key: "vision", group: "Calidad y límites", label: "Imágenes de entrada", text: (r) => yesNo(r.model.inputModalities.includes("image")), rank: (r) => (r.model.inputModalities.includes("image") ? 1 : 0), better: "high" },
  { key: "tools", group: "Calidad y límites", label: "Herramientas", text: (r) => yesNo(r.model.tools), rank: (r) => (r.model.tools ? 1 : 0), better: "high" },
  { key: "structured", group: "Calidad y límites", label: "Salida estructurada", text: (r) => yesNo(r.model.structuredOutput), rank: (r) => (r.model.structuredOutput ? 1 : 0), better: "high" },
  { key: "open", group: "Calidad y límites", label: "Pesos abiertos", text: (r) => yesNo(r.model.openWeights) },
  {
    key: "expires",
    group: "Calidad y límites",
    label: "Se retira el",
    text: (r) => r.model.expiresAt ?? "—",
    onlyIf: (rows) => rows.some((r) => r.model.expiresAt !== null),
  },
];

export function visibleMetrics(rows: Row[]): Metric[] {
  return METRICS.filter((m) => !m.onlyIf || m.onlyIf(rows));
}

export interface MetricGroupBlock {
  title: MetricGroup;
  metrics: Metric[];
}

/** Metrics bucketed by group, keeping the declared order. */
export function groupMetrics(metrics: Metric[]): MetricGroupBlock[] {
  const blocks: MetricGroupBlock[] = [];
  for (const metric of metrics) {
    const last = blocks[blocks.length - 1];
    if (last && last.title === metric.group) last.metrics.push(metric);
    else blocks.push({ title: metric.group, metrics: [metric] });
  }
  return blocks;
}

/**
 * Ids of the model(s) with the best value of `metric`. Nobody "wins" when fewer
 * than two models are comparable or when every value is equal.
 */
export function winners(rows: Row[], metric: Metric): Set<string> {
  const rank = metric.rank;
  if (!rank || !metric.better) return new Set();
  const ranked = rows
    .map((row) => ({ id: row.model.id, value: rank(row) }))
    .filter((x): x is { id: string; value: number } => x.value !== null);
  if (ranked.length < 2) return new Set();
  const values = ranked.map((x) => x.value);
  if (new Set(values).size < 2) return new Set();
  const best = metric.better === "low" ? Math.min(...values) : Math.max(...values);
  return new Set(ranked.filter((x) => x.value === best).map((x) => x.id));
}

export function compareContext(rows: Row[]): CompareContext {
  return { cheapest: rows.length > 0 ? Math.min(...rows.map((r) => r.monthly)) : 0 };
}

/** A few plain sentences that say what the table below means. */
export function summarize(rows: Row[]): string[] {
  if (rows.length < 2) return [];
  const lines: string[] = [];
  const byCost = [...rows].sort((a, b) => a.monthly - b.monthly);
  const cheapest = byCost[0];
  const priciest = byCost[byCost.length - 1];

  if (cheapest.monthly > 0 && priciest.monthly / cheapest.monthly >= 1.05) {
    lines.push(
      `${cheapest.model.name} es el más barato (${formatUSD(cheapest.monthly)} al mes). ${priciest.model.name} cuesta ${formatMultiple(priciest.monthly / cheapest.monthly)} más.`,
    );
  } else {
    lines.push(`Cuestan casi lo mismo: ${formatUSD(cheapest.monthly)} al mes.`);
  }

  const scored = rows.filter((r) => r.model.intelligence !== null);
  if (scored.length >= 2) {
    const best = scored.reduce((a, b) =>
      (b.model.intelligence as number) > (a.model.intelligence as number) ? b : a,
    );
    lines.push(`${best.model.name} tiene el mayor índice de inteligencia (${formatIndex(best.model.intelligence)}).`);
    const base = cheapest.model.intelligence;
    const gain = base === null ? 0 : (best.model.intelligence as number) - base;
    if (best !== cheapest && gain > 0) {
      lines.push(
        `Pasar de ${cheapest.model.name} a ${best.model.name} suma ${Number(gain.toFixed(1))} puntos de índice por ${formatUSD(best.monthly - cheapest.monthly)} más al mes.`,
      );
    }
  }

  const tokens = rows.map((r) => r.promptTokens).filter((t) => t > 0);
  if (tokens.length >= 2) {
    const lo = Math.min(...tokens);
    const hi = Math.max(...tokens);
    if (hi / lo >= 1.02) {
      lines.push(
        `La misma solicitud pesa de ${formatTokens(lo)} a ${formatTokens(hi)} tokens según el tokenizador (${Math.round((hi / lo - 1) * 100)}% de diferencia).`,
      );
    }
  }
  return lines;
}

/** GitHub-flavored Markdown table, cheapest model first, ready to paste into a doc. */
export function toMarkdown(rows: Row[], heading: string): string {
  const sorted = [...rows].sort((a, b) => a.monthly - b.monthly);
  const ctx = compareContext(sorted);
  const cell = (text: string) => text.replace(/\|/g, "\\|");
  const lines = [
    `**${cell(heading)}**`,
    "",
    `| | ${sorted.map((r) => cell(r.model.name)).join(" | ")} |`,
    `|---|${sorted.map(() => "---").join("|")}|`,
  ];
  for (const block of groupMetrics(visibleMetrics(sorted))) {
    lines.push(`| **${block.title}** |${sorted.map(() => " ").join("|")}|`);
    for (const metric of block.metrics) {
      lines.push(`| ${metric.label} | ${sorted.map((r) => cell(metric.text(r, ctx))).join(" | ")} |`);
    }
  }
  return lines.join("\n");
}
