"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import { Sym } from "@/components/sym";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Analysis, Row } from "@/lib/compute-rows";
import {
  formatContext,
  formatIndex,
  formatMultiple,
  formatTokens,
  formatUSD,
} from "@/lib/format";
import { RefineBar } from "@/components/refine-bar";
import type { RefineApi } from "@/lib/refine";
import { TOKENIZERS, isRepoEngine } from "@/lib/tokenizers/registry";
import type { DisplayAccuracy } from "@/lib/tokenizers/resolve";
import { useNow } from "@/lib/use-now";

/** Log range of monthly costs in view: prices span orders of magnitude. */
function costRange(rows: Row[]): { lo: number; hi: number } | null {
  const costs = rows.map((r) => r.monthly).filter((c) => c > 0);
  if (costs.length === 0) return null;
  return { lo: Math.log10(Math.min(...costs)), hi: Math.log10(Math.max(...costs)) };
}

/** 0..1 position of `cost` inside the log range (0.5 when there is no spread). */
function barFill(cost: number, range: { lo: number; hi: number } | null): number {
  if (!range || cost <= 0) return 0;
  return range.hi === range.lo ? 0.5 : (Math.log10(cost) - range.lo) / (range.hi - range.lo);
}

type SortKey = "name" | "tokens" | "perRequest" | "monthly" | "intelligence" | "context";
type SortDir = "asc" | "desc";

/** Rows shown first, and added per click: the panel stays about as tall as the charts. */
const FIRST_PAGE = 10;
const STEP = 20;

const ACCURACY: Record<DisplayAccuracy, { glyph: string; cls: string; label: string }> = {
  exact: { glyph: "●", cls: "text-foreground", label: "Conteo exacto con el tokenizador del modelo" },
  approx: { glyph: "●", cls: "text-faint", label: "Conteo aproximado con un tokenizador de la misma línea" },
  calibrated: { glyph: "●", cls: "text-green", label: "Calibrado con la API del proveedor" },
  estimate: { glyph: "○", cls: "text-muted-foreground", label: "Estimado: el proveedor no publica su tokenizador" },
};

function sortValue(row: Row, key: SortKey): number | string {
  switch (key) {
    case "name":
      return row.model.name.toLowerCase();
    case "tokens":
      return row.promptTokens;
    case "perRequest":
      return row.perRequest;
    case "monthly":
      return row.monthly;
    case "intelligence":
      return row.model.intelligence ?? -1;
    case "context":
      return row.model.contextLength;
  }
}

interface Props {
  rows: Row[];
  analysis: Analysis;
  pinned: ReadonlySet<string>;
  onTogglePin: (id: string) => void;
  onOpen: (row: Row) => void;
  refine: RefineApi;
}

export function ResultsTable({ rows, analysis, pinned, onTogglePin, onOpen, refine }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "monthly", dir: "asc" });
  const [limit, setLimit] = useState(FIRST_PAGE);

  const frontier = useMemo(() => new Set(analysis.frontier.map((r) => r.model.id)), [analysis.frontier]);

  const sorted = useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = sortValue(a, sort.key);
      const y = sortValue(b, sort.key);
      // Models without a quality index always sink to the bottom.
      if (sort.key === "intelligence") {
        if (x === -1 && y !== -1) return 1;
        if (y === -1 && x !== -1) return -1;
      }
      if (typeof x === "string" && typeof y === "string") return x.localeCompare(y) * factor;
      return ((x as number) - (y as number)) * factor || a.monthly - b.monthly;
    });
  }, [rows, sort]);

  const range = useMemo(() => costRange(rows), [rows]);
  const now = useNow();

  const toggle = (key: SortKey) => {
    setLimit(FIRST_PAGE);
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" || key === "monthly" || key === "perRequest" || key === "tokens" ? "asc" : "desc" },
    );
  };

  const head = (key: SortKey, label: string, className?: string) => (
    <TableHead
      className={cn("px-2", className)}
      aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => toggle(key)}
        className={cn(
          "role-label inline-flex items-center gap-1 rounded-full px-1 py-1 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/45",
          className?.includes("text-right") && "flex-row-reverse",
          sort.key === key ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {sort.key === key && <Sym className="text-[11px]">{sort.dir === "asc" ? "↑" : "↓"}</Sym>}
      </button>
    </TableHead>
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-[28px] bg-card p-12 text-center">
        <p className="role-title text-lg">Ningún modelo cumple tus filtros</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Relaja la calidad mínima, el presupuesto o el contexto para ver más opciones.
        </p>
      </div>
    );
  }

  const shown = sorted.slice(0, limit);
  return (
    // Columns appear as the container grows (container queries, not viewport):
    // the rail + table layout leaves very different widths at the same screen size.
    <div className="@container rounded-[32px] bg-card p-3 sm:p-5">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 px-1 @lg:px-2" />
            {head("name", "Modelo")}
            {head("tokens", "Tokens", "hidden text-right @lg:table-cell")}
            {head("perRequest", "$ / solicitud", "hidden text-right @2xl:table-cell")}
            {head("monthly", "$ / mes", "text-right")}
            <TableHead
              className="role-label hidden px-2 text-right @3xl:table-cell"
              title="Cuántas veces cuesta más que el modelo más barato de esta vista"
            >
              × mínimo
            </TableHead>
            {head("intelligence", "Índice", "text-right")}
            {head("context", "Contexto", "hidden text-right @2xl:table-cell")}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((row) => (
            <ModelRow
              key={row.model.id}
              row={row}
              multiple={analysis.multiple(row)}
              barFill={barFill(row.monthly, range)}
              now={now}
              isFrontier={frontier.has(row.model.id)}
              isPinned={pinned.has(row.model.id)}
              onTogglePin={onTogglePin}
              onOpen={onOpen}
            />
          ))}
        </TableBody>
      </Table>
      <RefineBar rows={shown} refine={refine} />
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-4">
        <p className="num text-xs text-muted-foreground">
          {Math.min(limit, sorted.length)} de {sorted.length} modelos
        </p>
        {limit < sorted.length && (
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + STEP)}>
            Mostrar {Math.min(STEP, sorted.length - limit)} más <Sym>↓</Sym>
          </Button>
        )}
      </div>
    </div>
  );
}

const CAPS = [
  { key: "reason", label: "razona", cls: "bg-purple/15", on: (m: Row["model"]) => m.reasoning === "default" || m.reasoning === "mandatory", tip: "Razona por defecto" },
  { key: "vision", label: "visión", cls: "bg-blue/15", on: (m: Row["model"]) => m.inputModalities.includes("image"), tip: "Acepta imágenes" },
  { key: "open", label: "abierto", cls: "bg-orange/20", on: (m: Row["model"]) => m.openWeights, tip: "Pesos abiertos" },
] as const;

function ModelRow({
  row,
  multiple,
  barFill,
  now,
  isFrontier,
  isPinned,
  onTogglePin,
  onOpen,
}: {
  row: Row;
  multiple: number;
  barFill: number;
  /** ms since epoch on the client; 0 while server rendering. */
  now: number;
  isFrontier: boolean;
  isPinned: boolean;
  onTogglePin: (id: string) => void;
  onOpen: (row: Row) => void;
}) {
  const m = row.model;
  const acc = ACCURACY[row.accuracy];
  const daysLeft = m.expiresAt && now > 0 ? Math.ceil((Date.parse(m.expiresAt) - now) / 86_400_000) : null;
  const retiring = daysLeft !== null && daysLeft <= 180;

  return (
    <TableRow className="cursor-pointer" data-pinned={isPinned || undefined} onClick={() => onOpen(row)}>
      <TableCell className="w-10 px-1 @lg:px-2">
        <button
          type="button"
          aria-pressed={isPinned}
          aria-label={isPinned ? `Quitar ${m.name} de fijados` : `Fijar ${m.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(m.id);
          }}
          className={cn(
            "grid size-8 place-items-center rounded-full text-[15px] outline-none transition-colors hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/45",
            isPinned ? "text-orange" : "text-faint/70 hover:text-muted-foreground",
          )}
        >
          <Sym>★</Sym>
        </button>
      </TableCell>
      <TableCell className="max-w-[8rem] px-2 py-2.5 @lg:max-w-[16rem] @4xl:max-w-[24rem]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(row);
          }}
          className="block max-w-full truncate rounded-md text-left text-[15px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 [font-variation-settings:'ROND'_70]"
        >
          {m.name}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{m.vendor}</span>
          {isFrontier && (
            <span className="inline-flex items-center gap-1 rounded-full bg-signal-soft px-2 py-px text-[10.5px] font-bold text-signal-ink">
              <Sym>●</Sym> frontera
            </span>
          )}
          {retiring && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange/20 px-2 py-px text-[10.5px] font-bold">
              <Sym>⚠</Sym> {daysLeft! <= 0 ? "retirado" : `se retira en ${daysLeft} d`}
            </span>
          )}
          {m.free && <span className="rounded-full bg-secondary px-2 py-px text-[10.5px] font-semibold">gratis</span>}
          <span className="hidden items-center gap-1 @4xl:inline-flex">
            {CAPS.filter((c) => c.on(m)).map((c) => (
              <Tooltip key={c.key}>
                <TooltipTrigger asChild>
                  <span className={cn("rounded-full px-2 py-px text-[10.5px] font-semibold text-foreground", c.cls)}>
                    {c.label}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{c.tip}</TooltipContent>
              </Tooltip>
            ))}
          </span>
        </div>
      </TableCell>
      <TableCell className="num hidden px-2 text-right text-sm @lg:table-cell">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center justify-end gap-1.5">
              {formatTokens(row.promptTokens)}
              <Sym className={cn("text-[10px]", acc.cls)}>{acc.glyph}</Sym>
              <span className="sr-only">{acc.label}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-60">
            {acc.label}. Tokenizador: {isRepoEngine(row.engine) ? "propio del modelo" : TOKENIZERS[m.tokenizer].label}.
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="num hidden px-2 text-right text-sm @2xl:table-cell">{formatUSD(row.perRequest)}</TableCell>
      <TableCell className="px-2 text-right">
        <span className="num text-[15px] font-bold">{formatUSD(row.monthly)}</span>
        <span aria-hidden className="mt-1.5 ml-auto block h-1 w-full max-w-24 rounded-full bg-secondary">
          <span
            className="block h-full rounded-full bg-blue"
            style={{ width: `${Math.max(6, Math.round(barFill * 100))}%` }}
          />
        </span>
      </TableCell>
      <TableCell className="num hidden px-2 text-right text-xs text-muted-foreground @3xl:table-cell">
        {formatMultiple(multiple)}
      </TableCell>
      <TableCell className="num px-2 text-right text-sm">{formatIndex(m.intelligence)}</TableCell>
      <TableCell className="num hidden px-2 text-right text-sm @2xl:table-cell">
        {formatContext(m.contextLength)}
      </TableCell>
    </TableRow>
  );
}
