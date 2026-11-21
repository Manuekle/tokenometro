"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Row } from "@/lib/compute-rows";
import { formatAxisUSD, formatUSD } from "@/lib/format";

const CHEAPEST = 15;

interface Datum {
  id: string;
  name: string;
  input: number;
  cachedInput: number;
  output: number;
  reasoning: number;
  total: number;
  row: Row;
}

const SERIES = [
  { key: "input", label: "Entrada nueva", color: "var(--s-input)" },
  { key: "cachedInput", label: "Prefijo en caché", color: "var(--s-cached)" },
  { key: "output", label: "Salida", color: "var(--s-output)" },
  { key: "reasoning", label: "Razonamiento", color: "var(--s-reason)" },
] as const;

const clip = (s: string, n = 24) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function CostChart({
  rows,
  pinned,
  requestsPerMonth,
  onOpen,
}: {
  rows: Row[];
  pinned: ReadonlySet<string>;
  requestsPerMonth: number;
  onOpen: (row: Row) => void;
}) {
  const data = useMemo<Datum[]>(() => {
    const byCost = [...rows].sort((a, b) => a.monthly - b.monthly);
    const chosen = new Map<string, Row>();
    for (const r of byCost.slice(0, CHEAPEST)) chosen.set(r.model.id, r);
    for (const r of byCost) if (pinned.has(r.model.id)) chosen.set(r.model.id, r);
    return [...chosen.values()]
      .sort((a, b) => a.monthly - b.monthly)
      .map((r) => ({
        id: r.model.id,
        name: r.model.name,
        input: r.parts.input * requestsPerMonth,
        cachedInput: r.parts.cachedInput * requestsPerMonth,
        output: r.parts.output * requestsPerMonth,
        reasoning: r.parts.reasoning * requestsPerMonth,
        total: r.monthly,
        row: r,
      }));
  }, [rows, pinned, requestsPerMonth]);

  if (data.length === 0) return <p className="p-8 text-center text-sm text-muted-foreground">Sin modelos para graficar.</p>;

  return (
    <figure className="rounded-[32px] bg-card p-5 sm:p-7">
      <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-xs text-muted-foreground">
          Los {CHEAPEST} más baratos con tus filtros{pinned.size > 0 ? " y tus fijados" : ""}. Costo mensual por
          concepto.
        </p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      </figcaption>
      <div role="img" aria-label="Costo mensual por modelo, apilado por concepto">
        <ResponsiveContainer width="100%" height={data.length * 30 + 56}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }} barCategoryGap={5}>
            <CartesianGrid horizontal={false} stroke="var(--grid)" />
            <XAxis
              type="number"
              tickFormatter={(v: number) => formatAxisUSD(v)}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={168}
              tickFormatter={(v: string) => clip(v)}
              tick={{ fontSize: 12, fill: "var(--foreground)" }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<CostTooltip />} />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="cost"
                fill={s.color}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(d: unknown) => {
                  const datum = (d as { payload?: Datum }).payload;
                  if (datum) onOpen(datum.row);
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function CostTooltip({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-2xl bg-popover px-4 py-3 text-xs shadow-pop">
      <p className="mb-2 text-[13px] font-bold">{d.name}</p>
      <dl className="grid gap-0.5">
        {SERIES.map((s) =>
          d[s.key] > 0 ? (
            <div key={s.key} className="flex items-center justify-between gap-6">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-block size-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </dt>
              <dd className="num">{formatUSD(d[s.key])}</dd>
            </div>
          ) : null,
        )}
        <div className="mt-1.5 flex items-center justify-between gap-6 pt-1.5 font-bold">
          <dt>Total / mes</dt>
          <dd className="num">{formatUSD(d.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
