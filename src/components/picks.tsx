"use client";

import { usePreferences } from "@/components/preferences-provider";
import { cn } from "cn";
import { Sym } from "@/components/sym";
import type { Analysis, Row } from "@/lib/compute-rows";
import { formatIndex, formatMultiple, formatUSD } from "@/lib/format";

interface PickProps {
  label: string;
  caption: string;
  row: Row | null;
  empty: string;
  multiple: number;
  recommended?: boolean;
  onOpen: (row: Row) => void;
}

function Pick({ label, caption, row, empty, multiple, recommended, onOpen }: PickProps) {
  const { t } = usePreferences();
  const shell = cn(
    "relative flex h-full flex-col rounded-[28px] p-5 text-left transition-[transform,background-color] sm:p-6",
    recommended ? "bg-foreground text-background" : "bg-card",
  );
  const muted = recommended ? "text-background/60" : "text-muted-foreground";

  const header = (
    <div className="flex items-center justify-between gap-2">
      <p className={cn("role-label", muted)}>{label}</p>
      {recommended && (
        <span className="inline-flex h-5 items-center gap-1 rounded-full bg-green px-2.5 text-[11px] font-bold text-white dark:text-black">
          <Sym>★</Sym> {t(" Recomendado")}
        </span>
      )}
    </div>
  );

  const body = row ? (
    <>
      <div className="mt-3 min-w-0">
        <p className="role-title truncate text-[20px] leading-tight">{row.model.name}</p>
        <p className={cn("mt-0.5 truncate text-xs", muted)}>{row.model.vendor}</p>
      </div>
      <div className="mt-5">
        <p className="num-lg text-[34px] leading-none">
          {formatUSD(row.monthly)}
          <span className={cn("ml-1.5 text-sm font-medium tracking-normal", muted)}>{t("/mes")}</span>
        </p>
        <p className={cn("num mt-2 text-xs", muted)}>
          {multiple < 1.05 ? t("el más barato") : t("{0} el más barato", [formatMultiple(multiple)])}
          {row.model.intelligence !== null && t(" · índice {0}", [formatIndex(row.model.intelligence)])}
        </p>
      </div>
    </>
  ) : (
    <p className={cn("mt-3 text-sm", muted)}>{empty}</p>
  );

  const foot = <p className={cn("mt-auto pt-5 text-xs leading-snug", muted)}>{caption}</p>;

  if (!row) {
    return (
      <div className={shell}>
        {header}
        {body}
        {foot}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className={cn(
        shell,
        "outline-none hover:scale-[1.01] focus-visible:ring-[3px] focus-visible:ring-ring/45 active:scale-[0.99]",
        !recommended && "hover:bg-secondary",
      )}
    >
      {header}
      {body}
      {foot}
    </button>
  );
}

export function Picks({ analysis, onOpen }: { analysis: Analysis; onOpen: (row: Row) => void }) {
  const { t } = usePreferences();
  const { cheapest, balanced, bestQuality, multiple } = analysis;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Pick
        label={t("Más barato")}
        caption={t("Menor costo mensual con tus filtros.")}
        row={cheapest}
        empty={t("Ningún modelo cumple tus filtros.")}
        multiple={cheapest ? multiple(cheapest) : 1}
        onOpen={onOpen}
      />
      <Pick
        label={t("Equilibrio")}
        caption={t("Donde pagar más deja de rendir: el codo de la frontera calidad-costo.")}
        row={balanced}
        empty={t("Faltan modelos con índice de calidad para calcularlo.")}
        multiple={balanced ? multiple(balanced) : 1}
        recommended={balanced !== null}
        onOpen={onOpen}
      />
      <Pick
        label={t("Mejor calidad")}
        caption={t("Mayor índice de inteligencia entre los que pasan tus filtros.")}
        row={bestQuality}
        empty={t("Ningún modelo con índice de calidad.")}
        multiple={bestQuality ? multiple(bestQuality) : 1}
        onOpen={onOpen}
      />
    </div>
  );
}
