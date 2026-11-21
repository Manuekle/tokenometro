"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Analysis, Row } from "@/lib/compute-rows";
import { formatAxisUSD, formatIndex, formatUSD } from "@/lib/format";

interface Point {
  id: string;
  name: string;
  vendor: string;
  cost: number;
  q: number;
  row: Row;
  kind: "other" | "frontier" | "marked";
}

const M = { top: 22, right: 30, bottom: 50, left: 54 };
const LABEL_H = 13;
const CHAR_W = 6.2;

/** 1, 2, 5 per decade inside [min, max]. */
function logTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e;
      if (v >= min && v <= max) ticks.push(v);
    }
  }
  return ticks;
}

function niceTicks(min: number, max: number, target = 6): number[] {
  const rough = (max - min || 1) / target;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

interface Placement {
  tx: number;
  ty: number;
  anchor: "start" | "middle" | "end";
}

/** Greedy label placement: top, bottom, right, left; skip when nothing fits. */
function placeLabels(
  pts: { id: string; name: string; px: number; py: number; r: number }[],
  bounds: Rect,
): Map<string, Placement> {
  const taken: Rect[] = [];
  const out = new Map<string, Placement>();
  const hitsPoint = (rect: Rect, self: string) =>
    pts.some(
      (o) =>
        o.id !== self &&
        o.px + o.r > rect.x &&
        o.px - o.r < rect.x + rect.w &&
        o.py + o.r > rect.y &&
        o.py - o.r < rect.y + rect.h,
    );

  for (const p of pts) {
    const w = p.name.length * CHAR_W + 4;
    const candidates: (Placement & { rect: Rect })[] = [
      { tx: p.px, ty: p.py - p.r - 5, anchor: "middle", rect: { x: p.px - w / 2, y: p.py - p.r - 5 - LABEL_H + 2, w, h: LABEL_H } },
      { tx: p.px, ty: p.py + p.r + 13, anchor: "middle", rect: { x: p.px - w / 2, y: p.py + p.r + 3, w, h: LABEL_H } },
      { tx: p.px + p.r + 6, ty: p.py + 4, anchor: "start", rect: { x: p.px + p.r + 5, y: p.py - LABEL_H / 2, w, h: LABEL_H } },
      { tx: p.px - p.r - 6, ty: p.py + 4, anchor: "end", rect: { x: p.px - p.r - 5 - w, y: p.py - LABEL_H / 2, w, h: LABEL_H } },
    ];
    for (const c of candidates) {
      const inside =
        c.rect.x >= bounds.x &&
        c.rect.x + c.rect.w <= bounds.x + bounds.w &&
        c.rect.y >= bounds.y &&
        c.rect.y + c.rect.h <= bounds.y + bounds.h;
      if (inside && !taken.some((t) => overlaps(c.rect, t)) && !hitsPoint(c.rect, p.id)) {
        taken.push(c.rect);
        out.set(p.id, { tx: c.tx, ty: c.ty, anchor: c.anchor });
        break;
      }
    }
  }
  return out;
}

export function FrontierChart({
  rows,
  analysis,
  pinned,
  onOpen,
}: {
  rows: Row[];
  analysis: Analysis;
  pinned: ReadonlySet<string>;
  onOpen: (row: Row) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [hover, setHover] = useState<Point | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = Math.round(Math.min(520, Math.max(340, width * 0.56)));
  const innerW = width - M.left - M.right;
  const innerH = height - M.top - M.bottom;

  const model = useMemo(() => {
    const frontierIds = new Set(analysis.frontier.map((r) => r.model.id));
    const scored = rows.filter((r) => r.model.intelligence !== null);
    if (scored.length === 0) return null;
    const toPoint = (r: Row, kind: Point["kind"]): Point => ({
      id: r.model.id,
      name: r.model.name,
      vendor: r.model.vendor,
      cost: Math.max(r.monthly, 0.01),
      q: r.model.intelligence as number,
      row: r,
      kind,
    });
    const points: Point[] = scored.map((r) =>
      toPoint(r, frontierIds.has(r.model.id) ? "frontier" : pinned.has(r.model.id) ? "marked" : "other"),
    );
    const costs = points.map((p) => p.cost);
    const qs = points.map((p) => p.q);
    const lo = Math.min(...costs) / 1.25;
    const hi = Math.max(...costs) * 1.25;
    const qMin = Math.floor((Math.min(...qs) - 2) / 5) * 5;
    const qMax = Math.ceil((Math.max(...qs) + 2) / 5) * 5;
    return {
      points,
      frontier: analysis.frontier.map((r) => toPoint(r, "frontier")),
      lo,
      hi,
      qMin,
      qMax,
      xTicks: logTicks(lo, hi),
      yTicks: niceTicks(qMin, qMax),
    };
  }, [rows, analysis.frontier, pinned]);

  if (!model) {
    return (
      <div className="rounded-[28px] bg-card p-12 text-center text-sm text-muted-foreground">
        Ningún modelo con índice de calidad en esta vista. Relaja los filtros.
      </div>
    );
  }

  const { points, frontier, lo, hi, qMin, qMax, xTicks, yTicks } = model;
  const x = (v: number) => M.left + ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * innerW;
  const y = (v: number) => M.top + (1 - (v - qMin) / (qMax - qMin)) * innerH;
  const radius = (k: Point["kind"]) => (k === "frontier" ? 6 : k === "marked" ? 6.5 : 3.6);

  const labelled = points.filter((p) => p.kind !== "other");
  const labels = placeLabels(
    labelled.map((p) => ({ id: p.id, name: p.name, px: x(p.cost), py: y(p.q), r: radius(p.kind) })),
    { x: M.left, y: M.top - 6, w: innerW + M.right - 4, h: innerH + 6 },
  );

  function nearest(clientX: number, clientY: number, svg: SVGSVGElement): Point | null {
    const box = svg.getBoundingClientRect();
    const px = clientX - box.left;
    const py = clientY - box.top;
    let best: Point | null = null;
    let bestD = 18 * 18;
    for (const p of points) {
      const dx = x(p.cost) - px;
      const dy = y(p.q) - py;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  const tip = hover ? { left: Math.min(Math.max(x(hover.cost), 110), width - 110), top: y(hover.q) } : null;

  return (
    <figure className="rounded-[32px] bg-card p-5 sm:p-7">
      <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="max-w-xl text-xs leading-snug text-muted-foreground">
          Cada punto es un modelo: a la derecha cuesta más, arriba rinde más. La línea verde es la{" "}
          <strong className="font-semibold text-foreground">frontera eficiente</strong>: ningún otro modelo es a la
          vez más barato y mejor.
        </p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          <Legend color="var(--signal)" label="Frontera" />
          <Legend color="var(--dot)" label="Otros" />
          {pinned.size > 0 && <Legend color="var(--orange)" label="Fijados" />}
        </ul>
      </figcaption>

      <div ref={wrap} className="relative">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Calidad frente a costo mensual de ${points.length} modelos. La frontera eficiente tiene ${frontier.length}: ${frontier.map((p) => p.name).join(", ")}.`}
          className="block touch-manipulation select-none"
          onPointerMove={(e) => setHover(nearest(e.clientX, e.clientY, e.currentTarget))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const p = nearest(e.clientX, e.clientY, e.currentTarget);
            if (p) onOpen(p.row);
          }}
          style={{ cursor: hover ? "pointer" : "default" }}
        >
          {/* grid + axes */}
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
              <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted-foreground)" className="num">
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <g key={`x${t}`}>
              <line x1={x(t)} x2={x(t)} y1={M.top} y2={M.top + innerH} stroke="var(--grid)" />
              <text x={x(t)} y={M.top + innerH + 18} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)" className="num">
                {formatAxisUSD(t)}
              </text>
            </g>
          ))}
          <text x={M.left + innerW / 2} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">
            Costo mensual · escala logarítmica
          </text>
          <text
            transform={`translate(14 ${M.top + innerH / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={11}
            fill="var(--muted-foreground)"
          >
            Índice de inteligencia
          </text>

          {/* frontier line */}
          {frontier.length > 1 && (
            <polyline
              points={frontier.map((p) => `${x(p.cost)},${y(p.q)}`).join(" ")}
              fill="none"
              stroke="var(--signal)"
              strokeWidth={2}
              strokeLinejoin="round"
            />
          )}

          {/* points: others first so the interesting ones sit on top */}
          {[...points].sort((a, b) => order(a.kind) - order(b.kind)).map((p) => {
            const active = hover?.id === p.id;
            const fill = p.kind === "frontier" ? "var(--signal)" : p.kind === "marked" ? "var(--orange)" : "var(--dot)";
            return (
              <circle
                key={p.id}
                cx={x(p.cost)}
                cy={y(p.q)}
                r={radius(p.kind) + (active ? 2 : 0)}
                fill={fill}
                fillOpacity={p.kind === "other" ? 0.8 : 1}
                stroke="var(--card)"
                strokeWidth={1.5}
              />
            );
          })}

          {/* labels for frontier and pinned models */}
          {labelled.map((p) => {
            const spot = labels.get(p.id);
            if (!spot) return null;
            return (
              <text
                key={`l${p.id}`}
                x={spot.tx}
                y={spot.ty}
                textAnchor={spot.anchor}
                fontSize={11}
                fontWeight={500}
                fill="var(--foreground)"
                stroke="var(--card)"
                strokeWidth={3}
                paintOrder="stroke"
                pointerEvents="none"
              >
                {p.name}
              </text>
            );
          })}
        </svg>

        {hover && tip && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 w-52 -translate-x-1/2 -translate-y-full rounded-2xl bg-popover px-4 py-3 text-xs shadow-pop"
            style={{ left: tip.left, top: Math.max(tip.top - 12, 56) }}
          >
            <p className="font-semibold">{hover.name}</p>
            <p className="text-muted-foreground">{hover.vendor}</p>
            <p className="num mt-1.5">
              {formatUSD(hover.row.monthly)}
              <span className="text-muted-foreground"> /mes</span> · índice {formatIndex(hover.q)}
            </p>
          </div>
        )}
      </div>

      {frontier.length > 0 && (
        <ol className="mt-5 flex flex-wrap gap-2 text-xs">
          {frontier.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onOpen(p.row)}
                className="rounded-full bg-raise px-3.5 py-1.5 text-left shadow-raise outline-none transition-colors hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/45"
              >
                <span className="font-semibold">{p.name}</span>{" "}
                <span className="num text-muted-foreground">
                  {formatUSD(p.row.monthly)} · {formatIndex(p.q)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        Índice de inteligencia: Artificial Analysis (vía OpenRouter). Mide tareas generales; valida con tus propios
        casos antes de decidir.
      </p>
    </figure>
  );
}

const order = (k: Point["kind"]) => (k === "other" ? 0 : k === "marked" ? 1 : 2);

function Legend({ color, label, ring }: { color: string; label: string; ring?: boolean }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className="inline-block size-2.5 rounded-full"
        style={{ background: color, outline: ring ? "1.5px solid var(--foreground)" : undefined }}
      />
      {label}
    </li>
  );
}
