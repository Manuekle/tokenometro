"use client";

import { usePreferences } from "@/components/preferences-provider";
import { cn } from "cn";
import { Sym } from "@/components/sym";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatInt } from "@/lib/format";
import type { EngineStatus } from "@/lib/tokenizers/protocol";
import { HF_IDS, TOKENIZERS, type TokenizerId } from "@/lib/tokenizers/registry";
import type { DisplayAccuracy } from "@/lib/tokenizers/resolve";

export interface RibbonEstimate {
  id: TokenizerId;
  tokens: number;
  accuracy: DisplayAccuracy;
  models: number;
}

interface Props {
  /** Preview text shown cut by each tokenizer. */
  excerpt: string;
  pieces: Partial<Record<TokenizerId, { excerpt: string; pieces: string[] }>>;
  /** Engines that are ready, in any order. */
  engineIds: TokenizerId[];
  /** Mean input tokens per request (whole sample set) per engine. */
  totals: Partial<Record<TokenizerId, number>>;
  estimates: RibbonEstimate[];
  status: (id: TokenizerId) => EngineStatus;
  onLoadAll: () => void;
  onRetry: (id: TokenizerId) => void;
  /** Models whose count is exact / total models in view. */
  exactModels: number;
  totalModels: number;
  hasSamples: boolean;
  /** Slot for the calibration button. */
  calibrate?: React.ReactNode;
}

/** How many tints the token pills cycle through (see --cut-N in globals.css). */
const CUTS = 10;

const HF_TOTAL_MB = HF_IDS.reduce((sum, id) => sum + (TOKENIZERS[id].approxMB ?? 0), 0);

export function TokenRibbon({
  excerpt,
  pieces,
  engineIds,
  totals,
  estimates,
  status,
  onLoadAll,
  onRetry,
  exactModels,
  totalModels,
  hasSamples,
  calibrate,
}: Props) {
  const { t, tError } = usePreferences();
  const rows = engineIds
    .filter((id) => totals[id] !== undefined && pieces[id]?.excerpt === excerpt)
    .sort((a, b) => (totals[a] ?? 0) - (totals[b] ?? 0));
  const best = rows.length > 0 ? (totals[rows[0]] ?? 0) : 0;

  const hfStates = HF_IDS.map((id) => ({ id, s: status(id) }));
  const loading = hfStates.filter(({ s }) => s.state === "loading");
  const failed = hfStates.filter(({ s }) => s.state === "error");
  const idle = hfStates.filter(({ s }) => s.state === "idle");
  const ready = hfStates.filter(({ s }) => s.state === "ready");

  return (
    <section className="rounded-[32px] bg-card p-6 sm:p-8" aria-labelledby="ribbon-title">
      <header>
        <h2 id="ribbon-title" className="text-[26px] leading-[1.05] sm:text-[32px]">
          <span className="role-display">{t("Mismo texto,")}</span>{" "}
          <span className="role-thin">{t("distintos cortes")}</span>
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t(
            "Cada modelo trocea tu texto a su manera. Menos cortes son menos tokens, y los tokens son lo que se factura.",
          )}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {idle.length > 0 && loading.length === 0 && (
            <Button size="sm" onClick={onLoadAll}>
              <Sym>↓</Sym> {t(" Cargar tokenizadores reales")}
              <span className="num text-[11px] font-normal opacity-60">≈{HF_TOTAL_MB} MB</span>
            </Button>
          )}
          {loading.length > 0 && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Sym className="animate-pulse text-blue">●</Sym>
              {t("Descargando ")}
              {loading.map(({ id }) => TOKENIZERS[id].label).join(", ")}…
            </p>
          )}
          {idle.length === 0 && loading.length === 0 && failed.length === 0 && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-signal-ink">
              <Sym>✓</Sym> {t(" Tokenizadores reales cargados")}
            </p>
          )}
          <p className="num text-xs text-muted-foreground">
            {exactModels} {t(" de ")}
            {totalModels} {t(" modelos con conteo exacto")}
            {ready.length > 0 && idle.length > 0 ? ` · ${ready.length}/${HF_IDS.length} familias` : ""}
          </p>
        </div>
      </header>

      <div className="mt-6">
        {!hasSamples ? (
          <p className="py-6 text-sm text-muted-foreground">
            {t("Agrega un texto en el paso 1 para ver cómo lo corta cada tokenizador.")}
          </p>
        ) : rows.length === 0 ? (
          <div className="grid gap-3" aria-busy="true" aria-label={t("Cortando el texto")}>
            {[0, 1].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        ) : (
          <ol className="grid gap-1">
            {rows.map((id, i) => (
              <RibbonRow
                key={id}
                id={id}
                pieces={pieces[id]?.pieces ?? []}
                total={totals[id] ?? 0}
                best={best}
                isBest={i === 0}
              />
            ))}
          </ol>
        )}
        {hasSamples && rows.length > 0 && (
          <p className="pt-3 text-xs text-muted-foreground">
            {t("Vista previa de los primeros ")}
            {excerpt.length} {t(" caracteres. Las cifras cuentan el texto completo, por solicitud.")}
          </p>
        )}
      </div>

      {failed.length > 0 && (
        <div className="mt-5 grid gap-1.5 rounded-2xl bg-destructive/10 p-4 text-xs">
          {failed.map(({ id, s }) => (
            <p key={id} className="flex flex-wrap items-center gap-2" role="alert">
              <Sym className="text-destructive">⚠</Sym>
              <span>
                {t("No se pudo cargar ")}
                <strong>{TOKENIZERS[id].label}</strong>: {tError(s.error ?? "error de red")}.
              </span>
              <button
                type="button"
                className="font-semibold underline underline-offset-2 hover:no-underline"
                onClick={() => onRetry(id)}
              >
                {t("Reintentar")}
              </button>
            </p>
          ))}
        </div>
      )}

      {hasSamples && estimates.length > 0 && (
        <footer className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          <p className="role-label text-muted-foreground">{t("Sin tokenizador público")}</p>
          <ul className="flex flex-wrap gap-2">
            {estimates.map((e) => (
              <li key={e.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "num inline-flex items-center gap-2 rounded-full bg-raise px-3.5 py-1.5 text-xs shadow-raise",
                        e.accuracy === "calibrated" && "bg-signal-soft",
                      )}
                    >
                      <span className="font-semibold">{t(TOKENIZERS[e.id].label)}</span>
                      <span className="font-bold">
                        {e.accuracy === "calibrated" ? "" : "≈ "}
                        {formatInt(e.tokens)}
                      </span>
                      <span className="text-muted-foreground">
                        {e.accuracy === "calibrated"
                          ? t("calibrado")
                          : e.accuracy === "approx"
                            ? t("aprox.")
                            : t("estimado")}
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">
                    {t(TOKENIZERS[e.id].note ?? "Estimado a partir de o200k.")} {t(" Afecta a ")}
                    {e.models} {t(" modelos.")}
                  </TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
          {calibrate && <div className="sm:ml-auto">{calibrate}</div>}
        </footer>
      )}
    </section>
  );
}

function RibbonRow({
  id,
  pieces,
  total,
  best,
  isBest,
}: {
  id: TokenizerId;
  pieces: string[];
  total: number;
  best: number;
  isBest: boolean;
}) {
  const { t } = usePreferences();
  const spec = TOKENIZERS[id];
  const delta = best > 0 ? Math.round((total / best - 1) * 100) : 0;
  return (
    <li className="grid items-start gap-x-6 gap-y-2 py-3.5 sm:grid-cols-[136px_minmax(0,1fr)_124px]">
      <div className="leading-tight">
        <p className="text-[13px] font-bold [font-variation-settings:'ROND'_85]">{t(spec.label)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t(spec.covers)}</p>
      </div>
      {/* Each token is a pill; colors cycle so every cut is visible. Raw text: no "->" arrows. */}
      <p aria-hidden className="raw cut-in text-[14px] leading-[2.15] break-words whitespace-pre-wrap">
        {pieces.map((piece, i) => (
          <span
            key={i}
            className="rounded-[7px] box-decoration-clone"
            style={{ backgroundColor: `var(--cut-${i % CUTS})` }}
          >
            {piece}
          </span>
        ))}
      </p>
      <div className="flex items-baseline justify-between gap-2 sm:block sm:text-right">
        <div className="num-lg text-[30px] leading-none">
          {formatInt(total)}
          <span className="sr-only">
            {" "}
            {t(" tokens con ")}
            {t(spec.label)}
          </span>
        </div>
        <div className={cn("mt-1.5 text-xs", isBest ? "font-bold text-signal-ink" : "text-muted-foreground")}>
          {isBest ? (
            <>
              <Sym>●</Sym> {t(" menos tokens")}
            </>
          ) : (
            <>
              +{delta}% <Sym>↗</Sym>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
