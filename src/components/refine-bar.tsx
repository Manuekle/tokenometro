"use client";

import { useMemo } from "react";
import { Sym } from "@/components/sym";
import { Button } from "@/components/ui/button";
import type { Row } from "@/lib/compute-rows";
import { downloadSize, ownRepo, refineTargets, type RefineApi } from "@/lib/refine";
import { useRepoProbes } from "@/lib/tokenizers/use-repo-probes";

/**
 * Offers to count the estimated models in `rows` with their OWN tokenizer
 * (the one published in their Hugging Face repo). Probes first, so it can say
 * how big the download is, and only shows up when there is something to gain.
 */
export function RefineBar({ rows, refine }: { rows: Row[]; refine: RefineApi }) {
  const targets = useMemo(() => refineTargets(rows, refine.refined), [rows, refine.refined]);
  const probes = useRepoProbes(targets.map((t) => t.repo));

  const visibleRepos = useMemo(
    () => [...new Set(rows.map((r) => ownRepo(r.model)).filter((r): r is string => r !== null))],
    [rows],
  );
  const loading = visibleRepos.filter((r) => refine.status(r).state === "loading");
  const failed = visibleRepos.filter((r) => refine.status(r).state === "error");

  const available = targets.filter((t) => probes[t.repo]?.state === "ok");
  const checking = targets.filter((t) => probes[t.repo] === undefined);
  const size = downloadSize(
    available.map((t) => {
      const probe = probes[t.repo];
      return probe?.state === "ok" ? probe.bytes : 0;
    }),
  );
  const modelCount = available.reduce((sum, t) => sum + t.models.length, 0);

  if (loading.length > 0) {
    const progress = loading.reduce((sum, r) => sum + refine.status(r).progress, 0) / loading.length;
    return (
      <Notice>
        <p className="flex items-center gap-2 text-sm" role="status">
          <Sym className="animate-pulse text-blue">●</Sym>
          Descargando {loading.length} {loading.length === 1 ? "tokenizador" : "tokenizadores"} ·{" "}
          <span className="num">{Math.round(progress * 100)}%</span>
        </p>
      </Notice>
    );
  }

  if (failed.length > 0) {
    const message = refine.status(failed[0]).error ?? "error de red";
    return (
      <Notice>
        <p className="flex items-start gap-2 text-sm" role="alert">
          <Sym className="mt-0.5 text-destructive">⚠</Sym>
          <span>
            {failed.length === 1 ? "No se pudo cargar un tokenizador" : `No se pudieron cargar ${failed.length} tokenizadores`}
            : {message}
          </span>
        </p>
        <Button variant="secondary" size="sm" onClick={() => refine.refine(failed)}>
          <Sym>↻</Sym> Reintentar
        </Button>
      </Notice>
    );
  }

  if (available.length > 0) {
    const accepted = available.slice(0, Math.max(refine.room, 0));
    const capped = accepted.length < available.length;
    return (
      <Notice>
        <p className="text-sm leading-snug">
          <span className="font-semibold">
            {modelCount} {modelCount === 1 ? "modelo" : "modelos"}
          </span>{" "}
          de esta vista {modelCount === 1 ? "usa" : "usan"} un conteo estimado, pero publican su tokenizador
          {size && (
            <>
              {" "}
              (<span className="num">{size}</span>)
            </>
          )}
          .{capped && <span className="text-muted-foreground"> Caben {refine.room} a la vez.</span>}
        </p>
        <Button
          size="sm"
          disabled={accepted.length === 0}
          onClick={() => refine.refine(accepted.map((t) => t.repo))}
        >
          <Sym>↓</Sym> Contar con el suyo
        </Button>
      </Notice>
    );
  }

  if (checking.length > 0) {
    return (
      <Notice>
        <p className="text-sm text-muted-foreground" role="status">
          Revisando si {checking.length === 1 ? "un modelo estimado publica" : `${checking.length} modelos estimados publican`} su
          tokenizador…
        </p>
      </Notice>
    );
  }

  return null;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl bg-raise px-4 py-3 shadow-raise">
      {children}
    </div>
  );
}
