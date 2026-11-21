"use client";

import { usePreferences } from "@/components/preferences-provider";
import { Sym } from "@/components/sym";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Row } from "@/lib/compute-rows";
import { formatContext, formatIndex, formatInt, formatPerM, formatTokens, formatUSD } from "@/lib/format";
import { downloadSize, ownRepo, type RefineApi } from "@/lib/refine";
import { TOKENIZERS, isRepoEngine } from "@/lib/tokenizers/registry";
import type { DisplayAccuracy } from "@/lib/tokenizers/resolve";
import { useRepoProbes } from "@/lib/tokenizers/use-repo-probes";

const ACCURACY_TEXT: Record<DisplayAccuracy, string> = {
  exact: "conteo exacto",
  approx: "conteo aproximado",
  calibrated: "calibrado con la API del proveedor",
  estimate: "conteo estimado",
};

const REASONING_TEXT = {
  none: "No razona",
  optional: "Razonamiento opcional",
  default: "Razona por defecto",
  mandatory: "Razona siempre",
} as const;

interface Props {
  row: Row | null;
  requestsPerMonth: number;
  batchShare: number;
  isPinned: boolean;
  onTogglePin: (id: string) => void;
  onClose: () => void;
  refine: RefineApi;
}

export function ModelTicket({ row, requestsPerMonth, batchShare, isPinned, onTogglePin, onClose, refine }: Props) {
  return (
    <Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="gap-0">
        {row && (
          <Body
            row={row}
            requestsPerMonth={requestsPerMonth}
            batchShare={batchShare}
            isPinned={isPinned}
            onTogglePin={onTogglePin}
            refine={refine}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Body({
  row,
  requestsPerMonth,
  batchShare,
  isPinned,
  onTogglePin,
  refine,
}: Omit<Props, "onClose" | "row"> & { row: Row }) {
  const { t } = usePreferences();
  const m = row.model;
  const spec = TOKENIZERS[m.tokenizer];
  const p = m.price;
  const hasCache = p.cacheRead !== undefined;

  return (
    <>
      <SheetHeader className="gap-1 px-7 pt-7 pb-5">
        <SheetDescription className="text-xs font-medium">{m.vendor}</SheetDescription>
        <SheetTitle className="text-[26px] leading-tight [font-variation-settings:'ROND'_100]">{m.name}</SheetTitle>
        <p className="num text-xs break-all text-muted-foreground">{m.id}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onTogglePin(m.id)} aria-pressed={isPinned}>
            <Sym className={isPinned ? "text-orange" : "text-faint"}>★</Sym>
            {isPinned ? t("Fijado") : t("Fijar para comparar")}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={`https://openrouter.ai/${m.id}`} target="_blank" rel="noreferrer">
              {t("Ver en OpenRouter ")}
              <Sym>↗</Sym>
            </a>
          </Button>
        </div>
      </SheetHeader>

      <div
        data-slot="sheet-body"
        tabIndex={0}
        className="grid min-h-0 gap-7 overflow-y-auto overscroll-contain px-7 pb-8 outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-inset"
      >
        <section aria-labelledby="ticket-month" className="rounded-[28px] bg-foreground p-6 text-background">
          <h3 id="ticket-month" className="role-label text-background/60">
            {formatInt(requestsPerMonth)} {t(" solicitudes al mes")}
          </h3>
          <div className="mt-3 flex items-end justify-between gap-4">
            <p className="num-lg text-[42px] leading-none">
              {formatUSD(row.monthly)}
              <span className="ml-1.5 text-sm font-medium tracking-normal text-background/60">{t("/mes")}</span>
            </p>
            <p className="num text-right text-base font-semibold">
              {formatUSD(row.yearly)}
              <span className="block text-xs font-normal text-background/60">{t("al año")}</span>
            </p>
          </div>
          <ul className="mt-4 grid gap-1.5 text-xs leading-snug text-background/70">
            {row.tier && (
              <li>
                {t("Tu solicitud supera ")}
                {formatInt(row.tier.minPromptTokens)} {t(" tokens de prompt: aplica la tarifa de contexto largo.")}
              </li>
            )}
            {row.usesBatch && (
              <li>
                {t("Incluye ")}
                {batchShare}
                {t("% del tráfico por Batch API con su descuento.")}
              </li>
            )}
            {batchShare > 0 && !m.batch && (
              <li>{t("Este modelo no ofrece Batch API: ese tráfico se cobra a tarifa normal.")}</li>
            )}
            {row.fit !== "ok" && (
              <li className="font-semibold text-orange">
                <Sym>⚠</Sym>{" "}
                {row.fit === "context"
                  ? t("La solicitud no cabe en la ventana de contexto.")
                  : t("La salida supera el máximo permitido por solicitud.")}
              </li>
            )}
          </ul>
        </section>

        <section aria-labelledby="ticket-request">
          <h3 id="ticket-request" className="role-label mb-3 text-muted-foreground">
            {t("Una solicitud")}
          </h3>
          <dl className="grid gap-1">
            <Ledger label={t("Entrada nueva")} tokens={row.freshTokens} cost={row.parts.input} />
            {row.cachedTokens > 0 && (
              <Ledger
                label={hasCache ? t("Prefijo en caché") : t("Prefijo (sin caché)")}
                tokens={row.cachedTokens}
                cost={row.parts.cachedInput}
              />
            )}
            <Ledger label={t("Salida")} tokens={row.outputTokens} cost={row.parts.output} />
            {row.reasoningTokens > 0 && (
              <Ledger label={t("Razonamiento")} tokens={row.reasoningTokens} cost={row.parts.reasoning} />
            )}
            <div className="mt-2 flex items-baseline justify-between rounded-2xl bg-card px-4 py-3">
              <dt className="text-sm font-bold">{t("Total por solicitud")}</dt>
              <dd className="num text-base font-bold">{formatUSD(row.perRequest)}</dd>
            </div>
          </dl>
        </section>

        <RefineSection row={row} refine={refine} />

        <section aria-labelledby="ticket-prices">
          <h3 id="ticket-prices" className="role-label mb-3 text-muted-foreground">
            {t("Tarifas de lista · USD por millón de tokens")}
          </h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            <Spec label={t("Entrada")} value={formatPerM(p.input)} />
            <Spec label={t("Salida")} value={formatPerM(p.output)} />
            {hasCache && <Spec label={t("Lectura de caché")} value={formatPerM(p.cacheRead)} />}
            {p.cacheWrite !== undefined && <Spec label={t("Escritura de caché")} value={formatPerM(p.cacheWrite)} />}
            {p.cacheWrite1h !== undefined && (
              <Spec label={t("Escritura de caché (1 h)")} value={formatPerM(p.cacheWrite1h)} />
            )}
            {p.reasoning !== undefined && <Spec label={t("Razonamiento")} value={formatPerM(p.reasoning)} />}
            {m.batch && (
              <Spec
                label={t("Batch · entrada / salida")}
                value={`${formatPerM(m.batch.price.input)} / ${formatPerM(m.batch.price.output)}`}
              />
            )}
            {m.tiers.map((tier) => (
              <Spec
                key={tier.minPromptTokens}
                label={t("Desde {0} de prompt", [formatContext(tier.minPromptTokens)])}
                value={`${formatPerM(tier.input)} / ${formatPerM(tier.output)}`}
              />
            ))}
          </dl>
        </section>

        <section aria-labelledby="ticket-spec">
          <h3 id="ticket-spec" className="role-label mb-3 text-muted-foreground">
            {t("Ficha")}
          </h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            <Spec
              label={t("Tokenizador")}
              value={`${isRepoEngine(row.engine) ? t("Propio del modelo") : t(spec.label)} · ${t(ACCURACY_TEXT[row.accuracy])}`}
            />
            <Spec label={t("Tokens de entrada por solicitud")} value={formatTokens(row.promptTokens)} />
            <Spec label={t("Ventana de contexto")} value={formatContext(m.contextLength)} />
            {m.maxOutputTokens !== null && <Spec label={t("Salida máxima")} value={formatContext(m.maxOutputTokens)} />}
            <Spec label={t("Índice de inteligencia")} value={formatIndex(m.intelligence)} />
            <Spec label={t("Razonamiento")} value={t(REASONING_TEXT[m.reasoning])} />
            <Spec label={t("Imágenes de entrada")} value={m.inputModalities.includes("image") ? t("Sí") : "No"} />
            <Spec label={t("Herramientas")} value={m.tools ? t("Sí") : "No"} />
            <Spec label={t("Salida estructurada")} value={m.structuredOutput ? t("Sí") : "No"} />
            <Spec label={t("Pesos abiertos")} value={m.openWeights ? t("Sí") : "No"} />
            {m.expiresAt && <Spec label={t("Se retira el")} value={m.expiresAt} />}
          </dl>
          {m.openWeights && (
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {t(
                "Los modelos abiertos se ofrecen con varios proveedores y precios. Aquí se usa el precio que publica OpenRouter; si lo alojas tú, el costo es otro (GPU, operación).",
              )}
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function Ledger({ label, tokens, cost }: { label: string; tokens: number; cost: number }) {
  return (
    <div className="flex items-baseline gap-3 px-4 py-2">
      <dt className="min-w-0 flex-1 text-sm">
        {label}
        <span className="num ml-2 text-xs text-muted-foreground">{formatTokens(tokens)} tok</span>
      </dt>
      <dd className="num text-sm">{formatUSD(cost)}</dd>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="num text-right text-[13px] font-medium">{value}</dd>
    </>
  );
}

/**
 * Count this model with its OWN tokenizer (published in its Hugging Face
 * repo) instead of its family's. Probes first so the size is known up front.
 */
function RefineSection({ row, refine }: { row: Row; refine: RefineApi }) {
  const { t, tError } = usePreferences();
  const repo = ownRepo(row.model);
  const probes = useRepoProbes(repo ? [repo] : []);
  if (!repo) return null;

  const own = isRepoEngine(row.engine);
  const probe = probes[repo];
  const status = refine.status(repo);
  const alreadyExact = row.accuracy === "exact" && !own;

  let body: React.ReactNode;
  if (own) {
    body = (
      <>
        <p className="flex items-start gap-2">
          <Sym className="mt-0.5 text-signal-ink">✓</Sym>
          <span>{t("Cuenta con el tokenizador propio de este modelo.")}</span>
        </p>
        <Button variant="ghost" size="sm" onClick={() => refine.remove(repo)}>
          {t("Volver al de su familia")}
        </Button>
      </>
    );
  } else if (status.state === "loading") {
    body = (
      <p className="flex items-center gap-2" role="status">
        <Sym className="animate-pulse text-blue">●</Sym> {t(" Descargando su tokenizador ·")}{" "}
        <span className="num">{Math.round(status.progress * 100)}%</span>
      </p>
    );
  } else if (status.state === "ready") {
    body = (
      <p className="flex items-center gap-2" role="status">
        <Sym className="animate-pulse text-blue">●</Sym> {t(" Contando con su tokenizador…")}
      </p>
    );
  } else if (status.state === "error") {
    body = (
      <>
        <p className="flex items-start gap-2" role="alert">
          <Sym className="mt-0.5 text-destructive">⚠</Sym>
          <span>{tError(status.error ?? "No se pudo cargar su tokenizador.")}</span>
        </p>
        <Button variant="secondary" size="sm" onClick={() => refine.refine([repo])}>
          <Sym>↻</Sym> {t(" Reintentar")}
        </Button>
      </>
    );
  } else if (!probe) {
    body = <p className="text-muted-foreground">{t("Revisando si publica su tokenizador…")}</p>;
  } else if (probe.state === "ok") {
    const size = downloadSize([probe.bytes]);
    body = (
      <>
        <p>
          {t("Este modelo publica su propio tokenizador")}
          {size && (
            <>
              {" "}
              (<span className="num">{size}</span>)
            </>
          )}
          .{" "}
          {alreadyExact
            ? t("Úsalo para confirmar el conteo: puede variar unos puntos frente al de su familia.")
            : t("Úsalo para un conteo exacto en vez de una estimación.")}
        </p>
        <Button size="sm" disabled={refine.room <= 0} onClick={() => refine.refine([repo])}>
          <Sym>↓</Sym> {refine.room <= 0 ? t("Máximo de tokenizadores propios") : t("Contar con el suyo")}
        </Button>
      </>
    );
  } else {
    body = (
      <p className="text-muted-foreground">
        {t("No disponible: ")}
        {tError(probe.message)}
      </p>
    );
  }

  return (
    <section aria-labelledby="ticket-tokenizer">
      <h3 id="ticket-tokenizer" className="role-label mb-3 text-muted-foreground">
        {t("Su tokenizador")}
      </h3>
      <div className="grid justify-items-start gap-3 rounded-2xl bg-card p-4 text-sm leading-snug">
        {body}
        <a
          href={`https://huggingface.co/${repo}`}
          target="_blank"
          rel="noreferrer"
          className="num text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {repo} <Sym>↗</Sym>
        </a>
      </div>
    </section>
  );
}
