"use client";

import { Fragment, useMemo, useState } from "react";
import { cn } from "cn";
import { RefineBar } from "@/components/refine-bar";
import { Sym } from "@/components/sym";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MAX_COMPARE,
  compareContext,
  groupMetrics,
  summarize,
  toMarkdown,
  visibleMetrics,
  winners,
  type CompareContext,
  type Metric,
} from "@/lib/compare";
import type { Row } from "@/lib/compute-rows";
import { formatUSD } from "@/lib/format";
import type { RefineApi } from "@/lib/refine";

interface Props {
  /** Models to compare: already sorted and capped at MAX_COMPARE. */
  rows: Row[];
  /** How many models are pinned (can be more than are shown). */
  pinnedTotal: number;
  /** Every model that can be added. */
  candidates: Row[];
  /** Recommended models, for a one-click start. */
  picks: Row[];
  /** "6,000 solicitudes al mes" */
  heading: string;
  refine: RefineApi;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onUsePicks: () => void;
  onOpen: (row: Row) => void;
}

export function CompareView(props: Props) {
  return props.rows.length < 2 ? <Starter {...props} /> : <Compared {...props} />;
}

/** Where the cost per request goes, same colors as the cost chart. */
const SEGMENTS = [
  { key: "input", label: "Entrada nueva", color: "var(--s-input)" },
  { key: "cachedInput", label: "Prefijo en caché", color: "var(--s-cached)" },
  { key: "output", label: "Salida", color: "var(--s-output)" },
  { key: "reasoning", label: "Razonamiento", color: "var(--s-reason)" },
] as const;

function Starter({ rows, candidates, picks, onAdd, onRemove, onUsePicks }: Props) {
  return (
    <section className="rounded-[32px] bg-card px-6 py-12 text-center sm:px-12 sm:py-16">
      <h2 className="text-[26px] leading-tight sm:text-[32px]">
        <span className="role-display">Compara</span> <span className="role-thin">2 o más modelos</span>
      </h2>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
        Verás costo, tokens, tarifas y límites lado a lado, con el mejor valor de cada fila. Fija modelos con{" "}
        <Sym className="text-orange">★</Sym> en la tabla o agrégalos aquí.
      </p>

      {rows.length === 1 && (
        <p className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-raise py-1.5 pr-2 pl-4 text-sm shadow-raise">
          <span className="font-semibold">{rows[0].model.name}</span>
          <button
            type="button"
            aria-label={`Quitar ${rows[0].model.name}`}
            onClick={() => onRemove(rows[0].model.id)}
            className="grid size-6 place-items-center rounded-full bg-secondary text-xs outline-none hover:bg-secondary/70 focus-visible:ring-[3px] focus-visible:ring-ring/45"
          >
            <Sym>✕</Sym>
          </button>
          <span className="pr-2 text-muted-foreground">falta otro</span>
        </p>
      )}

      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {picks.length >= 2 && (
          <Button onClick={onUsePicks}>
            <Sym>★</Sym> Comparar las recomendaciones
          </Button>
        )}
        <AddModel candidates={candidates} selected={new Set(rows.map((r) => r.model.id))} full={false} onAdd={onAdd} />
      </div>
    </section>
  );
}

function Compared({
  rows,
  pinnedTotal,
  candidates,
  heading,
  refine,
  onAdd,
  onRemove,
  onClear,
  onOpen,
}: Props) {
  const ctx = useMemo(() => compareContext(rows), [rows]);
  const metrics = useMemo(() => visibleMetrics(rows), [rows]);
  const blocks = useMemo(() => groupMetrics(metrics), [metrics]);
  const wins = useMemo(() => new Map(metrics.map((m) => [m.key, winners(rows, m)])), [rows, metrics]);
  const summary = useMemo(() => summarize(rows), [rows]);
  const maxPerRequest = Math.max(...rows.map((r) => r.perRequest));
  const selected = useMemo(() => new Set(rows.map((r) => r.model.id)), [rows]);
  const [copied, setCopied] = useState<"idle" | "ok" | "error">("idle");

  async function copy() {
    const ok = await copyText(toMarkdown(rows, `Comparación · ${heading} · Tokenómetro`));
    setCopied(ok ? "ok" : "error");
    setTimeout(() => setCopied("idle"), 2400);
  }

  return (
    <section className="@container rounded-[32px] bg-card p-5 sm:p-8" aria-labelledby="compare-title">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <h2 id="compare-title" className="text-[24px] leading-tight sm:text-[28px]">
            <span className="role-display">Comparar</span>{" "}
            <span className="role-thin">{rows.length} modelos</span>
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{heading}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddModel candidates={candidates} selected={selected} full={rows.length >= MAX_COMPARE} onAdd={onAdd} />
          <Button variant="outline" size="sm" onClick={copy}>
            {copied === "ok" ? (
              <>
                <Sym className="text-signal-ink">✓</Sym> Copiado
              </>
            ) : copied === "error" ? (
              <>
                <Sym className="text-destructive">⚠</Sym> No se pudo copiar
              </>
            ) : (
              <>
                <Sym>↗</Sym> Copiar tabla
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <Sym>✕</Sym> Limpiar
          </Button>
        </div>
      </header>

      {pinnedTotal > rows.length && (
        <p className="mt-4 text-xs text-muted-foreground">
          <Sym>⚠</Sym> Fijaste {pinnedTotal} modelos; aquí se comparan los {MAX_COMPARE} más baratos. Quita alguno con ✕.
        </p>
      )}

      {summary.length > 0 && (
        <ul className="mt-6 grid gap-1.5 rounded-2xl bg-raise p-4 text-sm leading-snug shadow-raise">
          {summary.map((line) => (
            <li key={line} className="flex gap-2">
              <Sym className="mt-0.5 text-blue">●</Sym>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}

      <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground" aria-label="Qué mide la barra de cada modelo">
        <li className="role-label">Costo por solicitud</li>
        {SEGMENTS.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>

      {/* Wide: models are columns. */}
      <div
        role="table"
        aria-label="Comparación de modelos"
        className="mt-6 hidden @2xl:grid"
        style={{ gridTemplateColumns: `minmax(8rem, 11rem) repeat(${rows.length}, minmax(0, 1fr))` }}
      >
        <div role="row" className="contents">
          <div role="columnheader" aria-label="Métrica" />
          {rows.map((row) => (
            <div key={row.model.id} role="columnheader" className="min-w-0 px-2 pb-2">
              <ModelHead row={row} maxPerRequest={maxPerRequest} onOpen={onOpen} onRemove={onRemove} />
            </div>
          ))}
        </div>
        {blocks.map((block) => (
          <Fragment key={block.title}>
            <p className="role-label col-span-full pt-7 pb-1 text-muted-foreground">{block.title}</p>
            {block.metrics.map((metric) => (
              <div key={metric.key} role="row" className="contents">
                <div role="rowheader" className="flex items-center py-3 pr-3 text-sm text-muted-foreground">
                  {metric.label}
                </div>
                {rows.map((row) => (
                  <div key={row.model.id} role="cell" className="flex min-w-0 items-center px-2 py-3">
                    <Value metric={metric} row={row} ctx={ctx} win={wins.get(metric.key)?.has(row.model.id) ?? false} />
                  </div>
                ))}
              </div>
            ))}
          </Fragment>
        ))}
      </div>

      {/* Narrow: one card per model. */}
      <div className="mt-6 grid gap-4 @2xl:hidden">
        {rows.map((row) => (
          <article key={row.model.id} className="rounded-3xl bg-raise p-5 shadow-raise">
            <ModelHead row={row} maxPerRequest={maxPerRequest} onOpen={onOpen} onRemove={onRemove} />
            {blocks.map((block) => (
              <div key={block.title} className="mt-6">
                <p className="role-label mb-2 text-muted-foreground">{block.title}</p>
                <dl className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2.5">
                  {block.metrics.map((metric) => (
                    <Fragment key={metric.key}>
                      <dt className="text-sm text-muted-foreground">{metric.label}</dt>
                      <dd className="text-right">
                        <Value metric={metric} row={row} ctx={ctx} win={wins.get(metric.key)?.has(row.model.id) ?? false} />
                      </dd>
                    </Fragment>
                  ))}
                </dl>
              </div>
            ))}
          </article>
        ))}
      </div>

      <RefineBar rows={rows} refine={refine} />
    </section>
  );
}

/**
 * Clipboard write that never hangs: the async API can wait forever on a
 * permission prompt, so it is raced against a timeout and falls back to the
 * old selection-and-copy trick.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 1500)),
    ]);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function ModelHead({
  row,
  maxPerRequest,
  onOpen,
  onRemove,
}: {
  row: Row;
  maxPerRequest: number;
  onOpen: (row: Row) => void;
  onRemove: (id: string) => void;
}) {
  const m = row.model;
  const width = maxPerRequest > 0 ? Math.max((row.perRequest / maxPerRequest) * 100, 10) : 0;
  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpen(row)}
          className="min-w-0 rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
        >
          <span className="role-title block truncate text-[17px] leading-tight" title={m.name}>
            {m.name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{m.vendor}</span>
        </button>
        <button
          type="button"
          aria-label={`Quitar ${m.name} de la comparación`}
          onClick={() => onRemove(m.id)}
          className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-[11px] outline-none transition-colors hover:bg-secondary/70 focus-visible:ring-[3px] focus-visible:ring-ring/45"
        >
          <Sym>✕</Sym>
        </button>
      </div>
      {row.perRequest > 0 && (
        <div
          className="mt-3 flex h-2 overflow-hidden rounded-full bg-secondary"
          style={{ width: `${width}%` }}
          title={SEGMENTS.filter((s) => row.parts[s.key] > 0)
            .map((s) => `${s.label}: ${formatUSD(row.parts[s.key])}`)
            .join(" · ")}
          aria-hidden
        >
          {SEGMENTS.map(
            (s) =>
              row.parts[s.key] > 0 && (
                <span
                  key={s.key}
                  style={{ width: `${(row.parts[s.key] / row.perRequest) * 100}%`, background: s.color }}
                />
              ),
          )}
        </div>
      )}
    </div>
  );
}

function Value({
  metric,
  row,
  ctx,
  win,
}: {
  metric: Metric;
  row: Row;
  ctx: CompareContext;
  win: boolean;
}) {
  const big = metric.key === "monthly";
  return (
    <span
      className={cn(
        big ? "num-lg text-[22px]" : "num text-sm",
        win && "inline-block rounded-full bg-signal-soft px-2.5 py-0.5 font-bold text-signal-ink",
      )}
    >
      {metric.text(row, ctx)}
      {win && <span className="sr-only"> (el mejor)</span>}
    </span>
  );
}

/** Search box over every model; picks the cheapest matches first. */
function AddModel({
  candidates,
  selected,
  full,
  onAdd,
}: {
  candidates: Row[];
  selected: ReadonlySet<string>;
  full: boolean;
  onAdd: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return candidates
      .filter(
        (r) =>
          !selected.has(r.model.id) &&
          (!needle || `${r.model.name} ${r.model.vendor} ${r.model.id}`.toLowerCase().includes(needle)),
      )
      .sort((a, b) => a.monthly - b.monthly)
      .slice(0, 8);
  }, [candidates, selected, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={full} title={full ? `Máximo ${MAX_COMPARE} modelos` : undefined}>
          <Sym>+</Sym> Agregar modelo
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="relative p-1">
          <Sym className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-base text-muted-foreground">⌕</Sym>
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar modelo o proveedor"
            aria-label="Buscar modelo para comparar"
            className="pl-10"
          />
        </div>
        <ul className="mt-1 max-h-72 overflow-y-auto">
          {matches.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted-foreground">Sin resultados</li>}
          {matches.map((r) => (
            <li key={r.model.id}>
              <button
                type="button"
                onClick={() => {
                  onAdd(r.model.id);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left outline-none hover:bg-secondary focus-visible:bg-secondary"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{r.model.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.model.vendor}</span>
                </span>
                <span className="num shrink-0 text-xs text-muted-foreground">{formatUSD(r.monthly)}/mes</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
